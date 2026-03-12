// NetworkInfoOptimized.js
// 优化：运营商用本地 fallback + 硬编码，公网只显示 IP/位置
// 去除“由 Egern”，紧凑排版，深色风格

export default async function(ctx) {
  const device = ctx.device || {};
  const wifi = device.wifi || {};
  const cellular = device.cellular || {};
  const ipv4 = device.ipv4 || {};
  const ipv6 = device.ipv6 || {};

  // ------------------ 运营商 & 网络类型 ------------------
  let displayCarrier = "中国移动";  // 硬编码兜底（你的情况明确是中国移动）
  
  // 如果 ctx.device.cellular.carrier 有值，尝试格式化（偶尔系统会给）
  if (cellular.carrier) {
    const lower = cellular.carrier.toLowerCase();
    if (lower.includes("mobile") || lower.includes("cmcc") || lower.includes("chinamobile")) {
      displayCarrier = "中国移动";
    } else if (lower.includes("telecom") || lower.includes("ctcc")) {
      displayCarrier = "中国电信";
    } else if (lower.includes("unicom")) {
      displayCarrier = "中国联通";
    } else {
      displayCarrier = cellular.carrier;  // 系统原值
    }
  }

  let networkType = "未连接";
  let icon = "exclamationmark.triangle";
  let iconColor = "#FF3B30";

  if (wifi.ssid) {
    networkType = wifi.ssid;
    icon = "wifi";
    iconColor = "#007AFF";
  } else if (cellular.radio) {
    let radio = (cellular.radio || "").toUpperCase().replace(/\s/g, "");
    if (radio.includes("NR") || radio === "5G" || radio.includes("NSA") || radio.includes("NR5G")) {
      networkType = "5G";
    } else if (radio.includes("LTE")) {
      networkType = "4G";
    } else {
      networkType = radio || "蜂窝";
    }
    icon = "simcard.fill";
    iconColor = "#F9BF45";
  }

  const title = `${displayCarrier} | ${networkType}`;

  // ------------------ 内网信息 ------------------
  const lines = [];

  if (ipv4.address && ipv4.address !== "0.0.0.0") {
    lines.push(`内网 IPv4: ${ipv4.address}`);
  }

  if (ipv6.address && ipv6.address.includes(":")) {
    lines.push(`内网 IPv6: ${ipv6.address}`);
  }

  // ------------------ 公网信息（从 API 获取） ------------------
  let publicIP = "--";
  let location = "--";

  try {
    const resp = await ctx.http.get("http://ip-api.com/json/?lang=zh-CN", { timeout: 6000 });
    if (resp.status === 200) {
      const data = await resp.json();
      if (data.status === "success") {
        publicIP = data.query || "--";
        location = [data.country, data.regionName, data.city]
          .filter(Boolean)
          .join(" ")
          .replace("加利福尼亚", "加州")  // 更简洁
          .replace("洛杉矶", "洛杉矶");  // 保持原样
      }
    }
  } catch (e) {
    console.log("[IP API Error]", e.message);
  }

  if (publicIP !== "--") {
    lines.push(`公网 IPv4: ${publicIP}`);
  }
  if (location !== "--") {
    lines.push(`位置: ${location}`);
  }

  // ------------------ 小组件 DSL：紧凑排版，无底部署名 ------------------
  return {
    type: "widget",
    padding: [10, 14, 10, 14],  // 缩小 padding，更紧凑
    gap: 4,                     // 行间距更小
    backgroundColor: {"light": "#121212", "dark": "#000000"},
    borderRadius: "auto",
    children: [
      // 标题行
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "image",
            src: `sf-symbol:${icon}`,
            width: 22,
            height: 22,
            color: iconColor
          },
          {
            type: "text",
            text: title,
            font: { size: "title3", weight: "bold" },
            textColor: "#FFFFFF",
            flex: 1,
            minScale: 0.85
          }
        ]
      },

      // 内容列表（统一 subheadline，左对齐，稍小字体）
      ...lines.map(line => ({
        type: "text",
        text: line,
        font: { size: "subheadline" },  // 或试 "caption1" 如果想更小
        textColor: line.startsWith("公网") || line.startsWith("位置") ? "#BBBBBB" : "#DDDDDD",
        textAlign: "left",
        lineLimit: 1,  // 防止 IPv6 换行太多
        minScale: 0.9
      })),

      // 只留时间（右下角小字，可选移除：删掉下面这个 stack）
      { type: "spacer" },
      {
        type: "text",
        text: new Date().toLocaleTimeString('zh-CN', {hour12: false, hour: '2-digit', minute: '2-digit'}),
        font: { size: "caption2" },
        textColor: "#666666",
        textAlign: "right"
      }
    ]
  };
}
