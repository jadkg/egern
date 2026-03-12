export default async function(ctx) {

  const wifi = ctx.device.wifi?.ssid || "未连接"
  const ipv4 = ctx.device.ipv4?.address || "—"
  const dns = (ctx.device.dnsServers || []).join(", ") || "—"

  const radio = ctx.device.cellular?.radio || ""
  const carrierRaw = ctx.device.cellular?.carrier || ""

  // 运营商识别
  let carrier = "—"

  if (carrierRaw.includes("Mobile") || carrierRaw.includes("CMCC") || carrierRaw.includes("移动"))
    carrier = "中国移动"
  else if (carrierRaw.includes("Unicom") || carrierRaw.includes("联通"))
    carrier = "中国联通"
  else if (carrierRaw.includes("Telecom") || carrierRaw.includes("电信"))
    carrier = "中国电信"
  else if (carrierRaw !== "")
    carrier = carrierRaw

  let networkType = wifi !== "未连接" ? "WiFi" : (radio || "蜂窝")

  let publicIP = "—"
  let location = "—"
  let flag = ""

  // 获取公网IP
  try {

    const res = await ctx.http.get({
      url: "https://ip.sb/geoip",
      timeout: 5000
    })

    const data = JSON.parse(res.body)

    publicIP = data.ip || "—"
    location = `${data.country} ${data.city}`

    if (data.country_code) {
      flag = String.fromCodePoint(
        ...[...data.country_code.toUpperCase()].map(c => 127397 + c.charCodeAt())
      )
    }

  } catch (e) {}

  // 延迟测试
  let latency = "—"

  try {

    const start = Date.now()

    await ctx.http.get({
      url: "https://1.1.1.1",
      timeout: 3000
    })

    latency = Date.now() - start + " ms"

  } catch (e) {}

  const items = [
    `🌍 ${publicIP} ${flag}`,
    `📍 ${location}`,
    `📶 WiFi: ${wifi}`,
    `🖥 IP: ${ipv4}`,
    `🔐 DNS: ${dns}`,
    `📡 ${carrier} ${networkType}`,
    `⚡ 延迟: ${latency}`
  ]

  return {
    type: "widget",
    padding: 16,

    backgroundGradient: {
      colors: ["#8be6b3","#c8f7d6"],
      locations: [0,1]
    },

    children: [

      {
        type: "text",
        text: "网络信息",
        font: { size: "headline", weight: "bold" },
        textColor: "#063d2b"
      },

      {
        type: "spacer",
        size: 8
      },

      ...items.map(i => ({
        type: "text",
        text: i,
        font: { size: "caption1" },
        textColor: "#063d2b"
      }))
    ]
  }

}
