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

  // 上标字符与普通字符的映射表，用于将 ³ˣ 转换为 3x
  const superscriptMap = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '·': '.', '⋅': '.', 'ˣ': 'x', 'ᵡ': 'x', '❌': 'x'
  };

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

    // 2. 倍率提取逻辑
    let rateStr = "";
    
    // 正则 A：匹配普通倍率（如 x0.1, 0.5x, ×2）
    const normalRateRegex = /(?:[x×]\s*[0-9.]+)|(?:[0-9.]+\s*[x×])/i;
    // 正则 B：匹配特殊上标倍率（如 ³ˣ, ⁰⁵ˣ）
    const superRateRegex = /[⁰¹²³⁴⁵⁶⁷⁸⁹·⋅]+[ˣᵡ]|[ˣᵡ][⁰¹²³⁴⁵⁶⁷⁸⁹·⋅]+/i;

    let normalMatch = proxy.name.match(normalRateRegex);
    let superMatch = proxy.name.match(superRateRegex);

    if (normalMatch) {
      // 处理普通倍率
      const numMatch = normalMatch[0].match(/[0-9.]+/);
      if (numMatch) {
        rateStr = ` [x${numMatch[0]}]`;
      }
    } else if (superMatch) {
      // 处理上标倍率：将上标文本逐字翻译为标准数字与字母
      let translated = superMatch[0].split('').map(char => superscriptMap[char] || '').join('');
      // 提取纯数字部分
      const numMatch = translated.match(/[0-9.]+/);
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

    // 4. 常用地区之外的处理
    if (!matched) {
      // 移除原名中的普通倍率和上标倍率，防止后缀重复
      let rawName = proxy.name
        .replace(normalRateRegex, '')
        .replace(superRateRegex, '')
        .trim();
      proxy.name = `${providerName}-${rawName}${rateStr}`;
    }
    
    return proxy;
  });
}
