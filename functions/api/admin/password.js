import { requireAdmin, checkLogin, makeCred, rotateSecret, makeToken, cookie, json } from "../../_lib.js";
export async function onRequestPost(ctx) {
  const deny = await requireAdmin(ctx);
  if (deny) return deny;
  let b = {};
  try { b = await ctx.request.json(); } catch {}
  const cur = JSON.parse((await ctx.env.FILES.get("admin:cred")) || "{}");
  if (!(await checkLogin(ctx.env, cur.u || "", b.current || ""))) return json({ error: "badcurrent" }, 401);
  const user = String(b.user || cur.u).trim().slice(0, 40);
  const pw = String(b.password || "");
  if (!user || pw.length < 6) return json({ error: "short" }, 400);
  await ctx.env.FILES.put("admin:cred", await makeCred(user, pw));
  await rotateSecret(ctx.env); // signs out every other session
  return json({ ok: true }, 200, { "set-cookie": cookie(await makeToken(ctx.env), 14 * 86400) });
}
