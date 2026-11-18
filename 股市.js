// Egern 小组件：A 股指数日K（卡片风格）
// 数据源：东方财富（行情 + 日K）
// 可选环境变量（env）：
//   INDEXES    指数列表，逗号分隔，默认 "1.000001,0.399001,0.399006"
//              格式 市场.代码：1=沪市 0=深市，如 1.000300 沪深300、1.000688 科创50
//   UP_COLOR   上涨颜色（6位hex），默认红 #FF4D4F
//   DOWN_COLOR 下跌颜色（6位hex），默认绿 #22C55E
//   DAYS       中/小尺寸K线根数，默认 30
//   REFRESH    刷新间隔（分钟），默认 10
//   KLINE_PERIOD K线周期：5分钟 / 15分钟 / 30分钟 / 60分钟 / 日K / 周K / 月K，默认 日K

const NAMES = {
  '1.000001': '上证指数',
  '0.399001': '深证成指',
  '0.399006': '创业板指',
  '1.000300': '沪深300',
  '1.000688': '科创50',
  '1.000016': '上证50',
  '1.000905': '中证500',
  '0.399005': '中小100',
};

const rgb = (hex) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
};
const fmt = (v) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sign = (v) => (v > 0 ? '+' : '');
const FETCH_DAYS = 80;

async function getQuotes(ctx, secids) {
  const url =
    'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14&secids=' +
    secids.join(',');
  const resp = await ctx.http.get(url);
  const json = await resp.json();
  const diff = (json && json.data && json.data.diff) || [];
  return secids
    .map((id) => {
      const code = id.split('.')[1];
      const d = diff.find((x) => String(x.f12) === code);
      if (!d) return null;
      return { id, code, name: NAMES[id] || d.f14, price: Number(d.f2), pct: Number(d.f3), chg: Number(d.f4) };
    })
    .filter(Boolean);
}

// 日K：每行 日期,开,收,高,低,量,额
async function getKline(ctx, secid, klt) {
  try {
    const url =
      'https://push2his.eastmoney.com/api/qt/stock/kline/get?klt=' + (klt || 101) + '&fqt=1&end=20500101' +
      '&lmt=' + FETCH_DAYS +
      '&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&secid=' + secid;
    const resp = await ctx.http.get(url);
    const json = await resp.json();
    const lines = (json && json.data && json.data.klines) || [];
    return lines
      .map((l) => {
        const p = l.split(',');
        return { date: p[0], o: +p[1], c: +p[2], h: +p[3], l: +p[4] };
      })
      .filter((k) => !isNaN(k.o) && !isNaN(k.c));
  } catch (e) {
    return [];
  }
}

