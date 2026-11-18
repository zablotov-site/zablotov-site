import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeToken} from '../functions/_lib.js';
import {onRequestPost,onRequestPut} from '../functions/api/admin/upload.js';
import {onRequestGet,onRequestHead} from '../functions/f/u/[name].js';
const kv=new Map();
const objects=new Map(),uploads=new Map();
const env={FILES:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v),getWithMetadata:async k=>({value:kv.get(k)||null,metadata:{type:'audio/mpeg'}})},MEDIA:{
 createMultipartUpload:async(key,opt)=>{const uploadId=crypto.randomUUID();uploads.set(uploadId,{key,opt,parts:new Map()});return {uploadId};},
 resumeMultipartUpload:(key,id)=>({uploadPart:async(n,b)=>{const u=uploads.get(id);assert.equal(u.key,key);const bytes=new Uint8Array(await new Response(b).arrayBuffer());u.parts.set(n,bytes);return {partNumber:n,etag:'part'+n};},complete:async parts=>{const u=uploads.get(id),bytes=Buffer.concat(parts.map(p=>u.parts.get(p.partNumber)));objects.set(key,{bytes,httpMetadata:u.opt.httpMetadata});uploads.delete(id);return {size:bytes.length};},abort:async()=>uploads.delete(id)}),
 head:async key=>{const o=objects.get(key);return o?{size:o.bytes.length,httpEtag:'"test"',httpMetadata:o.httpMetadata}:null;},
 get:async(key,opt)=>{const o=objects.get(key);return o?{body:opt?.range?o.bytes.subarray(opt.range.offset,opt.range.offset+opt.range.length):o.bytes}:null;},
 delete:async key=>objects.delete(key)
}};
const cookie='zb_admin='+await makeToken(env);
function req(action,method,body,extra={}){const h={'x-zb-admin':'1',cookie,...extra};if(body instanceof Uint8Array)h['content-length']=String(body.byteLength);return {env,request:new Request('https://test/api/admin/upload?action='+action,{method,body,headers:h})};}
async function post(action,data,token){const ctx=req(action,'POST',JSON.stringify(data),token?{'x-zb-upload':token}:{});const r=await onRequestPost(ctx);assert.equal(r.status,200,await r.clone().text());return r.json();}
let name;
test('upload gate rejects anonymous writes',async()=>{const c=req('create','POST','{}');c.request=new Request(c.request,{headers:{'x-zb-admin':'1'}});assert.equal((await onRequestPost(c)).status,401);});
test('35MiB multipart upload, range reads, download and HEAD',async()=>{
 const size=35*1024*1024;
 const s=await post('create',{type:'audio/mpeg',size});const parts=[];
 for(let p=1,offset=0;offset<size;p++,offset+=s.chunkSize){const bytes=new Uint8Array(Math.min(s.chunkSize,size-offset)).fill(p);const r=await onRequestPut(req('part&part='+p,'PUT',bytes,{'x-zb-upload':s.token}));assert.equal(r.status,200);parts.push(await r.json());}
 const out=await post('complete',{parts},s.token);name=out.url.split('/').pop();assert.equal(out.size,size);
 const ctx={env,params:{name},request:new Request('https://test'+out.url+'?dl=1')};
 let r=await onRequestGet(ctx);assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,size);assert.match(r.headers.get('content-disposition'),/^attachment/);
 for(const [range,status,length,first] of [['bytes=0-99',206,100,1],['bytes=-100',206,100,4],['bytes=10485760-10485859',206,100,2],['bytes=9999999999-',416,0,null],['bytes=4-2',416,0,null]]){r=await onRequestGet({...ctx,request:new Request('https://test'+out.url,{headers:{range}})});assert.equal(r.status,status);const b=new Uint8Array(await r.arrayBuffer());assert.equal(b.length,length);if(first)assert.equal(b[0],first);}
 r=await onRequestHead({...ctx,request:new Request('https://test'+out.url,{method:'HEAD'})});assert.equal(r.headers.get('content-length'),String(size));assert.equal((await r.arrayBuffer()).byteLength,0);
 r=await onRequestGet({...ctx,request:new Request('https://test'+out.url,{headers:{'if-none-match':'"test"'}})});assert.equal(r.status,304);
});
test('legacy KV objects retain URLs and gain range support',async()=>{kv.set('f/u/old.mp3',new Uint8Array([1,2,3,4]).buffer);const r=await onRequestGet({env,params:{name:'old.mp3'},request:new Request('https://test/f/u/old.mp3',{headers:{range:'bytes=1-2'}})});assert.equal(r.status,206);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[2,3]);});
test('reject invalid types, oversized uploads and forged upload claims',async()=>{
 assert.equal((await onRequestPost(req('create','POST',JSON.stringify({type:'text/html',size:10})))).status,415);
 assert.equal((await onRequestPost(req('create','POST',JSON.stringify({type:'audio/mpeg',size:6*1024**3})))).status,413);
 assert.equal((await onRequestPut(req('part&part=1','PUT',new Uint8Array(3),{'x-zb-upload':'forged.claim'}))).status,400);
});
