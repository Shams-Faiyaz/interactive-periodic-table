/* perf.js — automatic performance mode.
   Watches real frame times while the scene is moving. If the device cannot hold a smooth
   rate, it switches to "lite": no aurora/grain/blur layers, lower pixel ratio, slower starfield.
   The Effects menu lets the user force Auto / Full / Lite; the choice is remembered. */
const PT_PERF=(function(){
  let mode="auto"; try{ mode=localStorage.getItem("pt-fx")||"auto"; }catch(_){}
  if(!["auto","full","lite"].includes(mode)) mode="auto";
  let autoLite=false, lite=false, sum=0, n=0, strikes=0;
  const t0=performance.now();
  function apply(announce){
    const want=(mode==="lite")||(mode==="auto"&&autoLite);
    if(want!==lite){
      lite=want;
      document.body.classList.toggle("perf-lite",lite);
      if(typeof renderer!=="undefined"&&renderer&&renderer.setPixelRatio){ renderer.setPixelRatio(tilePixelRatio()); render(); }
      if(typeof bohr!=="undefined"&&bohr.renderer) sizeBohr();
      if(typeof shapes!=="undefined"&&shapes.renderer) sizeShapes();
      if(announce&&lite&&typeof toast==="function") toast("Performance mode on — effects reduced to keep things smooth");
    }
    document.querySelectorAll("#fxSel,#mFx").forEach(s=>{ s.value=mode; });
  }
  // called once per rendered frame; `moving` = a tween or the camera is in motion
  function frame(dt,moving){
    if(mode!=="auto"||autoLite||!moving) return;
    if(performance.now()-t0<2500||dt>0.25) return;          // ignore start-up and tab-switch hitches
    sum+=dt; n++;
    if(n<40) return;
    const avg=sum/n; sum=0; n=0;
    if(avg>1/42){ if(++strikes>=2){ autoLite=true; apply(true); } } else strikes=0;
  }
  function setMode(m){ mode=m; try{ localStorage.setItem("pt-fx",m); }catch(_){} if(m!=="auto") autoLite=false; strikes=0; apply(false); }
  return { frame,setMode,apply, get lite(){ return lite; }, get mode(){ return mode; } };
})();
function tilePixelRatio(){ return Math.min(window.devicePixelRatio||1, PT_PERF.lite?1.25:2); }
function atomPixelRatio(){ return Math.min(window.devicePixelRatio||1, PT_PERF.lite?1.25:2); }
