import { pushSendAll, pushSetLast } from "./_push.js";

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

let FILES, DB;
async function loadDB() {
  const row = await DB.prepare("SELECT v FROM state WHERE k='db'").first();
  return row ? JSON.parse(row.v) : { seq: 1, people: {}, convs: {}, reads: {} };
}
const saveDB = async (db) => {
  db._w = Date.now();
  await DB.prepare("INSERT INTO state(k,v) VALUES('db',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(db)).run();
};
// GET paths persist presence/read state at most every 15s to stay within free-tier write limits.
const saveDBThrottled = async (db) => { if (Date.now() - (db._w || 0) > 15000) await saveDB(db); };
const dmCid = (a, b) => "dm:" + [a, b].sort().join(":");
const ONLINE_MS = 30000, TYPING_MS = 5000;

function touch(db, me, name) {
  if (!me) return;
  const p = db.people[me] || (db.people[me] = {});
  if (!p.since) p.since = Date.now();
  if (name) p.name = name;
  p.at = Date.now();
}
const isOnline = (p) => p && p.at && Date.now() - p.at < ONLINE_MS;
const publicPerson = (who, p) => ({ who, name: (p && p.name) || "?", av: (p && p.av) || undefined, online: !!isOnline(p), at: (p && p.at) || undefined });

function msgOut(m, me) {
  const re = {}, rx = m.rx || {};
  for (const w in rx) { if (rx[w]) re[rx[w]] = (re[rx[w]] || 0) + 1; }
  const o = {
    id: m.id, from: m.from, name: m.name, av: m.av || undefined,
    created: m.created, updated: m.updated, mine: m.from === me,
    body: m.body || "", reply_to: m.reply_to || undefined,
    file_key: m.deleted ? undefined : m.file_key, file_type: m.deleted ? undefined : m.file_type, file_name: m.deleted ? undefined : m.file_name,
    fwd: m.fwd || undefined, edited: m.edited || undefined, deleted: m.deleted || undefined,
    pinned: m.pinned || undefined, re, my: rx[me] || undefined,
  };
  if (m.poll && !m.deleted) {
    const counts = m.poll.opts.map(() => 0);
    for (const w in m.poll.votes) { const v = m.poll.votes[w]; if (v >= 0 && v < counts.length) counts[v]++; }
    o.poll = { q: m.poll.q, opts: m.poll.opts, counts, my: m.poll.votes[me] != null ? m.poll.votes[me] : undefined };
  }
  if (m.loc && !m.deleted) o.loc = m.loc;
  return o;
}

export async function onRequest(ctx) {
  DB = ctx.env.DB; FILES = ctx.env.FILES;
  const req = ctx.request;
  const url = new URL(req.url);
  const q = url.searchParams;

  if (req.method === "PUT") {
    const type = req.headers.get("content-type") || "application/octet-stream";
    const ok = /^(image\/(jpeg|png|webp|gif)|audio\/|video\/(mp4|webm|quicktime)|application\/(pdf|zip|msword)|text\/plain)/.test(type);
    if (!ok) return J({ error: "type" }, 415);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return J({ error: "empty" }, 400);
    if (buf.byteLength > 5_500_000) return J({ error: "big" }, 413);
    const ext = (type.split("/")[1] || "bin").split(";")[0].replace("jpeg", "jpg").replace("quicktime", "mov");
    const key = "u/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + "." + ext;
    await FILES.put("f/" + key, buf, { metadata: { type } });
    return J({ key, type });
  }

  const db = await loadDB();

  if (req.method === "GET") {
    const me = q.get("me") || "";
    touch(db, me, q.get("name") || undefined);

    if (q.get("list")) {
      await saveDBThrottled(db);
      const people = Object.keys(db.people).map((w) => publicPerson(w, db.people[w]));
      const dms = [];
      for (const cid in db.convs) {
        if (!cid.startsWith("dm:") || !cid.split(":").includes(me)) continue;
        const other = cid.split(":").find((x) => x !== me && x !== "dm");
        const msgs = db.convs[cid].msgs.filter((m) => !m.deleted);
        const last = msgs[msgs.length - 1];
        const readTo = (db.reads[cid] || {})[me] || 0;
        dms.push({
          other, name: (db.people[other] || {}).name || "?", av: (db.people[other] || {}).av || undefined,
          online: !!isOnline(db.people[other]),
          unread: msgs.filter((m) => m.id > readTo && m.from !== me).length,
          last: last ? { created: last.created, body: last.body, poll: !!last.poll, file_type: last.file_type, mine: last.from === me } : undefined,
        });
      }
      dms.sort((a, b) => ((b.last || {}).created || 0) - ((a.last || {}).created || 0));
      const gmsgs = (db.convs["g"] || { msgs: [] }).msgs.filter((m) => !m.deleted);
      const glast = gmsgs[gmsgs.length - 1];
      const gread = (db.reads["g"] || {})[me] || 0;
      return J({
        people, dms,
        g: { unread: gmsgs.filter((m) => m.id > gread && m.from !== me).length,
             last: glast ? { created: glast.created, name: glast.name, body: glast.body, poll: !!glast.poll, file_type: glast.file_type } : undefined },
      });
    }

    const conv = q.get("conv");
    if (conv) {
      const cid = conv === "g" ? "g" : dmCid(me, conv);
      const c = db.convs[cid] || (db.convs[cid] = { msgs: [] });
      const since = +(q.get("since") || 0);
      const reads = db.reads[cid] || (db.reads[cid] = {});
      if (q.get("bg") !== "1" && c.msgs.length) reads[me] = Math.max(reads[me] || 0, c.msgs[c.msgs.length - 1].id);
      await saveDBThrottled(db);
      const msgs = c.msgs.filter((m) => m.updated > since && (since > 0 || !m.deleted)).map((m) => msgOut(m, me));
      let seen = 0;
      const others = Object.keys(reads).filter((w) => w !== me);
      if (cid === "g") seen = others.length ? Math.min(...others.map((w) => reads[w])) : 0;
      else { const ow = cid.split(":").find((x) => x !== me && x !== "dm"); seen = reads[ow] || 0; }
      const typing = Object.keys(db.people).filter((w) => w !== me && db.people[w].typing && db.people[w].typing.conv === cid && Date.now() - db.people[w].typing.at < TYPING_MS).map((w) => db.people[w].name || "?");
      const online = Object.keys(db.people).filter((w) => isOnline(db.people[w])).length;
      const out = { msgs, seen, typing, online, pins: c.msgs.filter((m) => m.pinned && !m.deleted).map((m) => ({ id: m.id, name: m.name, body: m.body, file_type: m.file_type })) };
      if (cid !== "g") { const ow = cid.split(":").find((x) => x !== me && x !== "dm"); out.other = publicPerson(ow, db.people[ow]); }
      return J(out);
    }

    if (q.get("chaverim")) {
      const people = Object.keys(db.people)
        .map((w) => ({ who: w, name: (db.people[w] || {}).name || "?", av: (db.people[w] || {}).av || undefined, online: !!isOnline(db.people[w]), at: (db.people[w] || {}).at || undefined, since: (db.people[w] || {}).since || (db.people[w] || {}).at || undefined }))
        .sort((a, b) => (b.at || 0) - (a.at || 0));
      return J({ people });
    }

    if (q.get("info")) {
      const id = +q.get("info");
      for (const cid in db.convs) {
        if (db.convs[cid].msgs.some((m) => m.id === id)) {
          const reads = db.reads[cid] || {};
          return J({ read: Object.keys(reads).filter((w) => reads[w] >= id && w !== me).map((w) => ({ name: (db.people[w] || {}).name || "?" })) });
        }
      }
      return J({ read: [] });
    }

    if (q.get("rx")) {
      const id = +q.get("rx");
      for (const cid in db.convs) {
        const m = db.convs[cid].msgs.find((x) => x.id === id);
        if (m) { const rx = m.rx || {}; return J({ list: Object.keys(rx).filter((w) => rx[w]).map((w) => ({ emoji: rx[w], name: (db.people[w] || {}).name || "?" })) }); }
      }
      return J({ list: [] });
    }
    await saveDBThrottled(db);
    return J({ ok: true });
  }

  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const me = b.me || "";
    touch(db, me, b.name);
    const a = b.a;
    const cid = b.conv === "g" ? "g" : b.conv ? dmCid(me, b.conv) : null;
    const c = cid ? (db.convs[cid] || (db.convs[cid] = { msgs: [] })) : null;
    const now = Date.now();

    if (a === "profile") {
      const p = db.people[me] || (db.people[me] = {});
      if (b.name) p.name = b.name; if (b.av) p.av = b.av;
    } else if (a === "typing" && c) {
      (db.people[me] || (db.people[me] = {})).typing = { conv: cid, at: now };
    } else if (a === "send" && c) {
      const p = db.people[me] || {};
      if (p.lastSend && now - p.lastSend < 1000) return J({ error: "fast" }, 429);
      p.lastSend = now;
      if (c.msgs.length > 2000) c.msgs = c.msgs.slice(-1500);
      const m = {
        id: db.seq++, updated: db.seq++, from: me, name: p.name || b.name || "?", av: p.av || undefined,
        created: now, body: (b.body || "").slice(0, 4000), reply_to: b.reply_to || undefined, fwd: b.fwd || undefined,
      };
      if (b.file_key) { m.file_key = b.file_key; m.file_type = b.file_type; m.file_name = b.file_name; }
      if (b.poll && b.poll.q && Array.isArray(b.poll.opts) && b.poll.opts.length >= 2) m.poll = { q: String(b.poll.q).slice(0, 200), opts: b.poll.opts.slice(0, 10).map((x) => String(x).slice(0, 100)), votes: {} };
      if (b.loc && typeof b.loc.lat === "number") m.loc = { lat: b.loc.lat, lng: b.loc.lng, acc: b.loc.acc || 0, live: !!b.loc.mins, until: b.loc.mins ? now + b.loc.mins * 60000 : 0, at: now };
      c.msgs.push(m);
      const reads = db.reads[cid] || (db.reads[cid] = {}); reads[me] = m.id;
      const payload = { title: "חבורת זאבלטוב", body: (m.name || "?") + ": " + (m.body || (m.poll ? "📊 פאל" : m.file_type ? "📎" : m.loc ? "📍 לאקעשען" : "")).slice(0, 120), url: "/chat" };
      ctx.waitUntil((async () => { await pushSetLast(DB, payload).catch(() => {}); await pushSendAll(DB, payload, me).catch(() => {}); })());
    } else if (c) {
      const m = c.msgs.find((x) => x.id === +b.id);
      if (!m) return J({ error: "nf" }, 404);
      if (a === "edit" && m.from === me && !m.deleted) { m.body = String(b.body || "").slice(0, 4000); m.edited = true; m.updated = db.seq++; }
      else if (a === "del" && m.from === me) { m.deleted = true; m.body = ""; m.file_key = m.file_type = m.file_name = m.poll = m.loc = undefined; m.rx = {}; m.updated = db.seq++; }
      else if (a === "react") { m.rx = m.rx || {}; if (b.emoji) m.rx[me] = String(b.emoji).slice(0, 8); else delete m.rx[me]; m.updated = db.seq++; }
      else if (a === "pin") { m.pinned = !!b.on; m.updated = db.seq++; }
      else if (a === "vote" && m.poll && !m.deleted) { if (+b.opt < 0) delete m.poll.votes[me]; else m.poll.votes[me] = +b.opt; m.updated = db.seq++; }
      else if (a === "locup" && m.loc && m.loc.live) { m.loc.lat = b.lat; m.loc.lng = b.lng; m.loc.acc = b.acc || 0; m.loc.at = now; m.updated = db.seq++; }
      else if (a === "locstop" && m.loc) { m.loc.live = false; m.updated = db.seq++; }
    }
    await saveDB(db);
    return J({ ok: true });
  }
  return J({ error: "method" }, 405);
};