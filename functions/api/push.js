import { pushPublicKey, pushSubscribe, pushGetLast } from "./_push.js";

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

export async function onRequestGet(ctx) {
  const q = new URL(ctx.request.url).searchParams;
  if (q.get("key")) return J({ key: await pushPublicKey(ctx.env.DB) });
  // Service worker fetches this when a push tickle arrives.
  return J(await pushGetLast(ctx.env.DB));
}

export async function onRequestPost(ctx) {
  const b = await ctx.request.json().catch(() => ({}));
  const ok = await pushSubscribe(ctx.env.DB, b.subscription, b.me);
  return ok ? J({ ok: true }) : J({ error: "bad" }, 400);
}
