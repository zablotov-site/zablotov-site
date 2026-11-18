(()=>{const d=document,b=d.getElementById("fsb");const en=/(?:^|;\s*)zl=en/.test(d.cookie);
const st=matchMedia("(display-mode: fullscreen)").matches||matchMedia("(display-mode: standalone)").matches||navigator.standalone;
const can=d.documentElement.requestFullscreen||d.documentElement.webkitRequestFullscreen;
if(!b)return;if(st||!can){b.hidden=true;return}
const isFs=()=>!!(d.fullscreenElement||d.webkitFullscreenElement);
const lab=()=>{b.textContent=isFs()?(en?"✕ Exit full screen":"✕ פארלאז פול סקרין"):(en?"⛶ Full screen":"⛶ פול סקרין")};
const go=()=>{const e=d.documentElement;try{(e.requestFullscreen||e.webkitRequestFullscreen).call(e,{navigationUI:"hide"})}catch(x){}};
b.onclick=()=>{if(isFs()){localStorage.setItem("zbFs","0");(d.exitFullscreen||d.webkitExitFullscreen).call(d)}else{localStorage.setItem("zbFs","1");go()}};
d.addEventListener("fullscreenchange",lab);d.addEventListener("webkitfullscreenchange",lab);lab();
if(localStorage.getItem("zbFs")!=="0"){const f=()=>{if(!isFs())go();d.removeEventListener("pointerup",f,true)};d.addEventListener("pointerup",f,true)}})();