// 画蜡烛图。all=完整K线（用于算均线），n=显示最近多少根
function kline(all, n, w, h, o) {
  if (!all || all.length < 2) return { type: 'stack', width: w, height: h, children: [] };
  const up = rgb(o.up);
  const down = rgb(o.down);
  const start = Math.max(0, all.length - n);
  const view = all.slice(start);

  const maLines = (o.ma || []).map((k) => {
    const vals = [];
    for (let j = start; j < all.length; j++) {
      if (j < k - 1) { vals.push(null); continue; }
      let s = 0;
      for (let t = j - k + 1; t <= j; t++) s += all[t].c;
      vals.push(s / k);
    }
    return vals;
  });

  let min = Math.min(...view.map((k) => k.l));
  let max = Math.max(...view.map((k) => k.h));
  maLines.forEach((vs) => vs.forEach((v) => { if (v != null) { min = Math.min(min, v); max = Math.max(max, v); } }));
  const pad = (max - min) * 0.06 || 1;
  min -= pad; max += pad;

  const Y = (v) => (((max - v) / (max - min)) * h).toFixed(1);
  const slot = w / view.length;
  const bw = Math.max(1.2, slot * 0.62);
  let body = '';
  view.forEach((k, i) => {
    const x = (slot * (i + 0.5)).toFixed(1);
    const col = k.c >= k.o ? up : down;
    const yo = +Y(k.o), yc = +Y(k.c);
    const top = Math.min(yo, yc);
    const bh = Math.max(1, Math.abs(yo - yc));
    body +=
      `<line x1='${x}' x2='${x}' y1='${Y(k.h)}' y2='${Y(k.l)}' stroke='${col}' stroke-width='1'/>` +
      `<rect x='${(x - bw / 2).toFixed(1)}' y='${top.toFixed(1)}' width='${bw.toFixed(1)}' height='${bh.toFixed(1)}' fill='${col}'/>`;
  });

  let ma = '';
  const maColors = ['rgb(245,166,35)', 'rgb(77,163,255)', 'rgb(181,140,255)'];
  maLines.forEach((vs, idx) => {
    const pts = [];
    vs.forEach((v, i) => { if (v != null) pts.push((slot * (i + 0.5)).toFixed(1) + ',' + Y(v)); });
    if (pts.length > 1)
      ma += `<polyline points='${pts.join(' ')}' fill='none' stroke='${maColors[idx]}' stroke-width='1.2' stroke-linejoin='round'/>`;
  });

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>${body}${ma}</svg>`;
  return { type: 'image', src: 'data:image/svg+xml,' + svg, width: w, height: h };
}

export default async function (ctx) {
  const env = ctx.env || {};
  const UP = env.UP_COLOR || '#FF4D4F';
  const DOWN = env.DOWN_COLOR || '#22C55E';
  const GRAY = '#8E8E93';
  const days = Number(env.DAYS) || 30;
  const refreshMin = Number(env.REFRESH) || 10;
  // K线周期：5/15/30/60=分钟K 101=日K 102=周K 103=月K
  const PERIODS = { '5分钟': 5, '15分钟': 15, '30分钟': 30, '60分钟': 60, '日K': 101, '周K': 102, '月K': 103 };
  const periodName = PERIODS[env.KLINE_PERIOD] ? env.KLINE_PERIOD : '日K';
  const klt = PERIODS[periodName];
  const unitWord = periodName === '周K' ? '周' : periodName === '月K' ? '月' : '';
  const isMin = klt < 100;
  const L_OPEN = isMin ? '本根开' : unitWord ? unitWord + '开' : '今开';
  const L_PREV = isMin ? '上根收' : unitWord ? '上' + unitWord + '收' : '昨收';
  const secids = (env.INDEXES || '1.000001,0.399001,0.399006')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const colorOf = (v) => (v > 0 ? UP : v < 0 ? DOWN : GRAY);
  const tint = (hex, a) => hex + a; // 追加透明度，如 '#FF4D4F' + '14'
  const refreshAfter = new Date(Date.now() + refreshMin * 60000).toISOString();
  const fam = ctx.widgetFamily || 'systemMedium';

  const maxCount =
    fam === 'systemSmall' || fam.startsWith('accessory') ? 1 : fam === 'systemMedium' ? 3 : 3;
  const ids = secids.slice(0, maxCount);

  let quotes;
  try {
    quotes = await getQuotes(ctx, ids);
    if (!quotes.length) throw new Error('empty');
  } catch (e) {
    return {
      type: 'widget', padding: 16, refreshAfter,
      children: [
        { type: 'text', text: '行情获取失败', font: { size: 'headline' }, textColor: DOWN },
        { type: 'text', text: String((e && e.message) || e), font: { size: 'caption1' }, textColor: GRAY },
      ],
    };
  }

  const klines = await Promise.all(quotes.map((q) => getKline(ctx, q.id, klt)));
  const q0 = quotes[0];
  const c0 = colorOf(q0.pct);
  const pctText = (q) => sign(q.pct) + q.pct.toFixed(2) + '%';
  const link = (q) => 'https://quote.eastmoney.com/zs' + q.code + '.html';
  const kOpt = { up: UP, down: DOWN };

  // ---------- 锁屏 ----------
  if (fam === 'accessoryInline') {
    return { type: 'widget', refreshAfter, children: [{ type: 'text', text: `${q0.name} ${fmt(q0.price)} ${pctText(q0)}` }] };
  }
  if (fam === 'accessoryCircular') {
    return {
      type: 'widget', refreshAfter, padding: 4, gap: 2,
      children: [
        { type: 'text', text: q0.name.slice(0, 2), font: { size: 10 }, textAlign: 'center' },
        { type: 'text', text: pctText(q0), font: { size: 12, weight: 'bold' }, minScale: 0.5, maxLines: 1 },
      ],
    };
  }
  if (fam === 'accessoryRectangular') {
    return {
      type: 'widget', refreshAfter, gap: 2,
      children: [
        {
          type: 'stack', direction: 'row',
          children: [
            { type: 'text', text: q0.name, font: { size: 'footnote', weight: 'semibold' } },
            { type: 'spacer' },
            { type: 'text', text: pctText(q0), font: { size: 'footnote', weight: 'bold' } },
          ],
        },
        { type: 'text', text: fmt(q0.price), font: { size: 'headline', weight: 'bold' } },
        kline(klines[0], 16, 120, 18, { up: '#FFFFFF', down: '#9A9A9A' }),
      ],
    };
  }

  // ---------- 通用样式组件 ----------
  const bg = { light: '#FFFFFF', dark: '#1C1C1E' };
  const PANEL_BG = { light: '#F4F6FA', dark: '#2B2B2E' };
  const PANEL_BORDER = { light: '#E1E5EC', dark: '#3C3C40' };

  // 彩色胶囊（涨跌幅）
  const pill = (text, color, size) => ({
    type: 'stack', direction: 'row', alignItems: 'center',
    padding: [1, 6], backgroundColor: color, borderRadius: 6,
    children: [{ type: 'text', text, font: { size: size || 11, weight: 'bold' }, textColor: '#FFFFFF', maxLines: 1 }],
  });

  // K线面板：带边框的浅色底。注意：用 spacer 撑满宽度、让图居中
  const chartPanel = (k, n, w, h, opt, radius) => ({
    type: 'stack', direction: 'row', alignItems: 'center',
    padding: [4, 4], backgroundColor: PANEL_BG, borderWidth: 1, borderColor: PANEL_BORDER,
    borderRadius: radius || 8,
    children: [{ type: 'spacer' }, kline(k, n, w, h, opt), { type: 'spacer' }],
  });

  const footer = {
    type: 'stack', direction: 'row',
    children: [
      { type: 'text', text: 'A股 · ' + periodName, font: { size: 'caption2', weight: 'semibold' }, textColor: GRAY },
      { type: 'spacer' },
      { type: 'date', date: new Date().toISOString(), format: 'time', font: { size: 'caption2' }, textColor: GRAY },
    ],
  };

  // ---------- 小尺寸 ----------
  if (fam === 'systemSmall') {
    return {
      type: 'widget', padding: 12, gap: 4, backgroundColor: bg, refreshAfter, url: link(q0),
      children: [
        {
          type: 'stack', direction: 'row', alignItems: 'center',
          children: [
            { type: 'text', text: q0.name, font: { size: 14, weight: 'semibold' }, maxLines: 1, minScale: 0.7 },
            { type: 'spacer' },
            pill(pctText(q0), c0, 11),
          ],
        },
        {
          type: 'stack', direction: 'row', alignItems: 'center',
          children: [
            { type: 'text', text: fmt(q0.price), font: { size: 22, weight: 'bold' }, textColor: c0, minScale: 0.6, maxLines: 1 },
            { type: 'spacer' },
          ],
        },
        { type: 'spacer' },
        chartPanel(klines[0], Math.min(days, 24), 112, 44, kOpt, 10),
      ],
    };
  }

  // ---------- 列表行（卡片） ----------
  // 注意：固定宽度的 stack 会让内容居中，所以内部每行都用 spacer 撑满，保证左/右对齐
  const row = (q, k) => {
    const c = colorOf(q.pct);
    return {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
      padding: [4, 8], borderRadius: 10, borderWidth: 1,
      backgroundColor: tint(c, '12'), borderColor: tint(c, '45'),
      url: link(q),
      children: [
        {
          type: 'stack', direction: 'column', gap: 1, width: 64,
          children: [
            { type: 'stack', direction: 'row', children: [
              { type: 'text', text: q.name, font: { size: 14, weight: 'semibold' }, maxLines: 1, minScale: 0.7 },
              { type: 'spacer' },
            ] },
            { type: 'stack', direction: 'row', children: [
              { type: 'text', text: q.code, font: { size: 11 }, textColor: GRAY },
              { type: 'spacer' },
            ] },
          ],
        },
        { type: 'spacer' },
        chartPanel(k, days, 88, 26, kOpt, 6),
        { type: 'spacer' },
        {
          type: 'stack', direction: 'column', gap: 2, width: 76,
          children: [
            { type: 'stack', direction: 'row', children: [
              { type: 'spacer' },
              { type: 'text', text: fmt(q.price), font: { size: 14, weight: 'bold' }, textColor: c, maxLines: 1, minScale: 0.7 },
            ] },
            { type: 'stack', direction: 'row', children: [
              { type: 'spacer' },
              pill(pctText(q), c, 11),
            ] },
          ],
        },
      ],
    };
  };

  // ---------- 中尺寸 ----------
  if (fam === 'systemMedium') {
    return {
      type: 'widget', padding: [10, 12], gap: 5, backgroundColor: bg, refreshAfter,
      children: quotes.map((q, i) => row(q, klines[i])),
    };
  }

  // ---------- 大尺寸 ----------
  const k0 = klines[0];
  const last = k0[k0.length - 1];
  const prev = k0[k0.length - 2];
  const children = [];

  // 头部卡片
  children.push({
    type: 'stack', direction: 'row', alignItems: 'center',
    padding: [6, 10], borderRadius: 12, borderWidth: 1,
    backgroundColor: tint(c0, '12'), borderColor: tint(c0, '45'),
    url: link(q0),
    children: [
      {
        type: 'stack', direction: 'column', alignItems: 'start', gap: 1,
        children: [
          { type: 'text', text: q0.name, font: { size: 16, weight: 'bold' } },
          { type: 'text', text: q0.code, font: { size: 11 }, textColor: GRAY },
        ],
      },
      { type: 'spacer' },
      {
        type: 'stack', direction: 'column', alignItems: 'end', gap: 2,
        children: [
          { type: 'text', text: fmt(q0.price), font: { size: 22, weight: 'bold' }, textColor: c0 },
          pill(`${sign(q0.chg)}${q0.chg.toFixed(2)}  ${pctText(q0)}`, c0, 11),
        ],
      },
    ],
  });

  // K线面板 + 均线图例
  const legend = (t, col) => ({ type: 'text', text: t, font: { size: 10, weight: 'medium' }, textColor: col });
  children.push({
    type: 'stack', direction: 'column', alignItems: 'center', gap: 3,
    padding: [5, 5], backgroundColor: PANEL_BG, borderWidth: 1, borderColor: PANEL_BORDER, borderRadius: 10,
    children: [
      { type: 'stack', direction: 'row', children: [
        { type: 'spacer' },
        kline(k0, 50, 292, 80, { up: UP, down: DOWN, ma: [5, 10, 20] }),
        { type: 'spacer' },
      ] },
      { type: 'stack', direction: 'row', gap: 10, children: [
        { type: 'spacer' },
        legend('MA5', '#F5A623'), legend('MA10', '#4DA3FF'), legend('MA20', '#B58CFF'),
        { type: 'spacer' },
      ] },
    ],
  });

  // 数据卡片：今开 / 最高 / 最低 / 昨收（等分）
  if (last && prev) {
    const stat = (label, val, col) => ({
      type: 'stack', direction: 'column', alignItems: 'center', gap: 2, flex: 1,
      padding: [4, 2], borderRadius: 8, borderWidth: 1,
      backgroundColor: tint(col, '12'), borderColor: tint(col, '40'),
      children: [
        { type: 'text', text: label, font: { size: 10 }, textColor: GRAY },
        { type: 'text', text: fmt(val), font: { size: 12, weight: 'bold' }, textColor: col === GRAY ? undefined : col, maxLines: 1, minScale: 0.6 },
      ],
    });
    children.push({
      type: 'stack', direction: 'row', gap: 5,
      children: [
        stat(L_OPEN, last.o, GRAY),
        stat('最高', last.h, UP),
        stat('最低', last.l, DOWN),
        stat(L_PREV, prev.c, GRAY),
      ],
    });
  }

  quotes.slice(1).forEach((q, i) => children.push(row(q, klines[i + 1])));

  children.push({ type: 'spacer' });
  children.push(footer);

  return {
    type: 'widget', padding: 12, gap: 5, backgroundColor: bg, refreshAfter, children,
  };
}
