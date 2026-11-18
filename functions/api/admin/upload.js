import { requireAdmin, json, signUpload, readUpload } from "../../_lib.js";
const TYPES = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/flac": "flac", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const CHUNK = 10 * 1024 * 1024;
const MAX = 5 * 1024 * 1024 * 1024;
async function handle(ctx) {
  const deny = await requireAdmin(ctx);
  if (deny) return deny;
  if (!ctx.env.MEDIA) return json({error:"storage_unavailable"},503);
  const url = new URL(ctx.request.url);
  const action = url.searchParams.get("action");
  try {
    if (action === "create" && ctx.request.method === "POST") {
      const {type, size} = await ctx.request.json();
      if (!TYPES[type]) return json({error:"type"},415);
      if (!Number.isSafeInteger(size) || size <= 0) return json({error:"empty"},400);
      if (size > MAX) return json({error:"toobig",max:MAX},413);
      const key = "f/u/" + crypto.randomUUID() + "." + TYPES[type];
      const upload = await ctx.env.MEDIA.createMultipartUpload(key,{httpMetadata:{contentType:type,cacheControl:"public, max-age=31536000, immutable"},storageClass:"Standard"});
      const token = await signUpload(ctx.env,{key,uploadId:upload.uploadId,size,exp:Date.now()+24*60*60*1000});
      return json({token,chunkSize:CHUNK,maxSize:MAX});
    }
    const token = ctx.request.headers.get("x-zb-upload");
    const data = await readUpload(ctx.env, token);
    if (!data) return json({error:"invalid_upload"},400);
    const upload = ctx.env.MEDIA.resumeMultipartUpload(data.key,data.uploadId);
    if (action === "part" && ctx.request.method === "PUT") {
      const n = Number(url.searchParams.get("part"));
      const count = Math.ceil(data.size/CHUNK);
      if (!Number.isInteger(n) || n<1 || n>count) return json({error:"part"},400);
      const expected = n===count ? data.size-(n-1)*CHUNK : CHUNK;
      if (Number(ctx.request.headers.get("content-length")) !== expected) return json({error:"part_size"},400);
      return json(await upload.uploadPart(n,ctx.request.body));
    }
    if (action === "complete" && ctx.request.method === "POST") {
      const {parts} = await ctx.request.json();
      if (!Array.isArray(parts) || parts.length !== Math.ceil(data.size/CHUNK) || parts.some((p,i)=>p.partNumber!==i+1 || typeof p.etag!=="string" || p.etag.length>200)) return json({error:"parts"},400);
      const obj = await upload.complete(parts);
      if (obj.size !== data.size) { await ctx.env.MEDIA.delete(data.key); return json({error:"size_mismatch"},400); }
      return json({url:"/"+data.key,size:obj.size});
    }
    if (action === "abort" && ctx.request.method === "POST") { await upload.abort(); return json({ok:true}); }
    return json({error:"action"},400);
  } catch { return json({error:"upload_failed"},400); }
}
export const onRequestPost = handle;
export const onRequestPut = handle;
