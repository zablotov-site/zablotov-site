import { requireAdmin, json } from "../../_lib.js";
const TYPES = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/ogg": "ogg", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export async function onRequestPost(ctx) {
  const deny = await requireAdmin(ctx);
  if (deny) return deny;
  const type = (ctx.request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return json({ error: "type" }, 415);
  const buf = await ctx.request.arrayBuffer();
  if (buf.byteLength > 24 * 1024 * 1024) return json({ error: "toobig" }, 413);
  if (!buf.byteLength) return json({ error: "empty" }, 400);
  const name = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + "." + ext;
  await ctx.env.FILES.put("f/u/" + name, buf, { metadata: { type } });
  return json({ url: "/f/u/" + name });
}
