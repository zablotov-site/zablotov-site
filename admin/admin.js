(()=>{
const $=(s)=>document.querySelector(s);
let C=null,tab="meldungen",dirty=false,uploading=false,socialBefore=null;
const H={"x-zb-admin":"1"};
async function api(path,opt={}){const r=await fetch(path,{...opt,headers:{...H,...(opt.headers||{})},credentials:"same-origin"});let j={};try{j=await r.json()}catch{}if(!r.ok)throw Object.assign(new Error(j.error||"err"),{status:r.status,j});return j}
function el(t,a={},...k){const e=document.createElement(t);for(const[n,v]of Object.entries(a)){if(n==="class")e.className=v;else if(n.startsWith("on"))e.addEventListener(n.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(n,v)}k.flat().forEach(x=>e.append(x));return e}
const heb=()=>{try{return new Intl.DateTimeFormat("he-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric",timeZone:"America/New_York"}).format(new Date())}catch{return""}};
const uid=()=>Math.random().toString(36).slice(2,10);
function status(t,bad){const s=$("#st");s.textContent=t;s.style.color=bad?"#a23838":""}
function field(label,obj,key,{area,type,ph}={}){const i=area?el("textarea"):el("input",{type:type||"text"});i.value=obj[key]||"";if(ph)i.placeholder=ph;i.addEventListener("input",()=>{obj[key]=i.value;dirty=true});return el("label",{},label,i)}
function move(arr,i,d){const j=i+d;if(j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];dirty=true;render()}
function dateField(o){const f=field("דאטום",o,"date");const b=el("button",{class:"btn btn-sm btn-ghost",type:"button",onclick:()=>{o.date=heb();dirty=true;render()}},"היינטיגער דאטום");f.append(b);return f}
function itemBar(arr,i){return el("div",{class:"adm-row"},
 el("button",{class:"btn btn-sm btn-ghost",type:"button",onclick:()=>move(arr,i,-1)},"↑"),
 el("button",{class:"btn btn-sm btn-ghost",type:"button",onclick:()=>move(arr,i,1)},"↓"),
 el("button",{class:"btn btn-sm btn-danger",type:"button",onclick:()=>{if(confirm("אויסמעקן?")){arr.splice(i,1);dirty=true;render()}}},"אויסמעקן"))}
const TABS=[["meldungen","מעלדונגען"],["shiurim","שיעורים"],["info","אינפא"],["home","היים און זמנים"],["social","לייקס און קאמענטארן"],["pw","פאסווארד"]];
function render(){
 const t=$("#tabs");t.replaceChildren(...TABS.map(([k,n])=>el("button",{type:"button","aria-pressed":String(k===tab),onclick:()=>{tab=k;socialBefore=null;render()}},n)));
 const v=$("#view");v.replaceChildren();
 $("#save").hidden=tab==="pw"||tab==="social";
 if(tab==="meldungen"){
  v.append(el("button",{class:"btn",type:"button",onclick:()=>{C.meldungen.unshift({id:uid(),title:"",body:"",date:heb()});dirty=true;render()}},"+ נייע מעלדונג"));
  C.meldungen.forEach((m,i)=>v.append(el("div",{class:"adm-item"},field("קעפל",m,"title"),field("טעקסט",m,"body",{area:1}),dateField(m),itemBar(C.meldungen,i))));
  if(!C.meldungen.length)v.append(el("p",{class:"muted"},"נאך נישטא קיין מעלדונגען."));
 }
 if(tab==="shiurim"){
  v.append(el("button",{class:"btn",type:"button",onclick:()=>{C.shiurim.unshift({id:uid(),title:"",author:"",date:heb(),desc:"",kind:"audio",url:""});dirty=true;render()}},"+ נייער שיעור"));
  C.shiurim.forEach((m,i)=>{
   const sel=el("select",{},...[["audio","אודיא"],["video","וידעא"],["link","לינק"]].map(([k,n])=>el("option",{value:k,selected:m.kind===k},n)));sel.addEventListener("change",()=>{m.kind=sel.value;dirty=true});
   const fi=el("input",{type:"file",accept:"audio/*,video/*,application/pdf"});
   fi.addEventListener("change",async()=>{const f=fi.files[0];if(!f)return;status("לאדט ארויף…");
    uploading=true;
    const locks=[...document.querySelectorAll("#panel input,#panel textarea,#panel select,#panel button")].map(e=>[e,e.disabled]);locks.forEach(([e])=>e.disabled=true);
    let session=null;
    try{
     if(f.size>5*1024*1024*1024)throw Object.assign(new Error("toobig"),{j:{error:"toobig"}});
     const known={mp3:"audio/mpeg",m4a:"audio/mp4",aac:"audio/aac",wav:"audio/wav",ogg:"audio/ogg",flac:"audio/flac",mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm",pdf:"application/pdf"};
     const type=f.type||known[f.name.split(".").pop().toLowerCase()]||"application/octet-stream";
     session=await api("/api/admin/upload?action=create",{method:"POST",body:JSON.stringify({type,size:f.size})});
     const parts=[];
     for(let offset=0,n=1;offset<f.size;offset+=session.chunkSize,n++){
      const body=f.slice(offset,Math.min(offset+session.chunkSize,f.size));
      let part;
      for(let attempt=0;attempt<3;attempt++){
       try{part=await api("/api/admin/upload?action=part&part="+n,{method:"PUT",headers:{"x-zb-upload":session.token},body});break}
       catch(e){if(attempt===2||e.status===401||e.status===403)throw e;await new Promise(r=>setTimeout(r,1000*(attempt+1)))}
      }
      parts.push(part);status("לאדט ארויף… "+Math.round(Math.min(offset+session.chunkSize,f.size)/f.size*100)+"%");
     }
     const r=await api("/api/admin/upload?action=complete",{method:"POST",headers:{"x-zb-upload":session.token},body:JSON.stringify({parts})});
     session=null;m.url=r.url;if(type.startsWith("video"))m.kind="video";else if(type.startsWith("audio"))m.kind="audio";dirty=true;status("אפגעלאדן - שפייכער נאך");render();
    }catch(e){
     if(session)try{await api("/api/admin/upload?action=abort",{method:"POST",headers:{"x-zb-upload":session.token}})}catch{}
     status(e.j&&e.j.error==="toobig"?"דער פייל איז צו גרויס (מאקס 5GB)":e.j&&e.j.error==="type"?"דער סארט פייל ווערט נישט געשטיצט":"נישט געלונגען צו לאדן ארויף - פרוביר נאכאמאל",1);
    }finally{uploading=false;locks.forEach(([e,disabled])=>{if(e.isConnected)e.disabled=disabled})}
   });
   v.append(el("div",{class:"adm-item"},field("טיטל",m,"title"),field("רבי / מגיד שיעור",m,"author"),dateField(m),field("באשרייבונג",m,"desc",{area:1}),el("label",{},"סארט",sel),field("לינק צום פייל",m,"url",{ph:"https://… אדער לאד ארויף אונטן"}),el("label",{},"אדער לאד ארויף א פייל (ביז 5GB)",fi),itemBar(C.shiurim,i)))});
  if(!C.shiurim.length)v.append(el("p",{class:"muted"},"נאך נישטא קיין שיעורים."));
 }
 if(tab==="info"){const i=C.info;v.append(el("div",{class:"adm-item"},field("וועגן דער חבורה",i,"about",{area:1}),field("סדר הלימוד און זמנים",i,"seder",{area:1}),field("פלאץ",i,"place",{area:1}),field("מאפעס לינק",i,"placeUrl",{ph:"https://maps.app.goo.gl/…"}),field("קאנטאקט",i,"contact",{area:1})))}
 if(tab==="home"){v.append(el("div",{class:"adm-item"},el("h3",{class:"h"},"היים בלאט"),field("מען לערנט יעצט",C.home,"learning",{area:1,ph:"וואס די חבורה לערנט"}),el("p",{class:"small muted"},"די קארטל \"לעצטע מעלדונגען\" ווייזט אויטאמאטיש די נייסטע מעלדונג.")),el("div",{class:"adm-item"},el("h3",{class:"h"},"זמנים בלאט"),field("הערה אונטער די זמנים",C,"zmanimNote",{area:1,ph:"למשל: זמן פון דער חבורה"}),el("p",{class:"small muted"},"די זמנים אליין קומען אויטאמאטיש פון hebcal.")))}
 if(tab==="social"){
  const box=el("div",{class:"adm-item"},el("h3",{},"קאמענטארן און אפגעשפארטע אפאראטן"));v.append(box);
  box.append(el("p",{class:"small"},"אפשפארן באהאלט אלע לייקס און קאמענטארן פון דעם אפאראט. נעמען זענען נישט וועריפיצירט. א נייע בראוזער קען שאפן א נייע אידענטיטעט."));
  api("/api/admin/social"+(socialBefore?"?before="+socialBefore:"")).then(data=>{
   if(tab!=="social")return;
   const titles=Object.fromEntries(C.shiurim.map(s=>[s.id,s.title]));
   if(!data.comments.length)box.append(el("p",{},"נאך נישטא קיין קאמענטארן."));
   data.comments.forEach(c=>{
    const del=el("button",{class:"btn btn-sm btn-danger",type:"button",onclick:async()=>{if(!confirm("אויסמעקן דעם קאמענטאר?"))return;try{await api("/api/admin/social",{method:"POST",body:JSON.stringify({action:"delete",id:c.id})});render()}catch{status("נישט געלונגען",1)}}},"אויסמעקן");
    const ban=el("button",{class:"btn btn-sm btn-ghost",type:"button",onclick:async()=>{if(!confirm("אפשפארן דעם אפאראט?"))return;try{await api("/api/admin/social",{method:"POST",body:JSON.stringify({action:"ban",device:c.device,banned:true})});render()}catch{status("נישט געלונגען",1)}}},c.banned?"אפגעשפארט":"שפאר אפ דעם אפאראט");
    const body=el("p",{});body.textContent=c.body;body.style.whiteSpace="pre-wrap";body.style.overflowWrap="anywhere";
    box.append(el("div",{class:"adm-item"},el("b",{},c.name),el("p",{class:"small"},titles[c.shiur]||c.shiur),body,el("div",{class:"adm-row"},del,ban)));
   });
   if(data.next)box.append(el("button",{class:"btn btn-sm btn-ghost",type:"button",onclick:()=>{socialBefore=data.next;render()}},"עלטערע קאמענטארן"));if(socialBefore)box.append(el("button",{class:"btn btn-sm btn-ghost",type:"button",onclick:()=>{socialBefore=null;render()}},"די נייסטע קאמענטארן"));
   if(data.banned.length){box.append(el("h3",{},"אפגעשפארטע אפאראטן"));data.banned.forEach(p=>box.append(el("div",{class:"adm-row"},el("span",{},p.name),el("button",{class:"btn btn-sm btn-ghost",type:"button",onclick:async()=>{try{await api("/api/admin/social",{method:"POST",body:JSON.stringify({action:"ban",device:p.id,banned:false})});render()}catch{status("נישט געלונגען",1)}}},"מאך ווידער אויף"))))}
  }).catch(()=>{box.append(el("p",{},"נישט געלונגען צו לאדן. פרוביר נאכאמאל."))});
 }
 if(tab==="pw"){const o={user:"",current:"",password:""};
  v.append(el("div",{class:"adm-item"},field("יוזערניים (לאז ליידיג = דער זעלבער)",o,"user"),field("יעצטיגער פאסווארד",o,"current",{type:"password"}),field("נייער פאסווארד (מינ׳ 6)",o,"password",{type:"password"}),
   el("button",{class:"btn",type:"button",onclick:async()=>{try{await api("/api/admin/password",{method:"POST",body:JSON.stringify(o)});status("פאסווארד געביטן");o.current=o.password="";render()}catch(e){status(e.message==="badcurrent"?"יעצטיגער פאסווארד איז פאלש":"נייער פאסווארד צו קורץ",1)}}},"בייט פאסווארד")))}
}
async function save(){status("שפייכערט…");try{C=await api("/api/admin/content",{method:"PUT",body:JSON.stringify(C)});dirty=false;status("געשפייכערט ✓ - איז יעצט אויפן וועבזייטל");render()}catch(e){if(e.status===401){status("די סעשן איז אויס - לאג אריין נאכאמאל",1);show(false)}else status("נישט געלונגען צו שפייכערן",1)}}
function show(ok){$("#login").hidden=ok;$("#panel").hidden=!ok}
async function load(){C=await (await fetch("/api/content",{cache:"no-store"})).json();render()}
$("#reveal").addEventListener("change",()=>{$("#lp").type=$("#reveal").checked?"text":"password"});
$("#lp").addEventListener("keyup",e=>{$("#caps").hidden=!e.getModifierState("CapsLock")});
$("#lf").addEventListener("submit",async e=>{e.preventDefault();$("#lerr").hidden=true;
 try{await api("/api/admin/login",{method:"POST",body:JSON.stringify({user:$("#lu").value,password:$("#lp").value})});$("#lp").value="";await load();show(true)}
 catch(x){const m=$("#lerr");m.textContent=x.status===429?"צו פיל פראבירט - וואַרט 15 מינוט":x.status===401?"פאלשער יוזערניים אדער פאסווארד - קוק מיט ווייז פאסווארד":"פארבינדונג נישט געלונגען - פרוביר נאכאמאל";m.hidden=false}});
$("#save").addEventListener("click",save);
$("#out").addEventListener("click",async()=>{await api("/api/admin/logout",{method:"POST"});show(false)});
window.addEventListener("beforeunload",e=>{if(dirty||uploading){e.preventDefault();e.returnValue=""}});
api("/api/admin/me").then(async r=>{if(r.admin){await load();show(true)}else show(false)}).catch(()=>show(false));
})();
