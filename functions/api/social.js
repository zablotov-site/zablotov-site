import {json,getContent,deviceId,deviceToken,isAdmin} from '../_lib.js';
const text=(v,max)=>typeof v==='string'?v.normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,max):'';
async function rate(ctx,key,max,seconds){
 const now=Math.floor(Date.now()/1000),window=Math.floor(now/seconds);
 const r=await ctx.env.SOCIAL.prepare('INSERT INTO social_limits(key,window,n) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET n=CASE WHEN window=excluded.window THEN n+1 ELSE 1 END,window=excluded.window RETURNING n').bind(key,window).first();return r.n<=max;
}
async function ipHash(ctx){const raw=ctx.request.headers.get('cf-connecting-ip')||'local';const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');}
export async function onRequestGet(ctx){
 if(!ctx.env.SOCIAL)return json({error:'unavailable'},503);
 const db=ctx.env.SOCIAL,url=new URL(ctx.request.url),id=await deviceId(ctx);
 const profile=id?await db.prepare('SELECT name,banned FROM social_profiles WHERE id=?').bind(id).first():null;
 const shiur=url.searchParams.get('shiur');
 if(!shiur){
 const [likes,comments]=await db.batch([db.prepare('SELECT shiur,COUNT(*) AS n FROM social_likes l JOIN social_profiles p ON p.id=l.device WHERE p.banned=0 GROUP BY shiur'),db.prepare('SELECT shiur,COUNT(*) AS n FROM social_comments c JOIN social_profiles p ON p.id=c.device WHERE p.banned=0 GROUP BY shiur')]);
 const mine=id?(await db.prepare('SELECT shiur FROM social_likes WHERE device=?').bind(id).all()).results:[];
 return json({profile:profile?{name:profile.name,banned:!!profile.banned}:null,likes:likes.results,comments:comments.results,mine:mine.map(x=>x.shiur)});
 }
 if(!/^[a-z0-9]{1,24}$/i.test(shiur))return json({error:'shiur'},400);
 const before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;
 const afterName=text(url.searchParams.get('afterName')||'',40),afterId=text(url.searchParams.get('afterId')||'',36);
 if(url.searchParams.get('kind')==='likes'){
 const rows=(await db.prepare('SELECT p.name,p.id FROM social_likes l JOIN social_profiles p ON p.id=l.device WHERE l.shiur=? AND p.banned=0 AND (p.name>? OR (p.name=? AND p.id>?)) ORDER BY p.name,p.id LIMIT 51').bind(shiur,afterName,afterName,afterId).all()).results;
 const more=rows.length>50;const shown=rows.slice(0,50);return json({names:shown.map(r=>r.name),next:more?{afterName:shown.at(-1).name,afterId:shown.at(-1).id}:null});
 }
 const rows=(await db.prepare('SELECT c.id,c.body,c.created,p.name FROM social_comments c JOIN social_profiles p ON p.id=c.device WHERE c.shiur=? AND p.banned=0 AND c.id<? ORDER BY c.id DESC LIMIT 31').bind(shiur,before).all()).results;
 return json({comments:rows.slice(0,30),next:rows.length>30?rows[29].id:null});
}
export async function onRequestPost(ctx){
 if(!ctx.env.SOCIAL)return json({error:'unavailable'},503);
 if(ctx.request.headers.get('x-zb-social')!=='1'||(ctx.request.headers.get('origin')&&ctx.request.headers.get('origin')!==new URL(ctx.request.url).origin))return json({error:'forbidden'},403);
 if(Number(ctx.request.headers.get('content-length')||0)>8192)return json({error:'size'},413);
 let b;try{const raw=await ctx.request.text();if(raw.length>8192)return json({error:'size'},413);b=JSON.parse(raw)}catch{return json({error:'body'},400)}
 const db=ctx.env.SOCIAL,ip=await ipHash(ctx);
 if(!await rate(ctx,'ip:'+ip,60,60))return json({error:'rate'},429);
 let id=await deviceId(ctx);
 if(b.action==='profile'){
 const name=text(b.name,40);if(name.length<2)return json({error:'name'},400);
 if(id){const p=await db.prepare('SELECT name,banned FROM social_profiles WHERE id=?').bind(id).first();if(p)return p.banned?json({error:'banned'},403):json({name:p.name});}
 if(!await rate(ctx,'new:'+ip,5,86400))return json({error:'rate'},429);
 id=crypto.randomUUID();await db.prepare('INSERT INTO social_profiles(id,name,created) VALUES(?,?,?)').bind(id,name,Date.now()).run();
 return json({name},200,{'set-cookie':`zb_device=${await deviceToken(ctx.env,id)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`});
 }
 if(!id)return json({error:'identity'},401);
 const p=await db.prepare('SELECT name,banned FROM social_profiles WHERE id=?').bind(id).first();if(!p)return json({error:'identity'},401);if(p.banned)return json({error:'banned'},403);
 if(!await rate(ctx,'dev:'+id,30,60))return json({error:'rate'},429);
 const content=await getContent(ctx.env);if(!content.shiurim.some(s=>s.id===b.shiur))return json({error:'shiur'},404);
 if(b.action==='like'&&typeof b.liked==='boolean'){
 if(b.liked)await db.prepare('INSERT OR IGNORE INTO social_likes(shiur,device,created) VALUES(?,?,?)').bind(b.shiur,id,Date.now()).run();
 else await db.prepare('DELETE FROM social_likes WHERE shiur=? AND device=?').bind(b.shiur,id).run();
 const count=await db.prepare('SELECT COUNT(*) AS n FROM social_likes l JOIN social_profiles p ON p.id=l.device WHERE l.shiur=? AND p.banned=0').bind(b.shiur).first();return json({liked:b.liked,count:count.n});
 }
 if(b.action==='comment'){
 const body=text(b.body,1000);if(!body)return json({error:'empty'},400);
 if(!await rate(ctx,'comment:'+id,5,60)||!await rate(ctx,'commentday:'+id,60,86400))return json({error:'rate'},429);
 const created=Date.now();const r=await db.prepare('INSERT INTO social_comments(shiur,device,body,created) VALUES(?,?,?,?) RETURNING id').bind(b.shiur,id,body,created).first();return json({comment:{id:r.id,body,created,name:p.name}},201);
 }
 return json({error:'action'},400);
}
