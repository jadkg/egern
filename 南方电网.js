/**
 * 南方电网用电小组件 · 近 10 日电量柱版 v3
 * ==========================================
 * 环境变量：Token = "eyJhbGci..."
 *
 * 布局（仅 Medium）:
 * ┌─────────────────────────────────┐
 * │ ⚡ 南方电网         ↺ 08:30   │
 * ├──────────┬──────────┬───────────┤
 * │ ☀ 昨日  │ 📅 本月  │ ⏮ 上月  │
 * │  3.2 度  │ 68.4 度  │  112 度   │
 * ├─────────────────────────────────┤
 * │ 近10日用电 ············ 峰值 x  │
 * │  ▇  ▄  ▅  ▆  ▂  ▇  ▅  ▄  ▆  █ │
 * │  26 27 28 29 30  1  2  3  4  5 │
 * └─────────────────────────────────┘
 */
// ── 自动捕获南方电网 Token ────────────────────────────────
function getRequestHeader(headers, name) {
  if (!headers) return "";

  try {
    if (typeof headers.get === "function") {
      return headers.get(name) || "";
    }
  } catch (e) {}

  try {
    for (const key of Object.keys(headers)) {
      if (String(key).toLowerCase() === name.toLowerCase()) {
        return headers[key] || "";
      }
    }
  } catch (e) {}

  return "";
}

