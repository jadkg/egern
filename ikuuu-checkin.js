/**
 * iKuuu 自动签到（Egern schedule 脚本）
 * 支持 ikuuu.org / ikuuu.top / ikuuu.pw：优先用抓取/续期时记录的域名，请求失败自动轮换其余域名。
 * 流程：POST /user/checkin → 解析 {ret, msg} → GET /user 读剩余流量。
 * Cookie 剩余 ≤ 2 天时单独提醒一次（每张票每天最多一次）。
 */
const HOSTS = ["https://ikuuu.org", "https://ikuuu.top", "https://ikuuu.pw"];
const COOKIE_KEY = "ikuuu_org_cookie";
const HOST_KEY = "ikuuu_host";
const EXPIRE_WARN_KEY = "ikuuu_expire_warn";
const EXPIRE_WARN_DAYS = 2;
const MAX_ATTEMPTS = 3;
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const pad2 = (n) => (n < 10 ? "0" + n : String(n));
const sleep = (ms) =>
  typeof setTimeout === "function" ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

function parseExpireTs(cookieStr) {
  const m = String(cookieStr || "").match(/(?:^|;\s*)expire_in=([\d.]+)/);
  if (!m) return 0;
  let ts = Math.floor(parseFloat(m[1]));
  if (ts > 1e12) ts = Math.floor(ts / 1000);
  return ts > 0 ? ts : 0;
}

function formatTs(ts) {
  const d = new Date(ts * 1000);
  return (
    d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
    " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes())
  );
}

function todayStamp() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

/* ---------- Base64 / UTF-8（站点页面被 base64 包在 var originBody 里） ---------- */

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_TABLE = (() => {
  const t = [];
  for (let i = 0; i < 256; i++) t[i] = -1;
  for (let j = 0; j < 64; j++) t[B64_CHARS.charCodeAt(j)] = j;
  return t;
})();

function utf8Decode(bytes) {
  let out = "";
  let run = [];
  const CHUNK = 2048;
  let i = 0;
  const n = bytes.length;
  while (i < n) {
    const b = bytes[i];
    if (b < 0x80) {
      run.push(b);
      i++;
      if (run.length >= CHUNK) {
        out += String.fromCharCode.apply(null, run);
        run = [];
      }
      continue;
    }
    if (run.length) {
      out += String.fromCharCode.apply(null, run);
      run = [];
    }
    if (b < 0xc0) {
      i++;
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (b < 0xf0) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      );
      i += 3;
    } else {
      let cp =
        ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      i += 4;
    }
  }
  if (run.length) out += String.fromCharCode.apply(null, run);
  return out;
}

function base64ToBytes(str) {
  const s = String(str);
  const n = s.length;
  const out = new Uint8Array((n >> 2) * 3 + 3);
  let k = 0;
  for (let i = 0; i + 3 < n; i += 4) {
    const v0 = B64_TABLE[s.charCodeAt(i) & 0xff];
    const v1 = B64_TABLE[s.charCodeAt(i + 1) & 0xff];
    const v2 = B64_TABLE[s.charCodeAt(i + 2) & 0xff];
    const v3 = B64_TABLE[s.charCodeAt(i + 3) & 0xff];
    if (v0 < 0) break;
    out[k++] = (v0 << 2) | (v1 >> 4);
    if (v2 < 0) break;
    out[k++] = ((v1 & 15) << 4) | (v2 >> 2);
    if (v3 < 0) break;
    out[k++] = ((v2 & 3) << 6) | v3;
  }
  return out.subarray(0, k);
}

const base64Decode = (str) => utf8Decode(base64ToBytes(str));

function utf8Bytes(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c < 0xdc00) {
      const cp = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00);
      out.push(
        0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)
      );
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

function indexOfBytes(bytes, pat, from) {
  const n = bytes.length;
  const m = pat.length;
  if (!m) return -1;
  const first = pat[0];
  for (let i = from || 0; i <= n - m; i++) {
    if (bytes[i] !== first) continue;
    let j = 1;
    while (j < m && bytes[i + j] === pat[j]) j++;
    if (j === m) return i;
  }
  return -1;
}

function extractHtml(data) {
  const text = String(data || "");
  const m = text.match(/var\s+originBody\s*=\s*["']([^"']+)["']/);
  if (!m) return text;
  try {
    return base64Decode(m[1]);
  } catch (e) {
    return text;
  }
}

function pick(html, label) {
  const re = new RegExp(
    label + '[\\s\\S]{0,400}?<span[^>]*class="[^"]*counter[^"]*"[^>]*>' +
      "\\s*([\\d.]+)\\s*<\\/span>\\s*([KMGTP]?B)",
    "i"
  );
  const m = html.match(re);
  if (m) return m[1] + " " + m[2].toUpperCase();
  const plain = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const m2 = plain.match(new RegExp(label + "\\s*[:：]?\\s*([\\d.]+)\\s*([KMGTP]?B)", "i"));
  return m2 ? m2[1] + " " + m2[2].toUpperCase() : null;
}

