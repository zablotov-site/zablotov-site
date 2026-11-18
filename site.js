// Renders admin-managed content (from /api/content) into the static pages. The static HTML is the fallback.
(()=>{const p=location.pathname.replace(/\/+$/,"")||"/";
if(!["/","/meldungen","/shiurim","/info","/zmanim"].includes(p))return;
const $=(s)=>document.querySelector(s);
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function prose(t){const d=el("div","prose");String(t).split(/\n+/).filter(Boolean).forEach(l=>d.appendChild(el("p",null,l)));return d}
function empty(t){const d=el("div","empty");const s=el("span","empty-dot");s.setAttribute("aria-hidden","true");d.append(s,el("p",null,t));return d}
const dl='<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.65" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"/></svg>';
fetch("/api/content",{cache:"no-store"}).then(r=>r.json()).then(c=>{
 if(p==="/"){
  const learning=document.querySelector(".updates .update p");if(c.home&&c.home.learning&&learning)learning.textContent=c.home.learning;
  const host=$("#home-announcements"),list=$("#home-announcement-list");
  if(host&&list){list.replaceChildren();
   if(!c.meldungen.length)list.append(el("p","home-ann-empty","נאך נישטא קיין מעלדונגען. בקרוב אי״ה."));
   c.meldungen.forEach(x=>{const a=el("article","home-ann-item");a.id="home-ann-"+x.id;
    const top=el("div","home-ann-top");if(x.title)top.append(el("h3",null,x.title));if(x.date)top.append(el("span","home-ann-date",x.date));a.append(top);
    if(x.body)a.append(el("p","home-ann-body",x.body));list.append(a)});
   const b=document.querySelector('.extras a[href="/meldungen"]');if(b&&c.meldungen.length){const badge=el("span","ann-count",String(c.meldungen.length));b.append(badge);b.setAttribute("aria-label","מעלדונגען ("+c.meldungen.length+")")}
  }
 }
 if(p==="/meldungen"){const m=$("main");const old=m.querySelector(".empty, .mlist");if(!old)return;
  const box=el("div","mlist");
  if(!c.meldungen.length)box.appendChild(empty("נאך נישטא קיין מעלדונגען. בקרוב אי״ה."));
  c.meldungen.forEach(x=>{const a=el("article","block shiur");if(x.title)a.appendChild(el("h3","sefer-title",x.title));if(x.date)a.appendChild(el("p","small muted",x.date));if(x.body)a.appendChild(prose(x.body));box.appendChild(a)});
  old.replaceWith(box)}
 if(p==="/shiurim"){const m=$("main");m.querySelectorAll("article.shiur").forEach(a=>a.remove());
  if(!c.shiurim.length)m.appendChild(empty("נאך נישטא קיין שיעורים. בקרוב אי״ה."));
  c.shiurim.forEach(x=>{const a=el("article","block shiur");a.appendChild(el("h3","sefer-title",x.title));
   if(x.author)a.appendChild(el("p","sefer-author",x.author));if(x.date)a.appendChild(el("p","small muted",x.date));
   if(x.url&&x.kind==="audio"){const e=el("audio");e.controls=true;e.preload="none";e.src=x.url;a.appendChild(e)}
   if(x.url&&x.kind==="video"){const e=el("video");e.controls=true;e.playsInline=true;e.preload="metadata";e.src=x.url+"#t=0.1";a.appendChild(e)}
   if(x.desc){const d=prose(x.desc);d.classList.add("small");a.appendChild(d)}
   if(x.url){const b=el("div","sefer-btns");const l=el("a","btn btn-sm btn-ghost");l.href=x.kind==="link"?x.url:x.url+(x.url.startsWith("/f/")?"?dl=1":"");
    if(x.kind==="link"){l.target="_blank";l.rel="noopener";l.textContent="עפענען"}else{l.setAttribute("download","");l.innerHTML=dl+"דאונלאוד"}b.appendChild(l);a.appendChild(b)}
   m.appendChild(a)})}
 if(p==="/info"){const secs=document.querySelectorAll("main section.block");const i=c.info;
  [i.about,i.seder,null,i.contact].forEach((t,k)=>{const s=secs[k];if(!s||k===2)return;s.querySelectorAll(".empty,.prose").forEach(n=>n.remove());s.appendChild(t?prose(t):empty("נאך נישט צוגעלייגט"))});
  const s=secs[2];if(s){const btn=s.querySelector("p");s.querySelectorAll(".prose,.empty").forEach(n=>n.remove());
   const h=s.querySelector("h2");const nodes=[];if(i.place)nodes.push(prose(i.place));else nodes.push(empty("נאך נישט צוגעלייגט"));h.after(...nodes);
   if(btn){if(i.placeUrl){const a=btn.querySelector("a");if(a)a.href=i.placeUrl}else btn.remove()}}}
 if(p==="/zmanim"&&c.zmanimNote){const m=$("main");const b=el("section","block");b.appendChild(prose(c.zmanimNote));m.appendChild(b)}
}).catch(()=>{})})();
