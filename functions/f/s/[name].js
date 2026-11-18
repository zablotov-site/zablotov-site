// Proxies ONLY the 80MB sefer (over Pages' 25MB asset limit) from GitHub Releases.
// Every other /f/s/* file is a normal static asset - fall through with ctx.next().
const BIG = "mwl6e4ovcdez5hu6bg.pdf";
export async function onRequestGet(ctx) {
  const name = ctx.params.name;
  if (name !== BIG) return ctx.next();
  const upstream = "https://github.com/zablotov-site/zablotov-site/releases/download/v1/" + name;
  const headers = new Headers();
  const range = ctx.request.headers.get("range");
  if (range) headers.set("range", range);
  const res = await fetch(upstream, { headers, redirect: "follow" });
  const out = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  if (!out.has("content-type")) out.set("content-type", "application/pdf");
  out.set("cache-control", "public, max-age=86400");
  out.set("access-control-allow-origin", "*");
  return new Response(res.body, { status: res.status, headers: out });
}
