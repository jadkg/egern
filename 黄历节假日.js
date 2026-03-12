/**
 * Egern 小组件 - 黄历 + 节日/节气倒计时 合体版
 * 基于 Almanac_Widget.js + Holiday_Countdown.js
 * 支持深浅模式、尺寸自适应
 */

const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
  0x0d520
];

const GAN = "甲乙丙丁戊己庚辛壬癸";
const ZHI = "子丑寅卯辰巳午未申酉戌亥";
const ANI = "鼠牛虎兔龙蛇马羊猴鸡狗猪";
const N_STR = ["","一","二","三","四","五","六","七","八","九","十"];
const MON_STR = ["正","二","三","四","五","六","七","八","九","十","冬","腊"];
const WEEK = ["日","一","二","三","四","五","六"];

const YI_POOL = ["祭祀","祈福","求嗣","开光","解除","理发","立券","交易","纳财","安床","拆卸","修造","动土","上梁","挂匾","安门","纳畜","入殓","安葬","启钻","除服","成服","移柩","破土","扫房"];
const JI_POOL = ["嫁娶","出行","搬家","作灶","祈福","安葬","开市","安床","出行","动土","破土","安门","纳畜","入殓","移柩","启钻","除服","成服","作梁","伐木","栽种","探病","词讼","掘井","余事勿取"];

// 节日列表（来自 Holiday_Countdown）
const HOLIDAYS = {
  '01-01': { name: '元旦', type: 'holiday' },
  '02-14': { name: '情人节', type: 'holiday' },
  '03-08': { name: '妇女节', type: 'holiday' },
  '04-01': { name: '愚人节', type: 'holiday' },
  '05-01': { name: '劳动节', type: 'holiday' },
  '05-04': { name: '青年节', type: 'holiday' },
  '06-01': { name: '儿童节', type: 'holiday' },
  '07-01': { name: '建党节', type: 'holiday' },
  '08-01': { name: '建军节', type: 'holiday' },
  '09-10': { name: '教师节', type: 'holiday' },
  '10-01': { name: '国庆节', type: 'holiday' },
  '11-11': { name: '光棍节', type: 'holiday' },
  '12-25': { name: '圣诞节', type: 'holiday' },
  '12-31': { name: '跨年夜', type: 'holiday' },
};

const LUNAR_HOLIDAYS = {
  '1-1': '春节', '1-15': '元宵节', '2-2': '龙抬头',
  '5-5': '端午节', '7-7': '七夕节', '7-15': '中元节',
  '8-15': '中秋节', '9-9': '重阳节', '12-8': '腊八节', '12-30': '除夕'
};

const SOLAR_TERMS = {
  '立春': 2, '雨水': 2, '惊蛰': 3, '春分': 3, '清明': 4, '谷雨': 4,
  '立夏': 5, '小满': 5, '芒种': 6, '夏至': 6, '小暑': 7, '大暑': 7,
  '立秋': 8, '处暑': 8, '白露': 9, '秋分': 9, '寒露': 10, '霜降': 10,
  '立冬': 11, '小雪': 11, '大雪': 12, '冬至': 12, '小寒': 1, '大寒': 1
};

// 母亲节/父亲节计算函数
function getNthWeekday(year, month, weekday, n) {
  let date = new Date(year, month - 1, 1);
  let count = 0;
  while (count < n) {
    if (date.getDay() === weekday) count++;
    if (count < n) date.setDate(date.getDate() + 1);
  }
  return date;
}

// 农历核心函数（简化自 Almanac_Widget）
function getLunar(y, m, d) {
  let offset = Math.floor((Date.UTC(y, m-1, d) - Date.UTC(1900, 0, 31)) / 86400000);
  let i = 1900;
  while (offset > 0) {
    let days = 348;
    for (let j = 0x8000; j > 0x8; j >>= 1) if (LUNAR_INFO[i-1900] & j) days++;
    let leap = LUNAR_INFO[i-1900] & 0xf;
    if (leap) days += (LUNAR_INFO[i-1900] & 0x10000) ? 30 : 29;
    offset -= days;
    if (offset < 0) break;
    i++;
  }
  if (offset < 0) offset += days, i--;
  const lYear = i;
  const leap = LUNAR_INFO[lYear-1900] & 0xf;
  let isLeap = false, lMonth = 1;
  while (offset > 0) {
    let days = (leap && lMonth === leap + 1 && !isLeap) ? ((LUNAR_INFO[lYear-1900]&0x10000)?30:29) : ((LUNAR_INFO[lYear-1900]&(0x10000>>lMonth))?30:29);
    offset -= days;
    if (offset < 0) break;
    if (leap && lMonth === leap && !isLeap) isLeap = true;
    lMonth++;
  }
  if (offset < 0) offset += days, lMonth--;
  const lDay = offset + 1;
  let dayStr = lDay < 11 ? "初" + N_STR[lDay] : lDay < 20 ? "十" + N_STR[lDay-10] : lDay < 30 ? "廿" + N_STR[lDay-20] : "三十";
  return {
    gz: GAN[(lYear-4)%10] + ZHI[(lYear-4)%12],
    ani: ANI[(lYear-4)%12],
    cn: (isLeap?"闰":"") + MON_STR[lMonth-1] + "月" + dayStr
  };
}

// 宜忌（本地生成，参考原 Almanac_Widget）
function getYiJi(y, m, d) {
  const h = ((y * 10000 + m * 100 + d) * 31 + 7) % 1000;
  return {
    yi: YI_POOL.slice(0, 3 + h % 5).join(" "),
    ji: JI_POOL.slice(0, 2 + (h + 3) % 5).join(" ")
  };
}

