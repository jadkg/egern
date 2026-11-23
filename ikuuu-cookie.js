/**
 * iKuuu Cookie 抓取（Egern http_request 脚本）
 * 支持 ikuuu.org / ikuuu.top / ikuuu.pw；同时记录当前域名（ikuuu_host）。
 * 只读 Cookie，不修改请求，直接放行。
 */
const COOKIE_KEY = "ikuuu_org_cookie";
const HOST_KEY = "ikuuu_host";
// 登录后才会出现的会话 Cookie；游客 Cookie（如 __cf_bm）不会覆盖已保存的值
const LOGIN_COOKIE = /(?:^|;\s*)(?:auth|uid|key|session|remember_[^=;]*)=[^;]/i;

export default async function (ctx) {
  const notifyEnabled = (ctx.env || {}).NOTIFY !== "false";

  const notify = (subtitle, body) => {
    if (!notifyEnabled) return;
    ctx.notify({ title: "iKuuu Cookie 抓取", subtitle, body });
  };

  let host = "";
  const hm = String(ctx.request.url).match(
    /^https?:\/\/(?:www\.)?(ikuuu\.(?:org|top|pw))(?:[\/:?]|$)/i
  );
  if (hm) host = "https://" + hm[1].toLowerCase();

  const cookie = String(ctx.request.headers.get("cookie") || "").trim();
  if (!cookie) {
    console.log("[iKuuu] 本次请求没有 Cookie，跳过");
    return;
  }
  if (!LOGIN_COOKIE.test(cookie)) {
    console.log("[iKuuu] 当前是未登录状态，忽略本次 Cookie");
    return;
  }

  const existing = String(ctx.storage.get(COOKIE_KEY) || "");
  const existingHost = String(ctx.storage.get(HOST_KEY) || "");
  if (existing === cookie && (!host || existingHost === host)) {
    console.log("[iKuuu] Cookie 没有变化，跳过写入");
    return;
  }

  ctx.storage.set(COOKIE_KEY, cookie);
  if (host) ctx.storage.set(HOST_KEY, host);
  console.log("[iKuuu] 已保存登录 Cookie（" + cookie.length + " 字节），域名 " + (host || "未知"));
  notify(
    "已获取登录 Cookie（" + (host ? host.replace("https://", "") : "未知域名") + "）",
    "之后到期前会自动用邮箱密码续期；不需要再抓取时可以停用本模块的抓取（或保持不动）。"
  );
}
