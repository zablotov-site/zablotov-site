import {requireAdmin,json} from '../../_lib.js';
export async function onRequestGet(ctx){const deny=await requireAdmin(ctx);if(deny)return deny;
 const before=Number(new URL(ctx.request.url).searchParams.get('before'))||Number.MAX_SAFE_INTEGER;
 const [comments,banned]=await ctx.env.SOCIAL.batch([ctx.env.SOCIAL.prepare('SELECT c.id,c.shiur,c.body,c.created,c.device,p.name,p.banned FROM social_comments c JOIN social_profiles p ON p.id=c.device WHERE c.id<? ORDER BY c.id DESC LIMIT 101').bind(before),ctx.env.SOCIAL.prepare('SELECT id,name FROM social_profiles WHERE banned=1 ORDER BY created DESC LIMIT 100')]);return json({comments:comments.results.slice(0,100),next:comments.results.length>100?comments.results[99].id:null,banned:banned.results});}
export async function onRequestPost(ctx){const deny=await requireAdmin(ctx);if(deny)return deny;let b;try{b=await ctx.request.json()}catch{return json({error:'body'},400)}
 if(b.action==='delete'&&Number.isSafeInteger(b.id)){await ctx.env.SOCIAL.prepare('DELETE FROM social_comments WHERE id=?').bind(b.id).run();return json({ok:true});}
 if(b.action==='ban'&&/^[a-f0-9-]{36}$/.test(b.device)&&typeof b.banned==='boolean'){await ctx.env.SOCIAL.prepare('UPDATE social_profiles SET banned=? WHERE id=?').bind(b.banned?1:0,b.device).run();return json({ok:true});}
 return json({error:'action'},400);
}
