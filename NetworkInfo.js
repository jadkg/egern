// 文件名建议：NetworkInfoWidget.js
// 类型：generic
export default async function (ctx) {
    const publicInfo = ctx.storage.getJSON("public_ip_info") || {};
  if (publicInfo.ip) {
    lines.push({ label: "公网 IPv4", value: publicInfo.ip });
    lines.push({ label: "位置", value: [publicInfo.country, publicInfo.region, publicInfo.city].filter(Boolean).join(" ") });
  }
  const device = ctx.device || {};
  const wifi = device.wifi || {};
  const cellular = device.cellular || {};
  const ipv4 = device.ipv4 || {};
  const ipv6 = device.ipv6 || {};

  // 判断网络类型并生成标题
  let title = "网络信息";
  let networkIcon = "wifi";
  let iconColor = "#007AFF"; // 蓝色

  if (wifi.ssid) {
    title = `${wifi.ssid}`;
  } else if (cellular.radio) {
    let radio = cellular.radio.toUpperCase();
    let type = "蜂窝";
    if (radio.includes("NR") || radio.includes("5G")) type = "5G";
    else if (radio.includes("LTE")) type = "4G";
    else if (radio.includes("WCDMA") || radio.includes("HSDPA")) type = "3G";
    title = `${cellular.carrier || "未知运营商"} | ${type}`;
    networkIcon = "simcard";
    iconColor = "#F9BF45"; // 橙色
  } else {
    title = "未连接网络";
  }

  // 准备显示行
  const lines = [];

  // 内网 IPv4
  if (ipv4.address && ipv4.address !== "0.0.0.0") {
    lines.push({
      label: "内网 IPv4",
      value: ipv4.address
    });
  }

  // 内网网关（路由器IP） — 只有 Wi-Fi 时较可靠
  if (wifi.ssid && ipv4.gateway && ipv4.gateway !== "0.0.0.0") {
    lines.push({
      label: "内网路由",
      value: ipv4.gateway
    });
  }

  // 内网 IPv6（只显示非临时链路本地地址）
  if (ipv6.address && !ipv6.address.startsWith("fe80:")) {
    lines.push({
      label: "内网 IPv6",
      value: ipv6.address
    });
  }

  // 小尺寸 / 矩形配件 简化显示
  if (ctx.widgetFamily === "systemSmall" || ctx.widgetFamily === "accessoryRectangular") {
    return {
      type: "widget",
      padding: 12,
      gap: 6,
      backgroundColor: {"light": "#F5F5F7", "dark": "#1C1C1E"},
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 8,
          children: [
            {
              type: "image",
              src: `sf-symbol:${networkIcon}`,
              width: 20,
              height: 20,
              color: iconColor
            },
            {
              type: "text",
              text: title,
              font: { size: "headline", weight: "semibold" },
              textColor: {"light": "#000000", "dark": "#FFFFFF"},
              flex: 1,
              minScale: 0.8
            }
          ]
        },
        {
          type: "text",
          text: lines.map(l => l.value).join("\n") || "无IP信息",
          font: { size: "caption1" },
          textColor: {"light": "#666666", "dark": "#BBBBBB"},
          textAlign: "left",
          maxLines: 3
        }
      ]
    };
  }

  // 中/大尺寸 显示更多细节
  return {
    type: "widget",
    padding: [14, 16, 14, 16],
    gap: 10,
    backgroundGradient: {
      type: "linear",
      colors: ["#0F2027", "#203A43", "#2C5364"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    borderRadius: "auto",
    children: [
      // 标题行
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 10,
        children: [
          {
            type: "image",
            src: `sf-symbol:${networkIcon}.fill`,
            width: 28,
            height: 28,
            color: iconColor
          },
          {
            type: "text",
            text: title,
            font: { size: "title3", weight: "bold" },
            textColor: "#FFFFFF",
            flex: 1
          }
        ]
      },

      // 分隔
      { type: "spacer", length: 4 },

      // 信息列表
      ...lines.map(item => ({
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "text",
            text: item.label + "：",
            font: { size: "subheadline" },
            textColor: "#AAAAAA",
            width: 90   // 固定标签宽度，右对齐对齐值
          },
          {
            type: "text",
            text: item.value || "—",
            font: { size: "body", weight: "medium" },
            textColor: "#FFFFFF",
            flex: 1,
            minScale: 0.85
          }
        ]
      })),

      // 底部更新提示（可选）
      { type: "spacer" },
      {
        type: "text",
        text: "由 Egern • " + (new Date().toLocaleTimeString("zh-CN", {hour12:false}).slice(0,5)),
        font: { size: "caption2" },
        textColor: "#777777",
        textAlign: "center"
      }
    ]
  };
}
