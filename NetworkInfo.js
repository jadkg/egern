export default async function(ctx) {

  const wifi = ctx.device.wifi?.ssid || "未连接";
  const bssid = ctx.device.wifi?.bssid || "—";
  const ipv4 = ctx.device.ipv4?.address || "—";
  const gateway = ctx.device.ipv4?.gateway || "—";
  const ipv6 = ctx.device.ipv6?.address || "—";
  const dns = (ctx.device.dnsServers || []).join(", ") || "—";
  const carrier = ctx.device.cellular?.carrier || "—";
  const radio = ctx.device.cellular?.radio || "—";

  const items = [
    `WiFi: ${wifi}`,
    `IPv4: ${ipv4}`,
    `Gateway: ${gateway}`,
    `IPv6: ${ipv6}`,
    `DNS: ${dns}`,
    `Carrier: ${carrier}`,
    `Radio: ${radio}`,
  ];

  return {
    type: "widget",
    padding: 14,
    backgroundColor: "#111111",
    children: [
      {
        type: "text",
        text: "Network Info",
        font: { size: "headline", weight: "bold" },
        textColor: "#ffffff"
      },
      {
        type: "spacer",
        size: 8
      },
      ...items.map(i => ({
        type: "text",
        text: i,
        font: { size: "caption1" },
        textColor: "#dddddd"
      }))
    ]
  };

}
