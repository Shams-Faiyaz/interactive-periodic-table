/* core.js — shared state, constants, colour helpers and the legend.
   All files are classic deferred scripts that share one global scope, loaded in the order listed in table.html. */
/* ---- main application logic ---- */
  const reduceMotion = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  let tempK = 298;      // phase-at-temperature slider (kelvin)
  let NATIVE_TZOOM = false;   // true on touch: OrbitControls handles pinch-zoom
  let lastFocus = null; // element to restore focus to when the detail overlay closes
  let THEME_NEBULA = [[80,120,255],[150,90,255],[40,180,200],[255,90,160]];
  const CATEGORY_COLORS = {
    "Nonmetal":"#4ade80","Noble gas":"#c084fc","Alkali metal":"#f87171","Alkaline earth":"#fb923c",
    "Metalloid":"#2dd4bf","Halogen":"#facc15","Post-transition metal":"#38bdf8","Transition metal":"#60a5fa",
    "Lanthanide":"#f472b6","Actinide":"#e879f9","Unknown":"#94a3b8"
  };
  const CAPTIONS = {
    table:"Classic layout — rows are periods (energy levels), columns are groups (shared properties).",
    sphere:"Every element on a globe — orbit it from outside, or step inside for a 360° view.",
    sphereIn:"You're inside the sphere — drag to look around, click any element, then step back out.",
    helix:"A spiral in atomic-number order — follow it to see periodic trends repeat as you climb.",
    grid:"Elements split into their s / p / d / f blocks as depth layers — step through them below."
  };

  let camera, scene, renderer, controls;
  const objects = [];
  const cards = [];               // {el, data}
  const targets = { table:[], sphere:[], sphereIn:[], helix:[], grid:[], sort:[] };
  let sphereInside = false;
  let sortAsc = false;   // sort direction: false = high→low
  const fitDist = {};             // camera distance that frames each layout
  let curLayout = "table";
  let colorMode = "cat";
  const gridBlocks = [];          // [{key,z,hw,hh,count,members}] one per s/p/d/f layer
  let curGridLayer = 0;

  const CARD_HALF = 70;           // half the diagonal footprint of a card, in scene units
  // Touch/narrow screens: frame every layout a bit tighter so element cards render
  // larger on-screen (bigger tap targets) without touching per-card spacing math.
  const TAP_ZOOM = ((window.matchMedia && matchMedia("(pointer:coarse)").matches) || window.innerWidth<=640) ? 0.82 : 1;

  // CHANGED (new helper): true while the detail overlay OR the Guide/About overlay is open,
  // so keyboard shortcuts stop reaching the 3D scene behind them.
  function anyOverlayOpen(){
    return ["overlay"].some(id=>{
      const el=document.getElementById(id);
      return !!el && el.classList.contains("show");
    });
  }
  // distance the camera needs so a layout's extent fits the current viewport
  function computeFit(arr){
    let hw=0,hh=0;
    arr.forEach(o=>{ hw=Math.max(hw,Math.abs(o.position.x)); hh=Math.max(hh,Math.abs(o.position.y)); });
    hw+=CARD_HALF; hh+=CARD_HALF;
    const vFOV=THREE.MathUtils.degToRad(camera.fov)/2;
    const asp=camera.aspect||1.6;
    const zH=hh/Math.tan(vFOV);
    const zW=(hw/asp)/Math.tan(vFOV);
    return Math.max(zH,zW)*1.04*TAP_ZOOM;
  }

  /* ---------- colour helpers ---------- */
  function lerpColor(a,b,t){
    const ah=a.match(/\w\w/g).map(x=>parseInt(x,16));
    const bh=b.match(/\w\w/g).map(x=>parseInt(x,16));
    const r=Math.round(ah[0]+(bh[0]-ah[0])*t), g=Math.round(ah[1]+(bh[1]-ah[1])*t), bl=Math.round(ah[2]+(bh[2]-ah[2])*t);
    return "#"+[r,g,bl].map(x=>x.toString(16).padStart(2,"0")).join("");
  }
  // blue -> cyan -> green -> yellow -> red heatmap
  const HEAT=["1e3a8a","0891b2","16a34a","eab308","dc2626"];
  function heat(t){ t=Math.max(0,Math.min(1,t)); const s=t*(HEAT.length-1); const i=Math.floor(s); if(i>=HEAT.length-1)return "#"+HEAT[HEAT.length-1]; return lerpColor(HEAT[i],HEAT[i+1],s-i); }

  // FIX: atomic mass is stored as a string ("1.0080", "[227]"), so the old
  // `typeof v === "number"` test threw every mass away and left the range as
  // [Infinity, -Infinity]. numOf() coerces numeric strings first.
  function numOf(v){                                                   // CHANGED (new helper)
    if(typeof v==="number") return isFinite(v)?v:null;
    if(typeof v==="string"){ const n=parseFloat(v.replace(/[\[\]()~]/g,"")); return isFinite(n)?n:null; }
    return null;
  }
  function propRange(key){
    const vals=ELEMENTS.map(e=>numOf(e[key])).filter(v=>v!==null);     // CHANGED
    if(!vals.length) return [0,1];                                     // CHANGED (no more Infinity)
    return [Math.min(...vals),Math.max(...vals)];
  }
  const PHASE_COL={solid:"#8fd0ff",liquid:"#6ee7a8",gas:"#ff9d6b",none:"#4a4f5a"};
  function phaseAt(e,T){
    const m=(typeof e.melt==="number")?e.melt:null;
    const b=(typeof e.boil==="number")?e.boil:null;
    if(m===null&&b===null) return "none";
    if(b!==null&&T>=b) return "gas";
    if(m!==null&&T<m) return "solid";
    if(m!==null) return "liquid";      // melt <= T < boil (boil may be unknown)
    return "solid";                    // only boiling point known and T < boil
  }
  function colorFor(e){
    if(colorMode==="cat") return CATEGORY_COLORS[e.cat]||CATEGORY_COLORS.Unknown;
    if(colorMode==="phase") return PHASE_COL[phaseAt(e,tempK)];
    const [lo,hi]=propRange(colorMode);
    const v=numOf(e[colorMode]);                 // CHANGED
    if(v===null) return "#3a3f4a";               // CHANGED
    return heat((v-lo)/(hi-lo||1));
  }
  function applyColors(){
    // PERF: only touch tiles whose colour actually changed
    cards.forEach(c=>{ const col=colorFor(c.data); if(c._c!==col){ c._c=col; c.el.style.setProperty("--c",col); } });
    buildLegend();
  }

  /* ---------- legend ---------- */
  function buildLegend(){
    const rows=document.getElementById("legendRows");
    const scale=document.getElementById("scalebar");
    const ttl=document.getElementById("legendTitle");
    if(colorMode==="phase"){
      rows.style.display="none"; scale.style.display="none";
      ttl.textContent="Phase — see temperature key above";
      return;
    }
    if(colorMode==="cat"){
      scale.style.display="none"; rows.style.display="flex"; rows.style.flexDirection="column"; rows.style.gap="4px";
      ttl.textContent="Categories";
      rows.innerHTML="";
      Object.entries(CATEGORY_COLORS).forEach(([cat,color])=>{
        const r=document.createElement("div"); r.className="row"; r.dataset.cat=cat;
        r.innerHTML=`<span class="sw" style="background:${color};color:${color}"></span>${cat}`;
        r.addEventListener("click",()=>toggleCategory(cat,r));
        rows.appendChild(r);
      });
    } else {
      rows.innerHTML=""; rows.style.display="none"; scale.style.display="flex";
      const names={en:"Electronegativity",melt:"Melting point (K)",boil:"Boiling point (K)",radius:"Atomic radius (pm)",ie:"Ionization energy (eV)",ea:"Electron affinity (eV)",mass:"Atomic mass (u)",density:"Density (g/cm³)"};
      ttl.textContent=names[colorMode]||"Scale";
      const [lo,hi]=propRange(colorMode);
      scale.querySelector(".grad").style.background=`linear-gradient(90deg,${HEAT.map(h=>"#"+h).join(",")})`;
      document.getElementById("scaleMin").textContent=lo;
      document.getElementById("scaleMax").textContent=hi;
    }
  }
