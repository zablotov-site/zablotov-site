// New media streams from R2. Legacy /f/u/ objects continue to resolve from KV.
function headers(type,size,etag) {
  const h = new Headers({"content-type":type||"application/octet-stream","content-length":String(size),"cache-control":"public, max-age=31536000, immutable","accept-ranges":"bytes","x-content-type-options":"nosniff"});
  if (etag) h.set("etag",etag);
  return h;
}
function rangeFor(request,size,etag) {
  const raw=request.headers.get("range");
  const ifRange=request.headers.get("if-range");
  if (!raw || (ifRange && ifRange!==etag)) return null;
  const m=/^bytes=(\d*)-(\d*)$/.exec(raw);
  if (!m || (!m[1]&&!m[2])) return false;
  let start,end;
  if (!m[1]) { const n=Number(m[2]); if(n<=0)return false; start=Math.max(0,size-n);end=size-1; }
  else {start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start<0||end<start)return false;
  return {offset:start,length:end-start+1};
}
async function serve(ctx) {
  const name=ctx.params.name||"";
  if(!/^[a-z0-9.-]+$/i.test(name))return new Response("nf",{status:404});
  const key="f/u/"+name;
  const meta=ctx.env.MEDIA ? await ctx.env.MEDIA.head(key) : null;
  let legacy=null;
  if(!meta) {
    legacy=await ctx.env.FILES.getWithMetadata(key,{type:"arrayBuffer"});
    if(!legacy?.value)return new Response("nf",{status:404});
  }
  const size=meta?meta.size:legacy.value.byteLength;
  const etag=meta?.httpEtag;
  const h=headers(meta?.httpMetadata?.contentType||legacy?.metadata?.type,size,etag);
  if(new URL(ctx.request.url).searchParams.has("dl"))h.set("content-disposition",'attachment; filename="'+name+'"');
  if(etag && ctx.request.headers.get("if-none-match")?.split(/,\s*/).some(t=>t==="*"||t===etag||t==="W/"+etag)) {
    h.delete("content-length");return new Response(null,{status:304,headers:h});
  }
  const range=ctx.request.method==="HEAD"?null:rangeFor(ctx.request,size,etag);
  if(range===false){h.set("content-range","bytes */"+size);h.set("content-length","0");return new Response(null,{status:416,headers:h});}
  if(range){h.set("content-range",`bytes ${range.offset}-${range.offset+range.length-1}/${size}`);h.set("content-length",String(range.length));}
  if(ctx.request.method==="HEAD")return new Response(null,{headers:h});
  if(meta){
    const obj=await ctx.env.MEDIA.get(key,range?{range}:{});
    if(!obj)return new Response("nf",{status:404});
    return new Response(obj.body,{status:range?206:200,headers:h});
  }
  return new Response(range?legacy.value.slice(range.offset,range.offset+range.length):legacy.value,{status:range?206:200,headers:h});
}
export const onRequestGet=serve;
export const onRequestHead=serve;
