(()=>{
const $=s=>document.querySelector(s),feed=$('#feed'),sheet=$('#sheet'),body=$('#sheet-body');
let content=[],profile=null,stats={likes:[],comments:[],mine:[]},filter='all',observer,toastTimer,sheetShiur=null;
const e=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
const icons={comment:'<svg viewBox="0 0 24 24"><path d="M21 11a8 8 0 0 1-8 8H6l-4 3 2-7a8 8 0 1 1 17-4Z"/></svg>',share:'↥',download:'↓'};
function toast(t){const n=$('#toast');n.textContent=t;n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,5000)}
async function api(path,opt={}){const r=await fetch(path,{...opt,headers:{'x-zb-social':'1',...(opt.headers||{})},credentials:'same-origin',cache:'no-store'});let j={};try{j=await r.json()}catch{}if(!r.ok)throw Object.assign(Error(j.error||'network'),{status:r.status});return j}
function error(x){toast(x.status===429?'צו פיל אין איין מאל - פרוביר שפעטער':x.message==='banned'?'דער אפאראט איז אפגעשפארט דורכן אדמין':'נישט געלונגען. פרוביר נאכאמאל.')}
function open(title){$('#sheet-title').textContent=title;body.replaceChildren();if(!sheet.open)sheet.showModal()}
$('#sheet-close').onclick=()=>sheet.close();sheet.onclick=ev=>{if(ev.target===sheet){const r=sheet.getBoundingClientRect();if(ev.clientY<r.top||ev.clientX<r.left||ev.clientX>r.right)sheet.close()}};
function nameLabel(){ $('#myname').textContent=profile?.name||'דיין נאמען'; }
async function refresh(){stats=await api('/api/social');profile=stats.profile;nameLabel()}
function identity(){if(profile){if(profile.banned){toast('דער אפאראט איז אפגעשפארט דורכן אדמין');return Promise.resolve(false)}return Promise.resolve(true)}
 return new Promise(resolve=>{open('ווי הייסטו?');body.append(e('p','sheet-note','דיין נאמען וועט זיין זעבאר פאר אלעמען ביי לייקס און קאמענטארן. שרייב דיין אייגענעם נאמען. נעמען ווערן נישט וועריפיצירט. דער נאמען בלייבט אויף דעם אפאראט; אן אקאונט אדער פאסווארד.'));
 const f=e('form','sheet-form'),input=e('input');input.required=true;input.minLength=2;input.maxLength=40;input.autocomplete='nickname';input.placeholder='דיין נאמען';input.setAttribute('aria-label','דיין נאמען');const b=e('button',null,'שפייכער מיין נאמען');f.append(input,b);body.append(f);
 let done=false;const close=()=>{if(!done)resolve(false)};sheet.addEventListener('close',close,{once:true});
 f.onsubmit=async ev=>{ev.preventDefault();b.disabled=true;try{const r=await api('/api/social',{method:'POST',body:JSON.stringify({action:'profile',name:input.value})});profile={name:r.name,banned:false};try{localStorage.setItem('zb_display_name',r.name)}catch{}nameLabel();done=true;sheet.close();resolve(true)}catch(x){error(x)}finally{b.disabled=false}};
 });
}
$('#myname').onclick=()=>{if(!profile){identity();return}open('דיין נאמען');body.append(e('p',null,profile.name),e('p','sheet-note','דער נאמען איז געבונדן צו דעם אפאראט און ווערט געוויזן פאר אלעמען. נעמען ווערן נישט וועריפיצירט. א נייע בראוזער אדער אויסמעקן cookies שאפט א נייע אידענטיטעט.'))};
function count(kind,id){return (stats[kind]||[]).find(x=>x.shiur===id)?.n||0}
function setCount(kind,id,n){const a=stats[kind],v=a.find(x=>x.shiur===id);if(v)v.n=n;else a.push({shiur:id,n})}
function action(icon,label,fn){const b=e('button','sh-action');b.type='button';const i=e('i');if(icon.startsWith('<'))i.innerHTML=icon;else i.textContent=icon;const t=e('span',null,label);b.append(i,t);b.onclick=fn;return b}
async function likedList(s,append=false,cursor=null){
 if(!append){open('ווער האט געלייקט');body.append(e('p','sheet-note','יעדער שרייבט זיין אייגענעם נאמען. נעמען ווערן נישט וועריפיצירט.'));}
 try{const u=new URLSearchParams({shiur:s.id,kind:'likes',...(cursor||{})});const j=await api('/api/social?'+u);if(!j.names.length&&!append)body.append(e('p','sheet-note','זיי דער ערשטער צו לייקן.'));j.names.forEach(name=>{const r=e('div','person');r.append(e('span','avatar',name[0]),e('span',null,name));body.append(r)});if(j.next){const more=e('button','loadmore','נאך נעמען');more.onclick=()=>{more.remove();likedList(s,true,j.next)};body.append(more)}}catch(x){error(x)}
}
function commentRow(c){const r=e('div','comment'),t=e('div');const date=new Intl.DateTimeFormat('he',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(c.created));t.append(e('b',null,c.name),e('small',null,date),e('p',null,c.body));r.append(e('span','avatar',c.name[0]),t);return r}
async function comments(s){open('קאמענטארן');sheetShiur=s.id;body.append(e('p','sheet-note','שמועסן מיט דרך ארץ. דיין נאמען און קאמענטאר זענען זעבאר פאר אלעמען. דער אדמין קען אויסמעקן אדער אפשפארן.'));
 const list=e('div'),form=e('form','sheet-form'),input=e('textarea');input.required=true;input.maxLength=1000;input.rows=2;input.placeholder='שרייב א קאמענטאר…';input.setAttribute('aria-label','דיין קאמענטאר');const send=e('button',null,'שיק קאמענטאר');form.append(input,send);body.append(form,list);
 async function load(before){try{const j=await api('/api/social?'+new URLSearchParams({shiur:s.id,...(before?{before}: {})}));if(!j.comments.length&&!before)list.append(e('p','sheet-note','נאך נישטא קיין קאמענטארן.'));j.comments.forEach(c=>list.append(commentRow(c)));if(j.next){const more=e('button','loadmore','עלטערע קאמענטארן');more.onclick=()=>{more.remove();load(j.next)};list.append(more)}}catch(x){error(x)}}await load();
 form.onsubmit=async ev=>{ev.preventDefault();const text=input.value.trim();if(!text)return;
 if(!profile){const saved=text;if(await identity()){await comments(s);$('#sheet-body textarea').value=saved;toast('דיין נאמען איז געשפייכערט. דרוק שיק נאכאמאל.')}return;}
 send.disabled=true;try{const j=await api('/api/social',{method:'POST',body:JSON.stringify({action:'comment',shiur:s.id,body:text})});list.querySelector('.sheet-note')?.remove();list.prepend(commentRow(j.comment));input.value='';setCount('comments',s.id,count('comments',s.id)+1);updateCard(s.id)}catch(x){error(x)}finally{send.disabled=false}
 };
}
function updateCard(id){const card=[...feed.children].find(n=>n.dataset.id===id);if(!card)return;const n=count('likes',id),liked=stats.mine.includes(id);const heart=card.querySelector('.heart');heart.classList.toggle('liked',liked);heart.setAttribute('aria-pressed',String(liked));heart.setAttribute('aria-label',liked?'נעם אראפ דיין לייק':'לייק דעם שיעור');heart.querySelector('span').textContent=n+' לייקס';card.querySelector('.who').textContent=n?'זע ווער האט געלייקט ('+n+') ‹':'זיי דער ערשטער צו לייקן ‹';card.querySelector('.comments-count').querySelector('span').textContent=count('comments',id)+' קאמענטארן'}
function render(){feed.querySelectorAll('video,audio').forEach(m=>m.pause());observer?.disconnect();feed.replaceChildren();const list=content.filter(s=>filter==='all'||(filter==='chizuk'?s.desc.includes('חיזוק'):s.kind===filter));if(!list.length){feed.append(e('p','empty-feed','נאך נישטא קיין שיעורים אין דער סארט.'));return}
 observer=new IntersectionObserver(entries=>entries.forEach(entry=>{const m=entry.target.querySelector('video,audio');if(!entry.isIntersecting&&m)m.pause();if(entry.isIntersecting&&m&&m.preload==='none'){m.preload='metadata';m.load()}if(entry.isIntersecting)history.replaceState(null,'','#'+entry.target.dataset.id)}),{root:feed,threshold:.65});
 list.forEach((s,idx)=>{const a=e('article','short-card');a.dataset.id=s.id;a.id='shiur-'+s.id;
 const box=e('div','sh-media');if(s.kind==='video'){const m=e('video');m.controls=true;m.playsInline=true;m.preload='metadata';m.src=s.url+'#t=0.1';m.setAttribute('aria-label',s.title);box.append(m)}else if(s.kind==='audio'){const art=e('div','audio-art');art.append(e('div','disc','♫'),e('h3',null,s.title));const m=e('audio');m.controls=true;m.preload='none';m.src=s.url;m.setAttribute('aria-label',s.title);box.append(art,m)}else{const l=e('a','btn','עפענען דעם שיעור ↗');l.href=s.url;l.target='_blank';l.rel='noopener';box.append(l)}
 box.querySelectorAll('video,audio').forEach(m=>m.addEventListener('error',()=>{if(!box.querySelector('.media-err')){const n=e('p','media-err','נישט געלונגען צו שפילן. נוץ דעם דאונלאוד קנעפל.');n.style.cssText='position:absolute;top:0;padding:12px;font-size:12px;background:#261a2c';box.append(n)}}));
 const details=e('div','sh-details');details.append(e('h2',null,s.title));if(s.author)details.append(e('p',null,s.author));if(s.desc&&s.desc!=='חיזוק')details.append(e('p','desc',s.desc));const who=e('button','who');who.type='button';who.onclick=()=>likedList(s);details.append(who,e('div','sh-next',idx+1<list.length?'⌃ סקראל צום נעקסטן שיעור':'דאס זענען אלע שיעורים'));
 const rail=e('div','sh-rail');const heart=action('♥','',async()=>{if(!await identity())return;heart.disabled=true;try{const r=await api('/api/social',{method:'POST',body:JSON.stringify({action:'like',shiur:s.id,liked:!stats.mine.includes(s.id)})});stats.mine=stats.mine.filter(id=>id!==s.id);if(r.liked)stats.mine.push(s.id);setCount('likes',s.id,r.count);updateCard(s.id)}catch(x){error(x)}finally{heart.disabled=false}});heart.classList.add('heart');
 const c=action(icons.comment,'',()=>comments(s));c.classList.add('comments-count');c.setAttribute('aria-label','עפענען קאמענטארן');
 const share=action('↥','טיילן',async()=>{const url=location.origin+'/shiurim#'+s.id;try{if(navigator.share)await navigator.share({title:s.title,url});else{await navigator.clipboard.writeText(url);toast('לינק קאפירט')}}catch{}});share.setAttribute('aria-label','טיילן דעם שיעור');
 const dl=e('a','sh-action');dl.href=s.url+(s.url.startsWith('/f/')?'?dl=1':'');dl.download='';dl.append(e('i',null,'↓'),e('span',null,'דאונלאוד'));
 rail.append(heart,c,share,dl);a.append(box,e('span','sh-tag',(s.desc.includes('חיזוק')?'חיזוק · ':'')+(s.kind==='audio'?'אודיא':s.kind==='video'?'וידעא':'לינק')),details,rail);feed.append(a);updateCard(s.id);observer.observe(a)});
 feed.scrollTop=0;
}
$('.sh-filters').onclick=ev=>{const b=ev.target.closest('button');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('.sh-filters button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()};
document.addEventListener('visibilitychange',()=>{if(document.hidden)feed.querySelectorAll('video,audio').forEach(m=>m.pause())});
feed.addEventListener('keydown',ev=>{if(!['ArrowDown','ArrowUp'].includes(ev.key)||/INPUT|TEXTAREA|VIDEO|AUDIO/.test(ev.target.tagName))return;ev.preventDefault();feed.scrollBy({top:feed.clientHeight*(ev.key==='ArrowDown'?1:-1),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})});
(async()=>{try{const c=await(await fetch('/api/content',{cache:'no-store'})).json();content=c.shiurim;try{await refresh()}catch{toast('לייקס און קאמענטארן זענען צייטווייליג נישט פאראן')}const initial=location.hash.slice(1);render();if(initial)document.getElementById('shiur-'+initial)?.scrollIntoView({block:'start'})}catch{feed.replaceChildren(e('p','empty-feed','נישט געלונגען צו לאדן. פריש דעם בלאט.'))}})();
})();
