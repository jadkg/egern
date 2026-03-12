// 文件名建议：NetworkInfoFull.js
// 类型：generic
// 在 Egern 小组件中使用此脚本

export default async function(ctx) {
  const device = ctx.device || {};
  const wifi = device.wifi || {};
  const cellular = device.cellular || {};
  const ipv4 = device.ipv4 || {};
  const ipv6 = device.ipv6 || {};

  // ------------------ 1. 准备本地网络信息 ------------------
  let localCarrier = cellular.carrier || "";
  let networkType = "未连接";
  let icon = "exclamationmark.triangle";
  let iconColor = "#FF3B30";  // 红色 fallback

  if (wifi.ssid) {
    networkType = wifi.ssid;
    icon = "wifi";
    iconColor = "#007AFF";  // 蓝色 Wi-Fi
  } else if (cellular.radio) {
    let radio = (cellular.radio || "").toUpperCase().replace(/\s/g, "");
    if (radio.includes("NR") || radio === "5G" || radio.includes("NSA") || radio.includes("NR5G")) {
      networkType = "5G";
    } else if (radio.includes("LTE") || radio === "4G") {
      networkType = "4G";
    } else if (radio.includes("WCDMA") || radio.includes("HSDPA")) {
      networkType = "3G";
    } else {
      networkType = radio || "蜂窝";
    }
    icon = "simcard.fill";
    iconColor = "#F9BF45";  // 橙色蜂窝
  }

  // ------------------ 2. 请求公网信息（合并在这里） ------------------
  let publicIP = "检测中...";
  let publicLocation = "";
  let ispRaw = "";
  let displayCarrier = "--";  // 默认显示 --

  try {
    // 使用 ip-api.com，支持中文 & ISP 字段（常包含 "China Mobile" 等）
    const resp = await ctx.http.get("http://ip-api.com/json/?lang=zh-CN&fields=status,message,query,isp,org,as,mobile,country,city,regionName", {
      timeout: 8000  // 超时 8 秒，避免卡住小组件
    });

    if (resp.status === 200) {
      const data = await resp.json();

      if (data.status === "success") {
        publicIP = data.query || "未知";
        publicLocation = [data.country, data.regionName, data.city].filter(Boolean).join(" ");
        ispRaw = data.isp || data.org || data.as || "";

        // ------------------ 运营商格式化（核心） ------------------
        const lowerISP = ispRaw.toLowerCase();
        if (lowerISP.includes("mobile") || lowerISP.includes("cmcc") || lowerISP.includes("chinamobile") || lowerISP.includes("中国移动")) {
          displayCarrier = "中国移动";
        } else if (lowerISP.includes("telecom") || lowerISP.includes("ctcc") || lowerISP.includes("中国电信")) {
          displayCarrier = "中国电信";
        } else if (lowerISP.includes("unicom") || lowerISP.includes("中国联通")) {
          displayCarrier = "中国联通";
        } else if (lowerISP.includes("broadcast") || lowerISP.includes("广电")) {
          displayCarrier = "中国广电";
        } else if (data.mobile === true || lowerISP.includes("mobile network")) {
          displayCarrier = "移动网络";  // 兜底
        } else {
          // 如果 ISP 为空或不匹配，用本地 carrier fallback
          displayCarrier = formatCarrier(localCarrier) || "未知运营商";
        }
      } else {
        publicIP = "检测失败";
      }
    }
  } catch (e) {
    publicIP = "网络错误";
    console.log("[Public IP Error]", e);
  }

  // 小函数：格式化本地 carrier（备用）
  function formatCarrier(carrier) {
    if (!carrier) return null;
    const lower = carrier.toLowerCase();
    if (lower.includes("mobile") || lower.includes("cmcc")) return "中国移动";
    if (lower.includes("telecom") || lower.includes("ct")) return "中国电信";
    if (lower.includes("unicom")) return "中国联通";
    return carrier;
  }

  const title = `${displayCarrier} | ${networkType}`;

  // ------------------ 3. 内网信息 ------------------
  const contentLines = [];

  if (ipv4.address && ipv4.address !== "0.0.0.0") {
    contentLines.push(`内网 IPv4: ${ipv4.address}`);
  }

  if (ipv6.address && ipv6.address.includes(":")) {
    contentLines.push(`内网 IPv6: ${ipv6.address}`);
  }

  if (ipv4.gateway && ipv4.gateway !== "0.0.0.0" && wifi.ssid) {
    contentLines.push(`内网路由: ${ipv4.gateway}`);
  }

  // ------------------ 4. 小组件 DSL 输出 ------------------
  // 风格模仿你的截图：深色背景、简洁列表、底部署名+时间
  return {
    type: "widget",
    padding: [12, 16, 12, 16],
    gap: 8,
    backgroundColor: {"light": "#1C1C1E", "dark": "#000000"},  // 深黑/灰
    children: [
      // 标题行 + 图标
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 10,
        children: [
          {
            type: "image",
            src: `sf-symbol:${icon}`,
            width: 28,
            height: 28,
            color: iconColor
          },
          {
            type: "text",
            text: title,
            font: { size: "title3", weight: "bold" },
            textColor: "#FFFFFF",
            flex: 1,
            minScale: 0.8
          }
        ]
      },

      // 内网信息列表
      ...contentLines.map(line => ({
        type: "text",
        text: line,
        font: { size: "subheadline" },
        textColor: "#DDDDDD",
        textAlign: "left"
      })),

      // 公网信息（如果获取成功）
      ...(publicIP !== "检测中..." && publicIP !== "检测失败" && publicIP !== "网络错误" ? [{
        type: "text",
        text: `公网 IPv4: ${publicIP}`,
        font: { size: "subheadline" },
        textColor: "#AAAAAA"
      }] : []),

      ...(publicLocation ? [{
        type: "text",
        text: `位置: ${publicLocation}`,
        font: { size: "caption1" },
        textColor: "#888888"
      }] : []),

      // 底部署名 + 当前时间（格式 21:02）
      { type: "spacer" },
      {
        type: "text",
        text: `由 Egern • ${new Date().toLocaleTimeString('zh-CN', {hour12: false, hour: '2-digit', minute: '2-digit'})}`,
        font: { size: "caption2" },
        textColor: "#777777",
        textAlign: "center"
      }
    ]
  };
}
