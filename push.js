(()=>{const ub=s=>{s=s.replace(/-/g,"+").replace(/_/g,"/");const p="=".repeat((4-s.length%4)%4);const r=atob(s+p);return Uint8Array.from([...r].map(c=>c.charCodeAt(0)))};
const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),st=matchMedia("(display-mode: standalone)").matches||navigator.standalone;
const subjson=s=>{if(s.toJSON)return s.toJSON();const o={endpoint:s.endpoint,keys:{}};const p=s.getKey&&s.getKey("p256dh"),a=s.getKey&&s.getKey("auth");if(p)o.keys.p256dh=btoa(String.fromCharCode(...new Uint8Array(p))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");if(a)o.keys.auth=btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");return o};
async function sub(){if(!("serviceWorker" in navigator)||!("PushManager" in window)){return{err:ios&&!st?"ios":"nosupport"}}
const perm=await Notification.requestPermission();if(perm!=="granted")return{err:"denied"};
const reg=await navigator.serviceWorker.register("/sw.js");await navigator.serviceWorker.ready;
const k=(await (await fetch("/api/push?key=1")).json()).key;let s=await reg.pushManager.getSubscription();if(!s)s=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:ub(k)});
const r=await fetch("/api/push",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({subscription:subjson(s),me:localStorage.getItem("chatMe")||""})});return r.ok?{ok:true}:{err:"server"}}
async function state(){try{if(!("serviceWorker" in navigator)||!("PushManager" in window))return"no";const reg=await navigator.serviceWorker.getRegistration();const s=reg&&await reg.pushManager.getSubscription();return s&&Notification.permission==="granted"?"on":"off"}catch(e){return"off"}}
window.zbPush={sub,state};
const en=/(?:^|;\s*)zl=en/.test(document.cookie)||/(?:^|;\s*)lang=en/.test(document.cookie);const L=(y,e)=>en?e:y;
const b=document.getElementById("pushbtn");if(!b)return;const t=document.getElementById("pushst"),io=document.getElementById("pushios");if(ios&&!st)io.hidden=false;
const upd=async()=>{const s=await state();if(s==="on"){b.textContent=L("✓ נאטיפיקאציעס זענען אן","✓ Notifications are on");b.disabled=true}};upd();
b.onclick=async()=>{b.disabled=true;const r=await sub().catch(e=>({err:String(e)}));b.disabled=false;if(r.ok){upd();return}
t.textContent=r.err==="ios"?L("אויף אייפאון מוז מען ערשט לייגן דעם עפ אויפ׳ן היים-סקרין און עס עפענען פון דארט.","On iPhone, first add the app to the Home Screen and open it from there."):r.err==="denied"?L("נאטיפיקאציעס זענען אפגעזאגט — לאז עס צו אין די פאון סעטינגס.","Notifications were blocked — allow them in the phone settings."):L("עס איז נישט געגאנגען אויף דעם פאון.","Didn't work on this phone.")}})();
