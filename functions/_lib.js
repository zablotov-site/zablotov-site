// Shared helpers for the site content API and the admin area.
// Content lives in Workers KV (binding FILES) under "site:content". Admin credentials live ONLY in KV
// ("admin:cred" = salted PBKDF2 hash, "admin:secret" = session signing key) - never in the repo or client code.
export const DEFAULTS = {
  v: 1,
  meldungen: [],
  shiurim: [
    { id: "s1", title: "נוגן דוד המלך פון ליפא שמעלצער", author: "", date: "ז׳ כסלו תשפ״ז", desc: "ח' כסלו", kind: "audio", url: "/f/s/mwljd1hwafyc3paxpg.m4a" },
    { id: "s2", title: "ז כוסלו געלערנט", author: "דוד לייב ווידער", date: "ז׳ כסלו תשפ״ז", desc: "", kind: "video", url: "/f/s/mwl6ib53kzrfkvst6g.mp4" }
  ],
  info: { about: "", seder: "", place: "Red bird 2", placeUrl: "https://maps.app.goo.gl/dNKCP1YFk5SzwuNr6?g_st=ac", contact: "" },
  zmanimNote: "",
  home: { learning: "" },
  updated: 0
};
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64u = (s) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const json = (o, status = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });

export async function getContent(env) {
  const raw = await env.FILES.get("site:content");
  if (!raw) return structuredClone(DEFAULTS);
  try { return { ...structuredClone(DEFAULTS), ...JSON.parse(raw) }; } catch { return structuredClone(DEFAULTS); }
}
async function pbkdf2(pw, salt) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, k, 256);
}
export async function makeCred(user, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return JSON.stringify({ u: user, s: b64(salt), h: b64(await pbkdf2(pw, salt)) });
}
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0; }
export async function checkLogin(env, user, pw) {
  const raw = await env.FILES.get("admin:cred");
  if (!raw) return false;
  const c = JSON.parse(raw);
  const h = new Uint8Array(await pbkdf2(String(pw), unb64(c.s)));
  const okPw = safeEq(h, unb64(c.h));
  const okUser = String(user).trim().toLowerCase() === String(c.u).toLowerCase();
  return okPw && okUser;
}
async function hmacKey(env) {
  let s = await env.FILES.get("admin:secret");
  if (!s) { s = b64(crypto.getRandomValues(new Uint8Array(32))); await env.FILES.put("admin:secret", s); }
  return crypto.subtle.importKey("raw", enc.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
export async function rotateSecret(env) { await env.FILES.put("admin:secret", b64(crypto.getRandomValues(new Uint8Array(32)))); }
export async function makeToken(env) {
  const body = b64u(btoa(JSON.stringify({ exp: Date.now() + 14 * 864e5 })));
  const sig = b64u(b64(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(body))));
  return body + "." + sig;
}
export async function isAdmin(ctx) {
  const m = /(?:^|;\s*)zb_admin=([^;]+)/.exec(ctx.request.headers.get("cookie") || "");
  if (!m) return false;
  const [body, sig] = m[1].split(".");
  if (!body || !sig) return false;
  try {
    const good = b64u(b64(await crypto.subtle.sign("HMAC", await hmacKey(ctx.env), enc.encode(body))));
    if (good.length !== sig.length || !safeEq(enc.encode(good), enc.encode(sig))) return false;
    return JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))).exp > Date.now();
  } catch { return false; }
}
// Gate for every write endpoint: valid signed session cookie + custom header (blocks cross-site form posts).
export async function requireAdmin(ctx) {
  if (ctx.request.headers.get("x-zb-admin") !== "1") return json({ error: "forbidden" }, 403);
  if (!(await isAdmin(ctx))) return json({ error: "unauthorized" }, 401);
  return null;
}
export const cookie = (v, age) => `zb_admin=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;

const S = (v, n) => String(v == null ? "" : v).slice(0, n);
const URLOK = (u) => { u = S(u, 600).trim(); return /^(https?:\/\/|\/f\/)/i.test(u) ? u : ""; };
export function sanitize(c) {
  const out = { v: 1 };
  const id = (x) => S(x, 24).replace(/[^a-z0-9]/gi, "") || Math.random().toString(36).slice(2, 10);
  out.meldungen = (Array.isArray(c.meldungen) ? c.meldungen : []).slice(0, 300).map((m) => ({ id: id(m.id), title: S(m.title, 200), body: S(m.body, 6000), date: S(m.date, 60) })).filter((m) => m.title || m.body);
  out.shiurim = (Array.isArray(c.shiurim) ? c.shiurim : []).slice(0, 300).map((m) => ({ id: id(m.id), title: S(m.title, 200), author: S(m.author, 120), date: S(m.date, 60), desc: S(m.desc, 3000), kind: ["audio", "video", "link"].includes(m.kind) ? m.kind : "link", url: URLOK(m.url) })).filter((m) => m.title);
  const i = c.info || {};
  out.info = { about: S(i.about, 6000), seder: S(i.seder, 6000), place: S(i.place, 1000), placeUrl: URLOK(i.placeUrl), contact: S(i.contact, 3000) };
  out.zmanimNote = S(c.zmanimNote, 3000);
  out.home = { learning: S((c.home || {}).learning, 600) };
  out.updated = Date.now();
  return out;
}

// Upload claims are signed separately from session cookies and expire after a day.
export async function signUpload(env, claims) {
  const body = b64u(btoa(JSON.stringify(claims)));
  const sig = b64u(b64(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode("upload:"+body))));
  return body+"."+sig;
}
export async function readUpload(env, token) {
  try {
    if (typeof token !== "string" || token.length>4000) return null;
    const [body,sig] = token.split(".");
    const good = b64u(b64(await crypto.subtle.sign("HMAC",await hmacKey(env),enc.encode("upload:"+body))));
    if (!sig || !safeEq(enc.encode(good),enc.encode(sig))) return null;
    const c = JSON.parse(atob(body.replace(/-/g,"+").replace(/_/g,"/")));
    if (c.exp<Date.now() || !/^f\/u\/[a-f0-9-]+\.[a-z0-9]+$/.test(c.key) || !c.uploadId || !Number.isSafeInteger(c.size)) return null;
    return c;
  } catch { return null; }
}
