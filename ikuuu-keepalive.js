/**
 * iKuuu Cookie 保活（Egern schedule 脚本）
 *
 * Cookie 里的 expire_in 是服务端写死的绝对到期时间，访问页面不会续期；
 * 所以到期前（剩余 ≤ REFRESH_DAYS 天）或已过期/无 Cookie 时，用邮箱密码重新登录换新 Cookie。
 * 手动 Cookie（COOKIE）必须留空，否则签到脚本优先用手动值，保活不生效。
 */
const COOKIE_KEY = "ikuuu_org_cookie";
const HOST_KEY = "ikuuu_host";
const HOSTS = ["https://ikuuu.org", "https://ikuuu.top", "https://ikuuu.pw"];
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

function parseExpireTs(c) {
  const m = String(c || "").match(/(?:^|;\s*)expire_in=([\d.]+)/);
  if (!m) return 0;
  let ts = Math.floor(parseFloat(m[1]));
  if (ts > 1e12) ts = Math.floor(ts / 1000);
  return ts > 0 ? ts : 0;
}

const pad2 = (n) => (n < 10 ? "0" + n : String(n));
function formatTs(ts) {
  const d = new Date(ts * 1000);
  return (
    d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
    " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes())
  );
}

/** Set-Cookie（数组，或被逗号合并的字符串）→ "k=v; k2=v2" */
function cookiesFromHeaders(headers) {
  let items = [];
  try {
    items = headers.getAll("set-cookie") || [];
  } catch (e) {}
  if (!items.length) {
    const raw = headers.get("set-cookie");
    if (raw) items = String(raw).split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
  }
  const jar = {};
  const order = [];
  for (const item of items) {
    const first = String(item).split(";")[0].trim();
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const val = first.slice(eq + 1).trim();
    if (!val || val === "deleted") continue; // 服务端清除 Cookie 的写法
    if (!(name in jar)) order.push(name);
    jar[name] = val;
  }
  return order.map((n) => n + "=" + jar[n]).join("; ");
}

export default async function (ctx) {
  const env = ctx.env || {};
  const notifyEnabled = env.NOTIFY !== "false";
  const email = str(env.EMAIL);
  const password = str(env.PASSWORD);
  const policy = str(env.REQUEST_POLICY);
  const insecureTls = env.INSECURE_TLS === "true";
  let refreshDays = parseFloat(env.REFRESH_DAYS);
  if (!(refreshDays >= 0)) refreshDays = 2;

  const done = (subtitle, body) => {
    console.log("[iKuuu保活] " + subtitle + " | " + String(body).replace(/\n/g, " / "));
    if (notifyEnabled) ctx.notify({ title: "iKuuu 保活", subtitle, body });
  };

  const cookie = str(ctx.storage.get(COOKIE_KEY));
  const ts = parseExpireTs(cookie);
  const leftDays = ts ? (ts * 1000 - Date.now()) / 86400000 : -1;

  if (cookie && ts && leftDays > refreshDays) {
    console.log("[iKuuu保活] Cookie 还剩 " + leftDays.toFixed(1) + " 天，无需刷新");
    return;
  }
  if (cookie && !ts) {
    console.log("[iKuuu保活] 已保存的 Cookie 没有 expire_in，无法判断有效期，跳过");
    return;
  }
  if (!email || !password) {
    return done(
      "需要重新登录，但没填账号密码",
      "Cookie 剩余 " + (ts ? Math.max(0, leftDays).toFixed(1) : "0") +
        " 天。请在模块设置里填写邮箱和密码，或手动在 Safari 登录一次。"
    );
  }

  const first = str(ctx.storage.get(HOST_KEY));
  const queue = HOSTS.indexOf(first) >= 0 ? [first] : [];
  for (const h of HOSTS) if (queue.indexOf(h) < 0) queue.push(h);

  let lastErr = "";
  for (const host of queue) {
    let resp, text;
    try {
      const options = {
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: host + "/auth/login",
          Origin: host,
          "X-Requested-With": "XMLHttpRequest",
        },
        body:
          "email=" + encodeURIComponent(email) +
          "&passwd=" + encodeURIComponent(password) +
          "&code=&remember_me=week",
        timeout: 15000,
        credentials: "omit",
        insecureTls,
      };
      if (policy) options.policy = policy;
      resp = await ctx.http.post(host + "/auth/login", options);
      text = await resp.text();
    } catch (e) {
      lastErr = host.replace("https://", "") + "：" + String(e);
      console.log("[iKuuu保活] " + lastErr);
      continue;
    }

    let json = null;
    try {
      json = JSON.parse(String(text || "").trim());
    } catch (e) {}
    if (!json) {
      lastErr = host.replace("https://", "") + "：返回内容不是 JSON（HTTP " + resp.status +
        "），可能有验证码/防护页";
      console.log("[iKuuu保活] " + lastErr);
      continue;
    }

    if (Number(json.ret) !== 1) {
      // 账号密码错误等业务失败：换域名没有意义
      return done("登录被拒绝", String(json.msg || "") || "服务器没有返回说明");
    }

    const newCookie = cookiesFromHeaders(resp.headers);
    const newTs = parseExpireTs(newCookie);
    if (!newCookie || !newTs) {
      return done(
        "登录成功但没拿到 Cookie",
        "响应的 Set-Cookie 里没有 expire_in（拿到 " + newCookie.length +
          " 字节）。请检查日志。"
      );
    }
    ctx.storage.set(COOKIE_KEY, newCookie);
    ctx.storage.set(HOST_KEY, host);
    return done(
      "已自动续期（" + host.replace("https://", "") + "）",
      "新 Cookie 到期：" + formatTs(newTs)
    );
  }

  done("重新登录失败", lastErr || "所有域名都没成功");
}