function extractTraffic(data, label) {
  const text = String(data || "");
  const m = text.match(/var\s+originBody\s*=\s*["']([^"']+)["']/);
  if (!m) return pick(text, label);
  try {
    const bytes = base64ToBytes(m[1]);
    const pat = utf8Bytes(label);
    const counter = [99, 111, 117, 110, 116, 101, 114]; // "counter"
    let at = -1;
    let tries = 0;
    while ((at = indexOfBytes(bytes, pat, at + 1)) >= 0) {
      const probe = bytes.subarray(at, Math.min(bytes.length, at + 500));
      if (indexOfBytes(probe, counter, 0) < 0) continue;
      if (++tries > 8) break;
      const from = Math.max(0, at - 200);
      const to = Math.min(bytes.length, at + 1200);
      const hit = pick(utf8Decode(bytes.subarray(from, to)), label);
      if (hit) return hit;
    }
  } catch (e) {
    console.log("[iKuuu] 字节定位失败，退回整页解码：" + e);
  }
  return pick(extractHtml(data), label);
}

/* ---------- 主流程 ---------- */

export default async function (ctx) {
  const T0 = Date.now();
  const env = ctx.env || {};
  const str = (v) => (v === null || v === undefined ? "" : String(v).trim());
  const notifyEnabled = env.NOTIFY !== "false";
  const expireInfo = env.EXPIRE_INFO !== "false";
  const parallel = env.PARALLEL === "true";
  const policy = str(env.REQUEST_POLICY);
  const insecureTls = env.INSECURE_TLS === "true";

  const manualCookie = str(env.COOKIE)
    .replace(/^\s*cookie\s*:\s*/i, "")
    .replace(/[\r\n]+/g, " ")
    .trim();
  const savedCookie = str(ctx.storage.get(COOKIE_KEY));
  const cookie = manualCookie || savedCookie;

  // 域名顺序：保存的域名优先，其余随后
  const savedHost = str(ctx.storage.get(HOST_KEY));
  const hostList = HOSTS.indexOf(savedHost) >= 0 ? [savedHost] : [];
  for (const h of HOSTS) if (hostList.indexOf(h) < 0) hostList.push(h);
  let HOST = hostList[0];

  function expireText() {
    if (!expireInfo) return "";
    const ts = parseExpireTs(cookie);
    if (!ts) return "";
    const leftMs = ts * 1000 - Date.now();
    if (leftMs <= 0) return "CK：已过期（" + formatTs(ts) + "）";
    return "CK 剩余：" + Math.ceil(leftMs / 86400000) + " 天（" + formatTs(ts) + " 到期）";
  }

  function finish(subtitle, content) {
    let text = String(content);
    const info = expireText();
    if (info) text += "\n" + info;
    if (notifyEnabled) ctx.notify({ title: "iKuuu 签到", subtitle, body: text });
    console.log("[iKuuu] " + subtitle + " | " + text.replace(/\n/g, " / "));
    console.log("[iKuuu] 总耗时 " + (Date.now() - T0) + "ms" + (parallel ? "（并行读流量）" : ""));
  }

  function checkCookieExpire() {
    const ts = parseExpireTs(cookie);
    if (!ts) return;
    const leftMs = ts * 1000 - Date.now();
    if (leftMs <= 0) {
      console.log("[iKuuu] Cookie 已在 " + formatTs(ts) + " 过期");
      return;
    }
    const days = Math.ceil(leftMs / 86400000);
    if (days > EXPIRE_WARN_DAYS) return;
    const stamp = todayStamp() + "|" + ts;
    if (str(ctx.storage.get(EXPIRE_WARN_KEY)) === stamp) {
      console.log("[iKuuu] 今天已经提醒过 Cookie 即将过期");
      return;
    }
    if (!notifyEnabled) {
      console.log("[iKuuu] Cookie 即将过期（" + formatTs(ts) + "），通知已关闭");
      return;
    }
    ctx.storage.set(EXPIRE_WARN_KEY, stamp);
    ctx.notify({
      title: "iKuuu Cookie 即将过期",
      subtitle: "还剩约 " + days + " 天",
      body:
        "到期时间：" + formatTs(ts) + "\n" +
        "已填邮箱密码的话，保活脚本会自动续期；否则请在 Safari 重新登录一次。",
    });
  }

  function requestOptions(headers, extra) {
    const o = Object.assign(
      { headers, timeout: 15000, credentials: "omit", insecureTls },
      extra || {}
    );
    if (policy) o.policy = policy;
    return o;
  }

  async function fetchTraffic() {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await ctx.http.get(
          HOST + "/user",
          requestOptions({
            Cookie: cookie,
            "User-Agent": UA,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Referer: HOST + "/user",
          })
        );
        const data = await resp.text();
        if (!data) throw new Error("空响应");
        const rest = extractTraffic(data, "剩余流量");
        return rest ? "剩余流量：" + rest : null;
      } catch (e) {
        console.log("[iKuuu] 读流量失败（第 " + attempt + " 次）：" + e);
        if (attempt < 2) await sleep(1000);
      }
    }
    return null;
  }

  function handleCheckin(error, status, data, attempts) {
    if (error) {
      const errText = String(error);
      if (/certificate|SSL|TLS/i.test(errText)) {
        return {
          fail: true,
          subtitle: "TLS 校验失败",
          body: [
            "签到请求连续 " + attempts + " 次没通过证书校验。",
            "① 在模块设置里指定「请求策略」，排除线路或节点证书问题；",
            "② 检查 Egern 的 MITM 证书是否已安装并信任；",
            "③ 仍不行可临时打开「跳过证书校验」排查。",
            "",
            errText.slice(0, 160),
          ].join("\n"),
        };
      }
      return {
        fail: true,
        subtitle: "请求失败",
        body: "签到接口请求出错（已试 " + attempts + " 次）：" + errText,
      };
    }

    const text = String(data === null || data === undefined ? "" : data).trim();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {}

    if (!json || typeof json !== "object") {
      if ((status >= 300 && status < 400) || /<html|<script/i.test(text)) {
        return {
          fail: true,
          subtitle: "Cookie 已失效",
          body: "服务器返回的是登录页。已填邮箱密码的话等保活脚本续期；否则请在 Safari 重新登录。",
        };
      }
      return {
        fail: true,
        subtitle: "签到失败",
        body: "返回内容无法解析（HTTP " + status + "）：" + text.slice(0, 120),
      };
    }

    const ret = Number(json.ret);
    const msg = String(json.msg || "").trim() || "服务器没有返回说明";
    const already = /已经?签到|重复签到|签到过了|明天再来/.test(msg);
    let subtitle;
    if (ret === 1) subtitle = "签到成功";
    else if (already) subtitle = "今日已签到";
    else if (/未登录|登录.*(?:失效|过期)|请重新登录|请先登录/.test(msg)) subtitle = "Cookie 已失效";
    else subtitle = "签到失败";
    return { subtitle, body: msg, checked: ret === 1 };
  }

  async function attemptCheckin() {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const host = hostList[(attempt - 1) % hostList.length];
      try {
        const resp = await ctx.http.post(
          host + "/user/checkin",
          requestOptions({
            Cookie: cookie,
            "User-Agent": UA,
            Accept: "application/json, text/javascript, */*; q=0.01",
            Referer: host + "/user",
            Origin: host,
            "X-Requested-With": "XMLHttpRequest",
          })
        );
        const data = await resp.text();
        HOST = host;
        if (host !== savedHost) ctx.storage.set(HOST_KEY, host);
        console.log("[iKuuu] 签到返回 t=" + (Date.now() - T0) + "ms 第 " + attempt + " 次 " + host);
        return handleCheckin(null, resp.status, data, attempt);
      } catch (e) {
        lastError = e;
        console.log("[iKuuu] 第 " + attempt + " 次请求失败（" + host + "）：" + e);
        if (attempt < MAX_ATTEMPTS) await sleep(1500);
      }
    }
    return handleCheckin(lastError, 0, "", MAX_ATTEMPTS);
  }

  if (!cookie) {
    return finish(
      "没有 Cookie",
      [
        "还没拿到登录 Cookie。",
        "① 在 Safari 打开 ikuuu 登录一次（需已安装 MITM 证书、模块已启用）；",
        "② 或在模块设置里填邮箱密码，保活脚本会自动登录获取；",
        "③ 或在模块设置的「手动 Cookie」里粘贴。",
      ].join("\n")
    );
  }

  checkCookieExpire();

  if (!parallel) {
    const r = await attemptCheckin();
    if (r.fail) return finish(r.subtitle, r.body);
    const traffic = await fetchTraffic();
    return finish(r.subtitle, r.body + (traffic ? "\n" + traffic : ""));
  }

  const [r, traffic] = await Promise.all([attemptCheckin(), fetchTraffic()]);
  let body = r.body || "";
  if (traffic) body += (body ? "\n" : "") + traffic;
  if (r.checked && traffic) body += "（签到前）";
  finish(r.subtitle, body);
}
