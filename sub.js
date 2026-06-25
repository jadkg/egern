function operator(proxies) {
  // === 在这里修改你的机场前缀 ===
  const providerName = "良心"; 

  // 常用地区匹配规则
  const regions = [
    { key: /香港|HK|HongKong/i, name: "香港" },
    { key: /台湾|TW|Taiwan/i, name: "台湾" },
    { key: /新加坡|SG|Singapore/i, name: "新加坡" },
    { key: /日本|JP|Japan/i, name: "日本" },
    { key: /美国|US|America|United States/i, name: "美国" },
    { key: /韩国|韩|KR|Korea/i, name: "韩国" },
    { key: /英国|英|UK|United Kingdom|Britain/i, name: "英国" },
    { key: /德国|德|DE|Germany/i, name: "德国" },
    { key: /法国|法|FR|France/i, name: "法国" },
    { key: /加拿大|加|CA|Canada/i, name: "加拿大" },
    { key: /澳大利亚|澳洲|AU|Australia/i, name: "澳大利亚" },
    { key: /印度|IN|India/i, name: "印度" }
  ];

  // 为每个地区初始化一个计数器
  const counters = {};
  regions.forEach(r => {
    counters[r.name] = 1;
  });

  // 遍历并修改节点
  return proxies.map(proxy => {
    
    // 1. 协议指纹合并：如果是 vless, vmess 或 trojan 等协议，自动添加随机客户端指纹
    if (['vless', 'vmess', 'trojan'].includes(proxy.type)) {
      proxy['client-fingerprint'] = 'random';
    }

    // 2. 严格匹配倍率：必须同时存在 乘号(x/×) 和 数字，确保不误伤 HongKong 02
    let rateStr = "";
    const rateMatch = proxy.name.match(/(?:[x×]\s*[0-9.]+)|(?:[0-9.]+\s*[x×])/i);
    
    if (rateMatch) {
      const numMatch = rateMatch[0].match(/[0-9.]+/);
      if (numMatch) {
        rateStr = ` [x${numMatch[0]}]`;
      }
    }

    // 3. 匹配常用地区并重命名
    let matched = false;
    for (let r of regions) {
      if (r.key.test(proxy.name)) {
        let num = String(counters[r.name]++).padStart(2, '0');
        proxy.name = `${providerName}-${r.name}${num}${rateStr}`;
        matched = true;
        break; 
      }
    }

    // 4. 常用地区之外的处理：保留原名但移除旧倍率字符（防止后缀重复），强行追加前缀与严格倍率
    if (!matched) {
      let rawName = proxy.name.replace(/(?:[x×]\s*[0-9.]+)|(?:[0-9.]+\s*[x×])/i, '').trim();
      proxy.name = `${providerName}-${rawName}${rateStr}`;
    }
    
    return proxy;
  });
}
