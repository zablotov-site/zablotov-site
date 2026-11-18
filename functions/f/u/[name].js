export async function onRequestGet(ctx) {
  const name = ctx.params.name || "";
  if (!/^[a-z0-9.-]+$/i.test(name)) return new Response("nf", { status: 404 });
  const key = "f/u/" + name;
  let r = null;
  for (let i = 0; i < 4; i++) {
    r = await ctx.env.FILES.getWithMetadata(key, { type: "arrayBuffer" });
    if (r && r.value) break;
    await new Promise((res) => setTimeout(res, 600));
  }
  if (!r || !r.value) return new Response("nf", { status: 404 });
  const h = { "content-type": (r.metadata && r.metadata.type) || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" };
  if (new URL(ctx.request.url).searchParams.get("dl")) h["content-disposition"] = "attachment";
  return new Response(r.value, { headers: h });
}
