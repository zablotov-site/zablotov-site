import { requireAdmin, sanitize, json } from "../../_lib.js";
export async function onRequestPut(ctx) {
  const deny = await requireAdmin(ctx);
  if (deny) return deny;
  let b;
  try { b = await ctx.request.json(); } catch { return json({ error: "badjson" }, 400); }
  const c = sanitize(b);
  await ctx.env.FILES.put("site:content", JSON.stringify(c));
  return json(c);
}