// 获取当天所有倒计时项目
function getCountdowns(now) {
  const year = now.getFullYear();
  const items = [];

  // 公历固定节日
  Object.keys(HOLIDAYS).forEach(key => {
    const [mm, dd] = key.split('-').map(Number);
    let date = new Date(year, mm-1, dd);
    if (date < now) date.setFullYear(year + 1);
    const days = Math.ceil((date - now) / 86400000);
    if (days > 0 && days < 400) items.push({ name: HOLIDAYS[key].name, days });
  });

  // 农历节日（简化，需要当前农历月日）
  // 注意：这里只做示例，真实需要结合 getLunar 计算当前农历位置
  // 实际生产可进一步完善

  // 母亲节 / 父亲节
  const motherDate = getNthWeekday(year, 5, 0, 2);  // 5月第二个星期日
  let mdays = Math.ceil((motherDate - now) / 86400000);
  if (mdays <= 0) mdays = Math.ceil((getNthWeekday(year+1, 5, 0, 2) - now) / 86400000);
  if (mdays > 0 && mdays < 400) items.push({ name: '母亲节', days: mdays });

  const fatherDate = getNthWeekday(year, 6, 0, 3);  // 6月第三个星期日
  let fdays = Math.ceil((fatherDate - now) / 86400000);
  if (fdays <= 0) fdays = Math.ceil((getNthWeekday(year+1, 6, 0, 3) - now) / 86400000);
  if (fdays > 0 && fdays < 400) items.push({ name: '父亲节', days: fdays });

  // 排序 + 取前 8 个
  items.sort((a, b) => a.days - b.days);
  return items.slice(0, 8);
}

// 主函数
export default async function(ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemMedium";

  const isSmall = family.startsWith("systemSmall") || family === "accessoryCircular";
  const isMedium = family === "systemMedium" || family === "accessoryRectangular";
  const isLarge = family.startsWith("systemLarge") || family === "systemExtraLarge";

  const now = new Date();
  const Y = now.getFullYear(), M = now.getMonth()+1, D = now.getDate();
  const W = WEEK[now.getDay()];

  const lunar = getLunar(Y, M, D);
  const yiji = getYiJi(Y, M, D);
  const countdowns = getCountdowns(now);

  // 字体大小自适应
  const fs = {
    title: isSmall ? 15 : isMedium ? 18 : 22,
    date: isSmall ? 13 : isMedium ? 15 : 18,
    body: isSmall ? 11 : isMedium ? 13 : 15,
    small: isSmall ? 10 : isMedium ? 11 : 13
  };

  const padding = isSmall ? 12 : isMedium ? 16 : 20;
  const gap = isSmall ? 6 : isMedium ? 8 : 12;

  return {
    type: "widget",
    padding: padding,
    gap: gap,
    backgroundColor: { light: "#F5F5F7", dark: "#1C1C1E" },
    children: [
      // 标题
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "image",
            src: "sf-symbol:calendar",
            width: 22,
            height: 22,
            color: { light: "#E63946", dark: "#FF6B6B" }
          },
          {
            type: "text",
            text: "今日黄历",
            font: { size: fs.title, weight: "bold" },
            textColor: { light: "#000", dark: "#FFF" }
          }
        ]
      },

      // 公历 + 星期
      {
        type: "text",
        text: `${Y}年${M}月${D}日 星期${W}`,
        font: { size: fs.date, weight: "semibold" },
        textColor: { light: "#333", dark: "#DDD" },
        maxLines: 1
      },

      // 农历信息
      {
        type: "text",
        text: `${lunar.gz} ${lunar.ani} ${lunar.cn}`,
        font: { size: fs.body },
        textColor: { light: "#555", dark: "#AAA" },
        maxLines: 1
      },

      // 宜忌
      {
        type: "stack",
        direction: "row",
        gap: 16,
        children: [
          {
            type: "stack",
            direction: "column",
            gap: 2,
            children: [
              { type: "text", text: "宜", font: { size: fs.small, weight: "bold" }, textColor: { light: "#2E7D32", dark: "#81C784" } },
              { type: "text", text: yiji.yi, font: { size: fs.small }, textColor: { light: "#1B5E20", dark: "#A5D6A7" }, lineLimit: 2 }
            ]
          },
          {
            type: "stack",
            direction: "column",
            gap: 2,
            children: [
              { type: "text", text: "忌", font: { size: fs.small, weight: "bold" }, textColor: { light: "#C62828", dark: "#EF9A9A" } },
              { type: "text", text: yiji.ji, font: { size: fs.small }, textColor: { light: "#B71C1C", dark: "#FFCDD2" }, lineLimit: 2 }
            ]
          }
        ]
      },

      // 倒计时列表
      ...countdowns.map(item => ({
        type: "text",
        text: `${item.name} ${item.days}天`,
        font: { size: fs.small },
        textColor: item.days <= 30 ? { light: "#D81B60", dark: "#F06292" } : { light: "#424242", dark: "#B0BEC5" },
        maxLines: 1
      })),

      // 底部小字
      {
        type: "spacer",
        flex: 1
      },
      {
        type: "text",
        text: "Egern • 黄历 & 倒计时",
        font: { size: fs.small - 1 },
        textColor: { light: "#757575", dark: "#90A4AE" },
        textAlign: "center"
      }
    ]
  };
}
