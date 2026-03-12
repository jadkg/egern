/**
 * 严格按照 Egern JS API 重新实现的网络信息脚本
 */

async function main() {
  // 获取 Egern 系统网络信息
  const networkInfo = $network;
  const primaryInterface = networkInfo.primaryInterfaceAddress;

  // 1. 判断网络类型与 SSID
  let connectionName = "未连接";
  if (networkInfo.ssid) {
    connectionName = `Wi-Fi: ${networkInfo.ssid}`;
  } else if (networkInfo.radioGeneration) {
    connectionName = `蜂窝: ${networkInfo.radioGeneration}`;
  }

  // 2. 获取 IP 地址
  const ipv4 = primaryInterface.v4 || "无";
  const ipv6 = primaryInterface.v6 ? "已分配" : "未分配";

  // 3. 构造组件展示对象 (必须符合 Widget 定义)
  const widgetResponse = {
    title: "网络环境",
    content: `${connectionName}\nIPv4: ${ipv4}\nIPv6: ${ipv6}`,
    icon: "router", // 也可以用 "wifi" 或 "network"
    backgroundColor: "#1c1c1e",
    titleColor: "#0A84FF",
    contentColor: "#FFFFFF"
  };

  // 4. 必须使用 $done 返回
  $done(widgetResponse);
}

// 执行并捕获错误
main().catch((err) => {
  $done({
    title: "脚本执行错误",
    content: err.message,
    icon: "alert-triangle",
    backgroundColor: "#FF3B30"
  });
});
