/**
 * Egern Network Info Widget
 * 严格适配版
 */

(async () => {
  try {
    const network = $network;
    const primaryInterface = network.primaryInterfaceAddress;
    
    // 1. 确定连接名称
    let conn = "未连接";
    if (network.ssid) {
      conn = network.ssid;
    } else if (network.radioGeneration) {
      conn = `蜂窝 (${network.radioGeneration})`;
    }

    // 2. 格式化 IP
    const v4 = primaryInterface.v4 || "N/A";
    const v6 = primaryInterface.v6 ? "已连接" : "未开启";

    // 3. 构建输出 (所有字段必须为字符串)
    const result = {
      title: "当前网络",
      content: `SSID: ${conn}\nIPv4: ${v4}\nIPv6: ${v6}`,
      icon: "wifi",
      backgroundColor: "#4285F4",
      titleColor: "#FFFFFF",
      contentColor: "#F8F9FA"
    };

    $done(result);
  } catch (e) {
    // 捕获异常，防止组件显示空白
    $done({
      title: "脚本错误",
      content: e.message || "未知错误",
      icon: "alert-circle",
      backgroundColor: "#EA4335"
    });
  }
})();
