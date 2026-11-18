import { checkLogin, makeToken, cookie, json } from "../../_lib.js";
export async function onRequestPost(ctx) {
  const ip = ctx.request.headers.get("cf-connecting-ip") || "x";
  const k = "admin:rl:" + ip;
  const n = parseInt((await ctx.env.FILES.get(k)) || "0", 10);
  if (n >= 8) return json({ error: "toomany" }, 429);
  let b = {};
  try { b = await ctx.request.json(); } catch {}
  if (!(await checkLogin(ctx.env, b.user || "", b.password || ""))) {
    await ctx.env.FILES.put(k, String(n + 1), { expirationTtl: 900 });
    return json({ error: "bad" }, 401);
  }
  await ctx.env.FILES.delete(k);
  return json({ ok: true }, 200, { "set-cookie": cookie(await makeToken(ctx.env), 14 * 86400) });
}
