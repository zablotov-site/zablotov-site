(()=>{
const $=(s)=>document.querySelector(s);
let C=null,tab="meldungen",dirty=false;
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
const TABS=[["meldungen","מעלדונגען"],["shiurim","שיעורים"],["info","אינפא"],["home","היים און זמנים"],["pw","פאסווארד"]];
function render(){
 const t=$("#tabs");t.replaceChildren(...TABS.map(([k,n])=>el("button",{type:"button","aria-pressed":String(k===tab),onclick:()=>{tab=k;render()}},n)));
 const v=$("#view");v.replaceChildren();
 $("#save").hidden=tab==="pw";
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
    try{const r=await api("/api/admin/upload",{method:"POST",body:f,headers:{"content-type":f.type||"application/octet-stream"}});m.url=r.url;if(f.type.startsWith("video"))m.kind="video";else if(f.type.startsWith("audio"))m.kind="audio";dirty=true;status("אפגעלאדן - שפייכער נאך");render()}
    catch(e){status(e.j&&e.j.error==="toobig"?"דער פייל איז צו גרויס (מאקס 24MB) - נוץ א לינק":"נישט געלונגען צו לאדן ארויף",1)}});
   v.append(el("div",{class:"adm-item"},field("טיטל",m,"title"),field("רבי / מגיד שיעור",m,"author"),dateField(m),field("באשרייבונג",m,"desc",{area:1}),el("label",{},"סארט",sel),field("לינק צום פייל",m,"url",{ph:"https://… אדער לאד ארויף אונטן"}),el("label",{},"אדער לאד ארויף א פייל (עד 24MB)",fi),itemBar(C.shiurim,i)))});
  if(!C.shiurim.length)v.append(el("p",{class:"muted"},"נאך נישטא קיין שיעורים."));
 }
 if(tab==="info"){const i=C.info;v.append(el("div",{class:"adm-item"},field("וועגן דער חבורה",i,"about",{area:1}),field("סדר הלימוד און זמנים",i,"seder",{area:1}),field("פלאץ",i,"place",{area:1}),field("מאפעס לינק",i,"placeUrl",{ph:"https://maps.app.goo.gl/…"}),field("קאנטאקט",i,"contact",{area:1})))}
 if(tab==="home"){v.append(el("div",{class:"adm-item"},el("h3",{class:"h"},"היים בלאט"),field("מען לערנט יעצט",C.home,"learning",{area:1,ph:"וואס די חבורה לערנט"}),el("p",{class:"small muted"},"די קארטל \"לעצטע מעלדונגען\" ווייזט אויטאמאטיש די נייסטע מעלדונג.")),el("div",{class:"adm-item"},el("h3",{class:"h"},"זמנים בלאט"),field("הערה אונטער די זמנים",C,"zmanimNote",{area:1,ph:"למשל: זמן פון דער חבורה"}),el("p",{class:"small muted"},"די זמנים אליין קומען אויטאמאטיש פון hebcal.")))}
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
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
api("/api/admin/me").then(async r=>{if(r.admin){await load();show(true)}else show(false)}).catch(()=>show(false));
})();
