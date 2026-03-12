/**
 * Egern Network Info Widget
 * 适配自: https://raw.githubusercontent.com/jnlaoshu/MySelf/main/Script/NetworkInfo.js
 */

async function getNetworkInfo() {
  const { ssid, radioGeneration } = $network;
  const { v4, v6 } = $network.primaryInterfaceAddress;
  
  // 组装显示信息
  let connectionType = "未连接";
  if (ssid) {
    connectionType = `Wi-Fi: ${ssid}`;
  } else if (radioGeneration) {
    connectionType = `蜂窝网络: ${radioGeneration}`;
  }

  // 构建小组件返回对象
  // 这里的 icon 使用了 Lucide 图标库，Egern 支持该库
  const widget = {
    title: "网络状态",
    content: `${connectionType}\nIPv4: ${v4 || '无'}\nIPv6: ${v6 ? '已分配' : '未分配'}`,
    icon: "network", 
    backgroundColor: "#007AFF",
    titleColor: "#FFFFFF",
    contentColor: "#F2F2F7"
  };

  $done(widget);
}

getNetworkInfo().catch((err) => {
  $done({
    title: "网络状态",
    content: "获取失败: " + err.message,
    icon: "wifi-off",
    backgroundColor: "#FF3B30"
  });
});
