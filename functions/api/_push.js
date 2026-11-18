// Web Push (RFC 8291 + VAPID) helpers, shared by api/push.js and api/chat.js.
// State lives in the D1 `state` table: k='vapid' (keypair), k='pushsubs' (subscriptions), k='pushlast' (latest payload).

const te = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ub64 = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); const p = "=".repeat((4 - (s.length % 4)) % 4); return Uint8Array.from(atob(s + p), (c) => c.charCodeAt(0)); };
const concat = (...arrs) => { const n = arrs.reduce((a, x) => a + x.length, 0); const o = new Uint8Array(n); let i = 0; for (const x of arrs) { o.set(x, i); i += x.length; } return o; };

async function hmac(keyBytes, data) {
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

async function getVapid(DB) {
  const row = await DB.prepare("SELECT v FROM state WHERE k='vapid'").first();
  if (row) return JSON.parse(row.v);
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const pub = b64u(await crypto.subtle.exportKey("raw", kp.publicKey));
  const v = { public: pub, d: jwk.d, x: jwk.x, y: jwk.y };
  await DB.prepare("INSERT INTO state(k,v) VALUES('vapid',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(v)).run();
  return v;
}

async function vapidJwt(vapid, aud) {
  const header = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: "mailto:36u180@mail.instinct.com" })));
  const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: vapid.d, x: vapid.x, y: vapid.y }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(header + "." + body));
  return header + "." + body + "." + b64u(sig);
}

async function encryptPayload(sub, text) {
  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaPubRaw = ub64(sub.keys.p256dh);
  const uaPub = await crypto.subtle.importKey("raw", uaPubRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaPub }, asKeys.privateKey, 256));
  const authSecret = ub64(sub.keys.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk1 = await hmac(authSecret, shared);
  const ikm = await hmac(prk1, concat(te.encode("WebPush: info"), new Uint8Array([0]), uaPubRaw, asPub, new Uint8Array([1])));
  const prk2 = await hmac(salt, ikm);
  const cek = (await hmac(prk2, concat(te.encode("Content-Encoding: aes128gcm"), new Uint8Array([0, 1])))).slice(0, 16);
  const nonce = (await hmac(prk2, concat(te.encode("Content-Encoding: nonce"), new Uint8Array([0, 1])))).slice(0, 12);
  const data = concat(te.encode(text), new Uint8Array([2])); // 0x02 = last record delimiter
  const ck = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, ck, data));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

async function loadSubs(DB) {
  const row = await DB.prepare("SELECT v FROM state WHERE k='pushsubs'").first();
  return row ? JSON.parse(row.v) : {};
}
async function saveSubs(DB, subs) {
  await DB.prepare("INSERT INTO state(k,v) VALUES('pushsubs',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(subs)).run();
}

export async function pushPublicKey(DB) { return (await getVapid(DB)).public; }

export async function pushSubscribe(DB, subscription, me) {
  if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) return false;
  const subs = await loadSubs(DB);
  subs[subscription.endpoint] = { sub: subscription, me: me || "", at: Date.now() };
  await saveSubs(DB, subs);
  return true;
}

export async function pushSetLast(DB, payload) {
  await DB.prepare("INSERT INTO state(k,v) VALUES('pushlast',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(payload)).run();
}

export async function pushGetLast(DB) {
  const row = await DB.prepare("SELECT v FROM state WHERE k='pushlast'").first();
  return row ? JSON.parse(row.v) : { title: "חבורת זאבלטוב", body: "", url: "/" };
}

// Send a payload to every subscription (optionally skipping one chat identity). Cleans up dead endpoints.
export async function pushSendAll(DB, payload, skipMe) {
  const vapid = await getVapid(DB);
  const subs = await loadSubs(DB);
  const text = JSON.stringify(payload);
  const dead = [];
  const results = {};
  for (const ep of Object.keys(subs)) {
    const rec = subs[ep];
    if (skipMe && rec.me && rec.me === skipMe) continue;
    try {
      const body = await encryptPayload(rec.sub, text);
      const jwt = await vapidJwt(vapid, new URL(ep).origin);
      const r = await fetch(ep, {
        method: "POST",
        headers: {
          Authorization: "vapid t=" + jwt + ", k=" + vapid.public,
          TTL: "86400",
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "aes128gcm",
          Urgency: "normal",
        },
        body,
      });
      results[ep.slice(-12)] = r.status;
      if (r.status === 404 || r.status === 410) dead.push(ep);
    } catch (e) { results[ep.slice(-12)] = "err:" + String(e).slice(0, 80); }
  }
  await DB.prepare("INSERT INTO state(k,v) VALUES('pushdebug',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify({ at: Date.now(), results })).run();
  if (dead.length) { for (const ep of dead) delete subs[ep]; await saveSubs(DB, subs); }
}