async function handleCapture(ctx) {
  const req = ctx.request || {};
  const url = String(req.url || "");

  // 只捕获南方电网的请求
  if (!url.includes("95598.csg.cn")) return;

  const token = String(
    getRequestHeader(req.headers, "x-auth-token") || ""
  ).trim();

  if (!token) return;

  // Token 未变化时不重复保存
  const oldToken = ctx.storage.get("csg_token") || "";
  if (token === oldToken) return;

  ctx.storage.set("csg_token", token);

  try {
    ctx.notify({
      title: "南方电网",
      body: "已自动获取登录信息，小组件将自动更新",
    });
  } catch (e) {}
}
export default async function (ctx) {
  const token =
  (ctx.env.Token || "").trim() ||
  (ctx.storage.get("csg_token") || "").trim();

  // ── 配色方案 ─────────────────────────────────────
  const C = {
    bg:      { light: "#F0F4F5", dark: "#0C0F12" },
    cardBg:  { light: "#E6ECEE", dark: "#131820" },
    panelBg: { light: "#D8E2E622", dark: "#6A9EB80E" },
    main:    { light: "#1A2530", dark: "#EEF2F4" },
    muted:   { light: "#6A7A88", dark: "#7A9AAA" },
    faint:   { light: "#9AACB8", dark: "#3A5060" },
    divider: { light: "#C8D4DA", dark: "#1E2C38" },
    gold:    { light: "#A07D60", dark: "#C8A878" }, // 赭石
    teal:    { light: "#5AA8A0", dark: "#7ABFB8" }, // 石青
    blue:    { light: "#4F88A8", dark: "#6A9EB8" }, // 花青
    green:   { light: "#5E9070", dark: "#7AA88C" }, // 石绿
    // 柱体
    barHi:   { light: "#5AA8A0CC", dark: "#7ABFB8CC" },
    barNorm: { light: "#4F88A838", dark: "#6A9EB835" },
    barBg:   { light: "#C8D4DA28", dark: "#22303828" },
    // 柱内字
    lblHi:   { light: "#FFFFFFEE", dark: "#061010EE" },
    lblNorm: { light: "#4F88A8BB", dark: "#7ABFB8AA" },
  };

  // ── 工具 ─────────────────────────────────────────────────
  const P   = n => (n < 10 ? `0${n}` : `${n}`);
  const now = new Date();
  const ym  = `${now.getFullYear()}${P(now.getMonth() + 1)}`;
  const lastMoDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ymLast = `${lastMoDate.getFullYear()}${P(lastMoDate.getMonth() + 1)}`;
  const timeStr   = `${P(now.getHours())}:${P(now.getMinutes())}`;
  const refreshAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const KEY_DAILY = "csg_daily_v3";

  let dailyHist = ctx.storage.getJSON(KEY_DAILY) || {};

  // ── 数据默认值 ───────────────────────────────────────────
  let yst    = "--";
  let total  = "--";
  let lastMo = "--";
  let errMsg = null;

  // ── 网络请求 ─────────────────────────────────────────────
  if (!token) {
    errMsg = "请在环境变量中填写 Token";
  } else {
    try {
      const H = { "x-auth-token": token, "Content-Type": "application/json" };

      // 1. 获取绑定户号
      const uJson = await (await ctx.http.post(
        "https://95598.csg.cn/ucs/ma/zt/eleCustNumber/queryBindEleUsers",
        { headers: H, body: "{}", timeout: 10000 }
      )).json();
      const u = uJson?.data?.[0];
      if (!u) throw new Error("未找到绑定用户");
      const base = { areaCode: u.areaCode, eleCustId: u.bindingId };
      const mpt  = u.meteringPointId;

      // 2. 本月逐日用电
      const pJson = await (await ctx.http.post(
        "https://95598.csg.cn/ucs/ma/zt/charge/queryDayElectricByMPoint",
        { headers: H, body: JSON.stringify({ ...base, yearMonth: ym, meteringPointId: mpt }), timeout: 10000 }
      )).json();
      if (pJson?.data) {
        const tot  = pJson.data.totalPower;
        const list = pJson.data.result || [];
        if (tot != null) total = parseFloat(tot).toFixed(1);
        list.forEach(item => {
          if (item.date && item.power != null)
            dailyHist[item.date] = parseFloat(item.power);
        });
        if (list.length > 0) {
          const last = list[list.length - 1];
          if (last.power != null) yst = parseFloat(last.power).toFixed(1);
        }
        ctx.storage.setJSON(KEY_DAILY, dailyHist);
      }

      // 3. 上月用电总量
      const lJson = await (await ctx.http.post(
        "https://95598.csg.cn/ucs/ma/zt/charge/queryDayElectricByMPoint",
        { headers: H, body: JSON.stringify({ ...base, yearMonth: ymLast, meteringPointId: mpt }), timeout: 10000 }
      )).json();
      if (lJson?.data?.totalPower != null) {
        lastMo = String(Math.round(parseFloat(lJson.data.totalPower)));
      }

    } catch (e) {
      errMsg = e.message || "请求失败";
    }
  }

  // ── 近10日数据 ───────────────────────────────────────────
  const last10 = [];
  for (let i = 9; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 86400000);
    const ds = `${dt.getFullYear()}-${P(dt.getMonth() + 1)}-${P(dt.getDate())}`;
    last10.push({
      label:   String(dt.getDate()),
      val:     dailyHist[ds] ?? null,
      isToday: i === 0,
    });
  }
  const maxDay = Math.max(...last10.map(x => x.val ?? 0), 0.01);

  // ── DSL 构建 ─────────────────────────────────────────────

  // 顶栏
  const topBar = {
    type: "stack", direction: "row", alignItems: "center", gap: 5,
    children: [
      { type: "image", src: "sf-symbol:bolt.square.fill", color: C.gold, width: 14, height: 14 },
      { type: "text", text: "南方电网", font: { size: "subheadline", weight: "semibold" }, textColor: C.main },
      { type: "spacer" },
      { type: "image", src: "sf-symbol:arrow.clockwise", color: C.faint, width: 10, height: 10 },
      { type: "spacer", length: 2 },
      { type: "text", text: timeStr, font: { size: 9 }, textColor: C.muted },
    ],
  };

  // 错误视图
  if (errMsg) {
    return {
      type: "widget", backgroundColor: C.bg, padding: [14, 14, 14, 14],
      gap: 10, refreshAfter: refreshAt,
      children: [
        topBar,
        {
          type: "stack", direction: "row", alignItems: "center", gap: 6,
          padding: [10, 12, 10, 12], backgroundColor: C.cardBg, borderRadius: 10,
          children: [
            { type: "image", src: "sf-symbol:exclamationmark.triangle.fill",
              color: { light: "#905E5E", dark: "#A87878" }, width: 13, height: 13 },
            { type: "text", text: errMsg, font: { size: "caption1" },
              textColor: { light: "#905E5E", dark: "#A87878" }, maxLines: 2, flex: 1 },
          ],
        },
        { type: "spacer" },
      ],
    };
  }

  // 数据胶囊
  function capsule(icon, iconColor, label, value, unit) {
    return {
      type: "stack", direction: "column", alignItems: "center",
      flex: 1, gap: 4,
      padding: [6, 4, 6, 4], // 调小上下内边距
      backgroundColor: C.cardBg,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: C.divider,
      children: [
        {
          type: "stack", direction: "row", alignItems: "center", gap: 3,
          children: [
            { type: "image", src: `sf-symbol:${icon}`, color: iconColor, width: 10, height: 10 },
            { type: "text", text: label, font: { size: 9, weight: "medium" }, textColor: C.muted, maxLines: 1 },
          ],
        },
        {
          type: "stack", direction: "row", alignItems: "end", gap: 2,
          children: [
            { type: "text", text: value, font: { size: 18, weight: "semibold" }, textColor: C.main, maxLines: 1, minScale: 0.6 },
            { type: "text", text: unit, font: { size: 9 }, textColor: C.muted, maxLines: 1 },
          ],
        },
      ],
    };
  }

  // 近10日柱状图参数
  const BAR_MAX = 34; // 调低柱状图最大高度释放空间
  const INSIDE_MIN = 12;
  const ABOVE_MIN  = 6;

  const bars = last10.map(item => {
    const ratio  = item.val != null ? item.val / maxDay : 0;
    const barH   = item.val != null ? Math.max(Math.round(ratio * BAR_MAX), 3) : 0;
    const intVal = item.val != null ? Math.floor(item.val) : null;

    const showInside = barH >= INSIDE_MIN && intVal != null;
    const showAbove  = barH >= ABOVE_MIN && barH < INSIDE_MIN && intVal != null;

    return {
      type: "stack", direction: "column", alignItems: "center",
      flex: 1, gap: 0,
      children: [
        {
          type: "text",
          text: showAbove ? `${intVal}` : " ",
          font: { size: 7, weight: "medium" },
          textColor: item.isToday ? C.teal : C.faint,
          maxLines: 1,
        },
        { type: "spacer" },
        {
          type: "stack", direction: "column", alignItems: "center",
          width: 11, height: barH > 0 ? barH : 2,
          backgroundColor: barH > 0 ? (item.isToday ? C.barHi : C.barNorm) : C.barBg,
          borderRadius: 3,
          children: showInside ? [
            { type: "spacer" },
            {
              type: "text",
              text: `${intVal}`,
              font: { size: 7, weight: "semibold" },
              textColor: item.isToday ? C.lblHi : C.lblNorm,
              maxLines: 1,
            },
            { type: "spacer", length: 2 },
          ] : [],
        },
        {
          type: "text",
          text: item.label,
          font: { size: 8, weight: item.isToday ? "semibold" : "regular" },
          textColor: item.isToday ? C.teal : C.muted,
          maxLines: 1,
        },
      ],
    };
  });

  const chartPanel = {
    type: "stack", direction: "column", gap: 6, // 调整内部间距
    padding: [8, 9, 8, 9], // 调整内边距
    backgroundColor: C.panelBg,
    borderRadius: 9,
    children: [
      {
        type: "stack", direction: "row", alignItems: "center", gap: 4,
        children: [
          { type: "image", src: "sf-symbol:chart.bar.fill", color: C.blue, width: 10, height: 10 },
          { type: "text", text: "近10日用电", font: { size: 10, weight: "medium" }, textColor: C.muted },
          { type: "spacer" },
          {
            type: "text",
            text: `峰值 ${maxDay >= 0.1 ? maxDay.toFixed(1) : "--"} 度`,
            font: { size: 9 }, textColor: C.faint,
          },
        ],
      },
      {
        type: "stack", direction: "row", alignItems: "end",
        height: BAR_MAX + 16, 
        gap: 3,
        children: bars,
      },
    ],
  };

  // ── Medium 布局 ──────────────────────────────────────────
  return {
    type: "widget",
    backgroundColor: C.bg,
    padding: [12, 14, 12, 14], // 恢复外边距
    gap: 10, // 增加模块间距
    refreshAfter: refreshAt,
    children: [
      topBar,
      {
        type: "stack", direction: "row", gap: 8,
        children: [
          capsule("sun.and.horizon",        C.teal,  "昨日用电", yst,    "度"),
          capsule("calendar",               C.blue,  "本月累计", total,  "度"),
          capsule("clock.arrow.circlepath", C.green, "上月用电", lastMo, "度"),
        ],
      },
      chartPanel,
    ],
  };
}
