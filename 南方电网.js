/**
 * 南方电网用电小组件 · 近 10 日电量柱版 v5
 * ==========================================
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
/**
 * 南方电网用电小组件 · iOS 日夜模式适配版 v7
 * ==========================================
 * 适用：Egern 中号组件
 *
 * 功能：
 * - 自动捕获 Token
 * - 昨日用电、本月累计、上月用电
 * - 近10日用电柱状图
 * - 自动适配 iOS 浅色/深色模式
 * - 浅色模式使用白色背景
 * - 加宽柱状图柱体
 * - 每小时刷新
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

  if (!url.includes("95598.csg.cn")) return;

  const token = String(
    getRequestHeader(req.headers, "x-auth-token") || ""
  ).trim();

  if (!token) return;

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

  // ── 日夜模式配色 ────────────────────────────────────────
  // light 为白天模式，dark 为夜间模式。
  // 不再将两个模式设置成相同的深色背景。

  const C = {
    bg: {
      light: "#FFFFFF",
      dark: "#091521",
    },

    card1: {
      light: "#E8F8F6",
      dark: "#123747",
    },

    card2: {
      light: "#EAF3FF",
      dark: "#142F50",
    },

    card3: {
      light: "#E9F8EF",
      dark: "#15363F",
    },

    panel: {
      light: "#F2F8FC",
      dark: "#0E293A",
    },

    main: {
      light: "#203343",
      dark: "#F1F8FF",
    },

    muted: {
      light: "#627D91",
      dark: "#9ABAD1",
    },

    faint: {
      light: "#8CA5B7",
      dark: "#729BB7",
    },

    border: {
      light: "#D8E5ED",
      dark: "#20475D",
    },

    teal: {
      light: "#0BAE9B",
      dark: "#35E5D0",
    },

    blue: {
      light: "#248DE0",
      dark: "#49ACFF",
    },

    green: {
      light: "#25A96B",
      dark: "#75EAA9",
    },

    red: {
      light: "#D9414D",
      dark: "#FF7178",
    },

    bar: {
      light: "#39A9D1",
      dark: "#249BC7",
    },

    barToday: {
      light: "#12BFA9",
      dark: "#2CE0C5",
    },

    barEmpty: {
      light: "#DDEAF1",
      dark: "#18394B",
    },
  };

  // ── 时间及缓存 ──────────────────────────────────────────

  const P = n => (n < 10 ? `0${n}` : `${n}`);

  const now = new Date();

  const ym =
    `${now.getFullYear()}${P(now.getMonth() + 1)}`;

  const lastMoDate = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  const ymLast =
    `${lastMoDate.getFullYear()}${P(lastMoDate.getMonth() + 1)}`;

  const timeStr =
    `${P(now.getHours())}:${P(now.getMinutes())}`;

  const refreshAt =
    new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const KEY_DAILY = "csg_daily_v3";

  let dailyHist = ctx.storage.getJSON(KEY_DAILY) || {};

  // ── 默认数据 ────────────────────────────────────────────

  let yst = "--";
  let total = "--";
  let lastMo = "--";
  let errMsg = null;

  // ── 网络请求 ────────────────────────────────────────────

  if (!token) {
    errMsg = "请在环境变量中填写 Token";
  } else {
    try {
      const H = {
        "x-auth-token": token,
        "Content-Type": "application/json",
      };

      // 1. 查询绑定户号

      const uJson = await (
        await ctx.http.post(
          "https://95598.csg.cn/ucs/ma/zt/eleCustNumber/queryBindEleUsers",
          {
            headers: H,
            body: "{}",
            timeout: 10000,
          }
        )
      ).json();

      const u = uJson?.data?.[0];

      if (!u) {
        throw new Error("未找到绑定用户");
      }

      const base = {
        areaCode: u.areaCode,
        eleCustId: u.bindingId,
      };

      const mpt = u.meteringPointId;

      // 2. 查询本月逐日用电

      const pJson = await (
        await ctx.http.post(
          "https://95598.csg.cn/ucs/ma/zt/charge/queryDayElectricByMPoint",
          {
            headers: H,
            body: JSON.stringify({
              ...base,
              yearMonth: ym,
              meteringPointId: mpt,
            }),
            timeout: 10000,
          }
        )
      ).json();

      if (pJson?.data) {
        const tot = pJson.data.totalPower;
        const list = pJson.data.result || [];

        if (tot != null) {
          total = parseFloat(tot).toFixed(1);
        }

        list.forEach(item => {
          if (item.date && item.power != null) {
            dailyHist[item.date] = parseFloat(item.power);
          }
        });

        if (list.length > 0) {
          const last = list[list.length - 1];

          if (last.power != null) {
            yst = parseFloat(last.power).toFixed(1);
          }
        }

        ctx.storage.setJSON(KEY_DAILY, dailyHist);
      }

      // 3. 查询上月用电

      const lJson = await (
        await ctx.http.post(
          "https://95598.csg.cn/ucs/ma/zt/charge/queryDayElectricByMPoint",
          {
            headers: H,
            body: JSON.stringify({
              ...base,
              yearMonth: ymLast,
              meteringPointId: mpt,
            }),
            timeout: 10000,
          }
        )
      ).json();

      if (lJson?.data?.totalPower != null) {
        lastMo = String(
          Math.round(parseFloat(lJson.data.totalPower))
        );
      }
    } catch (e) {
      errMsg = e.message || "请求失败";
    }
  }

  // ── 近10日数据 ──────────────────────────────────────────

  const last10 = [];

  for (let i = 9; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 86400000);

    const ds =
      `${dt.getFullYear()}-${P(dt.getMonth() + 1)}-${P(dt.getDate())}`;

    last10.push({
      label: String(dt.getDate()),
      val: dailyHist[ds] ?? null,
      isToday: i === 0,
    });
  }

  const maxDay = Math.max(
    ...last10.map(x => x.val ?? 0),
    0.01
  );

  // ── 顶部标题栏 ──────────────────────────────────────────

  const topBar = {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 5,

    children: [
      {
        type: "image",
        src: "sf-symbol:bolt.square.fill",
        color: C.teal,
        width: 10,
        height: 10,
      },

      {
        type: "text",
        text: "南方电网",
        font: {
          size: "subheadline",
          weight: "semibold",
        },
        textColor: C.main,
        maxLines: 1,
      },

      {
        type: "spacer",
      },

      {
        type: "image",
        src: "sf-symbol:arrow.clockwise",
        color: C.faint,
        width: 9,
        height: 9,
      },

      {
        type: "text",
        text: timeStr,
        font: {
          size: 9,
          weight: "medium",
        },
        textColor: C.muted,
        maxLines: 1,
      },
    ],
  };

  // ── 错误状态 ────────────────────────────────────────────

  if (errMsg) {
    return {
      type: "widget",
      backgroundColor: C.bg,
      padding: [7, 9, 7, 9],
      gap: 7,
      refreshAfter: refreshAt,

      children: [
        topBar,

        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,

          padding: [7, 9, 7, 9],
          backgroundColor: C.panel,
          borderRadius: 10,

          children: [
            {
              type: "image",
              src: "sf-symbol:exclamationmark.triangle.fill",
              color: C.red,
              width: 12,
              height: 12,
            },

            {
              type: "text",
              text: errMsg,
              font: {
                size: 10,
              },
              textColor: C.red,
              maxLines: 2,
              flex: 1,
            },
          ],
        },
      ],
    };
  }

  // ── 三栏数据卡片 ────────────────────────────────────────

  function capsule(icon, iconColor, label, value, cardColor) {
    return {
      type: "stack",
      direction: "column",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      gap: 4,

      padding: [6, 2, 6, 2],

      backgroundColor: cardColor,
      borderRadius: 11,

      borderWidth: 0.6,
      borderColor: C.border,

      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,

          children: [
            {
              type: "image",
              src: `sf-symbol:${icon}`,
              color: iconColor,
              width: 10,
              height: 10,
            },

            {
              type: "text",
              text: label,
              font: {
                size: 8,
                weight: "medium",
              },
              textColor: C.muted,
              maxLines: 1,
            },
          ],
        },

        {
          type: "stack",
          direction: "row",
          alignItems: "end",
          justifyContent: "center",
          gap: 2,

          children: [
            {
              type: "text",
              text: String(value),
              font: {
                size: 16,
                weight: "bold",
              },
              textColor: C.main,
              maxLines: 1,
              minScale: 0.6,
            },

            {
              type: "text",
              text: "度",
              font: {
                size: 8,
              },
              textColor: C.muted,
              maxLines: 1,
            },
          ],
        },
      ],
    };
  }

  // ── 柱状图参数 ──────────────────────────────────────────

  const BAR_MAX = 19;

  // 柱宽从10增加到14，保持组件高度不变

  const BAR_WIDTH = 14;

  const bars = last10.map(item => {
    const ratio =
      item.val != null ? item.val / maxDay : 0;

    const barH =
      item.val != null
        ? Math.max(Math.round(ratio * BAR_MAX), 3)
        : 3;

    const intVal =
      item.val != null ? Math.floor(item.val) : null;

    return {
      type: "stack",
      direction: "column",
      alignItems: "center",
      justifyContent: "end",
      flex: 1,
      gap: 2,

      children: [
        // 每日用电量

        {
          type: "text",
          text: intVal != null ? String(intVal) : " ",
          font: {
            size: 7,
            weight: "medium",
          },
          textColor: item.isToday ? C.teal : C.muted,
          maxLines: 1,
        },

        // 柱体

        {
          type: "stack",
          direction: "column",
          width: BAR_WIDTH,
          height: barH,

          backgroundColor:
            item.val == null
              ? C.barEmpty
              : item.isToday
                ? C.barToday
                : C.bar,

          borderRadius: 4,

          children: [],
        },

        // 日期

        {
          type: "text",
          text: item.label,
          font: {
            size: 8,
            weight: item.isToday ? "bold" : "medium",
          },
          textColor: item.isToday ? C.teal : C.muted,
          maxLines: 1,
        },
      ],
    };
  });

  // ── 图表面板 ────────────────────────────────────────────

  const chartPanel = {
    type: "stack",
    direction: "column",
    gap: 5,

    padding: [8, 9, 7, 9],

    backgroundColor: C.panel,
    borderRadius: 12,

    borderWidth: 0.6,
    borderColor: C.border,

    children: [
      // 图表标题及峰值

      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 4,

        children: [
          {
            type: "image",
            src: "sf-symbol:chart.bar.fill",
            color: C.blue,
            width: 11,
            height: 11,
          },

          {
            type: "text",
            text: "近10日用电",
            font: {
              size: 10,
              weight: "semibold",
            },
            textColor: C.main,
            maxLines: 1,
          },

          {
            type: "spacer",
          },

          {
            type: "text",
            text: "峰值",
            font: {
              size: 8,
            },
            textColor: C.muted,
            maxLines: 1,
          },

          {
            type: "text",
            text: maxDay >= 0.1 ? maxDay.toFixed(1) : "--",
            font: {
              size: 11,
              weight: "bold",
            },
            textColor: C.teal,
            maxLines: 1,
          },

          {
            type: "text",
            text: "度",
            font: {
              size: 8,
            },
            textColor: C.muted,
            maxLines: 1,
          },
        ],
      },

      // 柱状图主体：保持原高度

      {
        type: "stack",
        direction: "row",
        alignItems: "end",
        height: BAR_MAX + 21,
        gap: 2,

        children: bars,
      },
    ],
  };

  // ── 最终布局 ────────────────────────────────────────────

  return {
    type: "widget",

    backgroundColor: C.bg,

    padding: [7, 9, 7, 9],

    gap: 7,

    refreshAfter: refreshAt,

    children: [
      topBar,

      {
        type: "stack",
        direction: "row",
        gap: 6,

        children: [
          capsule(
            "sun.max.fill",
            C.teal,
            "昨日用电",
            yst,
            C.card1
          ),

          capsule(
            "calendar",
            C.blue,
            "本月累计",
            total,
            C.card2
          ),

          capsule(
            "clock.arrow.circlepath",
            C.green,
            "上月用电",
            lastMo,
            C.card3
          ),
        ],
      },

      chartPanel,
    ],
  };
}
