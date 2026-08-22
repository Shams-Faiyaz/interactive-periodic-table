/* ---- shared icon set ---- */
/* ADDED: one shared inline-SVG icon set, so every control is a real vector
   instead of a unicode glyph. Defined before the app scripts so they can use it. */
window.PT_ICONS = (function(){
  const s = (d, extra) => '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + (extra||'') + d + '</svg>';
  return {
    reset:   s('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
    download:s('<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>'),
    plus:    s('<path d="M12 5v14M5 12h14"/>'),
    minus:   s('<path d="M5 12h14"/>'),
    close:   s('<path d="M18 6L6 18M6 6l12 12"/>'),
    left:    s('<path d="M15 5l-7 7 7 7"/>'),
    right:   s('<path d="M9 5l7 7-7 7"/>'),
    down:    s('<path d="M6 9l6 6 6-6"/>'),
    share:   s('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/>'),
    play:    s('<path d="M7 4l12 8-12 8V4z" fill="currentColor" stroke="none"/>'),
    pause:   s('<rect x="7" y="4" width="3.6" height="16" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="4" width="3.6" height="16" rx="1.2" fill="currentColor" stroke="none"/>'),
    sort:    s('<path d="M7 4v16"/><path d="M3.5 16.5L7 20l3.5-3.5"/><path d="M13 6h8"/><path d="M13 11h5"/><path d="M13 16h3"/>'),
    sliders: s('<path d="M4 7h10"/><path d="M18 7h2"/><path d="M4 17h5"/><path d="M13 17h7"/><circle cx="16" cy="7" r="2.2"/><circle cx="11" cy="17" r="2.2"/>'),
    search:  s('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>'),
    sphereIn:s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
    sphereOut:s('<circle cx="12" cy="12" r="4"/><path d="M12 8V2M12 22v-6M8 12H2M22 12h-6"/>'),
    thermo:  s('<path d="M12 14.8V4.5a2.2 2.2 0 1 1 4.4 0v10.3a4 4 0 1 1-4.4 0z" transform="translate(-2.2 0)"/><path d="M12 9h2.5"/>'),
    clear:   s('<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>'),
    layers:  s('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
    soundOn: s('<path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a9 9 0 0 1 0 12"/>'),
    soundOff:s('<path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>')
  };
})();

/* ---- element data is loaded globally from elements-data.js (see table.html) ---- */

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
    cards.forEach(c=>c.el.style.setProperty("--c",colorFor(c.data)));
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

  /* ---------- build scene ---------- */
  function init(){
    ELEMENTS.forEach(e=>{ e.mass=+e.mass; });   // FIX: mass was a string → broke sort & colour-by
    camera=new THREE.PerspectiveCamera(40,window.innerWidth/window.innerHeight,1,10000);
    camera.position.z=3000;
    scene=new THREE.Scene();

    ELEMENTS.forEach(e=>{
      const el=document.createElement("div");
      el.className="element";
      el.tabIndex=0; el.setAttribute("role","button");
      el.setAttribute("aria-label",`${e.name}, symbol ${e.sym}, atomic number ${e.n}, ${e.cat}`);
      el.dataset.n=e.n; el.title=e.name;
      el.style.setProperty("--c",CATEGORY_COLORS[e.cat]||CATEGORY_COLORS.Unknown);
      el.innerHTML=`<div class="catbar"></div><div class="wt">${e.block}</div><div class="number">${e.n}</div>
        <div class="symbol">${e.sym}</div><div class="name">${e.name}</div><div class="mass">${(+e.mass).toFixed(2)}</div><div class="pval"></div>`;
      el.addEventListener("click",ev=>{ev.stopPropagation();openDetail(e);});
      // Touch: OrbitControls treats a finger-down as a pan, which swallows the tap/click.
      // Detect a genuine tap (little movement, short time) and open the card ourselves.
      let _tx=0,_ty=0,_tt=0,_moved=false;
      el.addEventListener("touchstart",ev=>{ const t=ev.changedTouches[0]; _tx=t.clientX;_ty=t.clientY;_tt=Date.now();_moved=false; },{passive:true});
      el.addEventListener("touchmove",ev=>{ const t=ev.changedTouches[0]; if(Math.abs(t.clientX-_tx)>12||Math.abs(t.clientY-_ty)>12) _moved=true; },{passive:true});
      el.addEventListener("touchend",ev=>{ if(!_moved && ev.touches.length===0 && Date.now()-_tt<500){ ev.preventDefault(); ev.stopPropagation(); openDetail(e); } },{passive:false});
      el.addEventListener("keydown",ev=>{
        if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); ev.stopPropagation(); openDetail(e); return; }
        if(curLayout==="table" && !overlay.classList.contains("show")) handleCardArrow(ev,e);
      });
      const obj=new THREE.CSS3DObject(el);
      obj.position.set(Math.random()*4000-2000,Math.random()*4000-2000,Math.random()*4000-2000);
      scene.add(obj); objects.push(obj); cards.push({el,data:e});
    });

    // table — centred: columns 1..18 (mid 9.5), rows 1..10 (mid 5.75 incl. the f-block gap)
    ELEMENTS.forEach(e=>{
      const o=new THREE.Object3D();
      o.position.x=(e.col-9.5)*132;
      o.position.y=(5.75-e.row)*164;
      targets.table.push(o);
    });
    const v=new THREE.Vector3(), n=objects.length;
    for(let i=0;i<n;i++){ // sphere — outward-facing (viewed from outside)
      const phi=Math.acos(-1+(2*i)/n), theta=Math.sqrt(n*Math.PI)*phi;
      const o=new THREE.Object3D(); o.position.setFromSphericalCoords(820,phi,theta);
      v.copy(o.position).multiplyScalar(2); o.lookAt(v); targets.sphere.push(o);
      // same shell, but inward-facing (viewed from the centre — planetarium)
      const oi=new THREE.Object3D(); oi.position.copy(o.position); oi.lookAt(0,0,0);
      targets.sphereIn.push(oi);
    }
    for(let i=0;i<n;i++){ // helix
      const theta=i*0.175+Math.PI, y=-(i*8)+450;
      const o=new THREE.Object3D(); o.position.setFromCylindricalCoords(950,theta,y);
      v.set(o.position.x*2,o.position.y,o.position.z*2); o.lookAt(v); targets.helix.push(o);
    }
    // grid — one flat centred sub-grid per block (s/p/d/f); gridFocus() brings one forward, hides the rest
    const BLOCK_COLS={s:7,p:6,d:10,f:15}, BLOCK_ORDER=["s","p","d","f"];
    for(let i=0;i<n;i++) targets.grid.push(new THREE.Object3D());
    BLOCK_ORDER.forEach((bk)=>{
      const members=[]; ELEMENTS.forEach((e,i)=>{ if(e.block===bk) members.push(i); });
      const cols=BLOCK_COLS[bk], rows=Math.ceil(members.length/cols);
      const sub=members.map((gi,j)=>({gi, x:((j%cols)-(cols-1)/2)*138, y:((rows-1)/2-Math.floor(j/cols))*168}));
      gridBlocks.push({key:bk, members, sub, hw:(cols-1)/2*138+70, hh:(rows-1)/2*168+70, count:members.length});
    });

    renderer=new THREE.CSS3DRenderer();
    const cont=document.getElementById("container");
    renderer.setSize(cont.clientWidth,cont.clientHeight);
    cont.appendChild(renderer.domElement);

    controls=new THREE.OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true; controls.dampingFactor=0.09;
    controls.rotateSpeed=0.55; controls.enableZoom=false;   // desktop zoom via buttons/slider/Ctrl only
    controls.enablePan=true; controls.screenSpacePanning=true;   // right-drag pans on desktop
    controls.minDistance=350; controls.maxDistance=9000;
    // Touch UX: one finger = ROTATE the 3D scene (sphere/helix/grid need this), two fingers = pinch-zoom.
    // A quick tap still opens an element (handled per-card); a drag rotates.
    const IS_TOUCH = (window.matchMedia && matchMedia("(pointer:coarse)").matches) || ("ontouchstart" in window);
    if(IS_TOUCH && THREE.TOUCH){
      controls.enableZoom=true; controls.zoomSpeed=0.9;
      controls.touches={ ONE:THREE.TOUCH.ROTATE, TWO:THREE.TOUCH.DOLLY_PAN };
      NATIVE_TZOOM=true;                                    // native pinch handles zoom → skip custom pinch
      let _st=false;
      controls.addEventListener("change",()=>{ if(_st) return; _st=true; requestAnimationFrame(()=>{ _st=false; syncZoomSlider(); }); });
    }
    controls.target.set(0,0,0);

    ["table","sphere","helix","grid"].forEach(name=>{
      document.getElementById("btn-"+name).addEventListener("click",()=>setLayout(name));
    });
    // highlight multi-select dropdown
    const hlBtn=document.getElementById("hlBtn"), hlMenu=document.getElementById("hlMenu");
    hlBtn.addEventListener("click",ev=>{ ev.stopPropagation(); hlMenu.classList.toggle("open"); });
    document.addEventListener("click",ev=>{ if(!document.getElementById("highlightDD").contains(ev.target)) hlMenu.classList.remove("open"); });
    hlMenu.querySelectorAll("input[type=checkbox]").forEach(cb=>{
      cb.addEventListener("change",()=>{ const set=filters[cb.dataset.group];
        if(cb.checked) set.add(cb.dataset.k); else set.delete(cb.dataset.k); applyFilters(); });
    });
    document.getElementById("clearFilters").addEventListener("click",clearFilters);
    buildGroupPeriodBars();
    document.getElementById("colorby").addEventListener("change",e=>{ setColorMode(e.target.value); });
    document.getElementById("sortby").addEventListener("change",e=>setSort(e.target.value));
    document.getElementById("sortDir").addEventListener("click",()=>{
      sortAsc=!sortAsc;
      const _sd=document.getElementById("sortDir");                    // CHANGED: keep the SVG, swap only the label
      _sd.classList.toggle("asc",sortAsc);
      _sd.querySelector("#sortDirLbl").innerHTML=sortAsc?"low&rarr;high":"high&rarr;low";
      const s=document.getElementById("sortby").value; if(s) setSort(s);
    });
    document.getElementById("search").addEventListener("input",e=>applySearch(e.target.value.trim().toLowerCase()));
    // zoom controls
    document.getElementById("zoomIn").addEventListener("click",()=>zoomBy(0.82));
    document.getElementById("zoomOut").addEventListener("click",()=>zoomBy(1.22));
    document.getElementById("resetView").addEventListener("click",resetView);
    document.getElementById("zoomSlider").addEventListener("input",e=>setZoomFromSlider(+e.target.value));
    renderer.domElement.addEventListener("wheel",e=>{
      e.preventDefault();
      if(e.ctrlKey||e.metaKey){ zoomBy(e.deltaY>0?1.1:0.9); return; } // Ctrl/⌘ + wheel = zoom
      let dx=e.deltaX, dy=e.deltaY;                                   // trackpads give deltaX for sideways
      if(e.shiftKey && !dx){ dx=e.deltaY; dy=0; }                     // Shift + wheel = sideways on a mouse
      panScreen(dx*0.9, dy*0.9);                                      // scroll pans; view follows the scroll
    },{passive:false});
    window.addEventListener("keydown",e=>{
      if((e.ctrlKey||e.metaKey)&&(e.key==="="||e.key==="+")){ e.preventDefault(); zoomBy(0.82); }
      if((e.ctrlKey||e.metaKey)&&(e.key==="-"||e.key==="_")){ e.preventDefault(); zoomBy(1.22); }
      // R = reset current view (ignore while typing, with modifier keys, or behind an open overlay)
      const typing=/^(INPUT|TEXTAREA|SELECT)$/.test((e.target&&e.target.tagName)||"");
      if(anyOverlayOpen()) return;              // CHANGED: R used to reset the scene behind Guide/About
      if((e.key==="r"||e.key==="R") && !typing && !e.ctrlKey && !e.metaKey && !e.altKey){ resetView(); }
    });

    buildLayerNav();
    document.getElementById("layPrev").addEventListener("click",()=>gridFocus((curGridLayer-1+gridBlocks.length)%gridBlocks.length));
    document.getElementById("layNext").addEventListener("click",()=>gridFocus((curGridLayer+1)%gridBlocks.length));
    document.getElementById("sphereToggle").addEventListener("click",()=>{ sphereInside?exitOutside():enterInside(); });
    document.addEventListener("keydown",e=>{
      if(curLayout!=="grid"||overlay.classList.contains("show"))return;
      if(e.key==="ArrowRight"||e.key==="ArrowDown") gridFocus((curGridLayer+1)%gridBlocks.length);
      if(e.key==="ArrowLeft"||e.key==="ArrowUp") gridFocus((curGridLayer-1+gridBlocks.length)%gridBlocks.length);
    });

    buildLegend();
    setCaption("table");
    layout();                                  // size viewport + compute fit distances
    camera.position.set(0,0,fitDist.table);    // start framed on the table
    controls.update();
    transform(targets.table,1800,fitDist.table); // gentle fly-in from scattered start
    syncZoomSlider();
    window.addEventListener("resize",onResize);
    // Rotating a phone/tablet fires orientationchange; the viewport size settles a beat later,
    // so re-run the layout after a short delay so nothing ends up mis-framed.
    window.addEventListener("orientationchange",()=>{ setTimeout(onResize,250); setTimeout(onResize,600); });
  }

  // size the render area to the space *below* the header, and recompute fit distances
  function layout(){
    const cont=document.getElementById("container");
    const headerBottom=document.getElementById("controls").getBoundingClientRect().bottom;
    const top=Math.round(headerBottom+16);
    cont.style.top=top+"px";
    document.getElementById("groupBar").style.top=Math.round(headerBottom+6)+"px";
    const pb=document.getElementById("periodBar"); pb.style.top=(top+6)+"px"; pb.style.bottom="70px";
    const w=cont.clientWidth, h=cont.clientHeight;
    renderer.setSize(w,h);
    camera.aspect=w/h; camera.updateProjectionMatrix();
    ["table","sphere","helix","grid"].forEach(nm=>fitDist[nm]=computeFit(targets[nm]));
    render();
  }

  function placeInstant(arr){
    for(let i=0;i<objects.length;i++){ objects[i].position.copy(arr[i].position); objects[i].rotation.copy(arr[i].rotation); }
    render();
  }

  function setCaption(name){ document.getElementById("caption").textContent=CAPTIONS[name]; }

  function setLayout(name){
    if(window.PT_SFX && curLayout!==name) window.PT_SFX.whoosh();
    document.querySelectorAll("#controls .bar button").forEach(b=>b.classList.remove("active"));
    document.getElementById("btn-"+name).classList.add("active");
    // leaving sort mode: restore normal card faces + clear its value labels/dims
    document.body.classList.remove("sortmode");
    document.getElementById("sortby").value="";
    cards.forEach(c=>c.el.classList.remove("dim","match"));
    if(anyFilter()) applyFilters();
    curLayout=name;
    { const mv=document.getElementById("mView"); if(mv && ["table","sphere","helix","grid"].includes(name) && mv.value!==name) mv.value=name; }
    setCaption(name);
    const isGrid=(name==="grid"), isSphere=(name==="sphere");
    document.getElementById("layernav").style.display=isGrid?"flex":"none";
    document.getElementById("sphereToggle").style.display=isSphere?"block":"none";
    if(!isGrid) cards.forEach(c=>c.el.classList.remove("layerdim","gridhide"));
    // leaving sphere: always reset to the outside camera range
    if(!isSphere){ sphereInside=false; controls.minDistance=350; controls.maxDistance=9000; }
    if(isGrid){ gridFocus(curGridLayer,1500); }
    else if(isSphere){ sphereInside=false; setSphereBtn(); controls.minDistance=350; controls.maxDistance=9000; transform(targets.sphere,1600,fitDist.sphere); }
    else transform(targets[name],1600,fitDist[name]);
    syncZoomSlider();
  }

  const BLOCK_LABEL={s:"s-block",p:"p-block",d:"d-block",f:"f-block"};
  const BLOCK_DESC={s:"groups 1–2 + He",p:"groups 13–18",d:"transition metals",f:"lanth. + actinides"};
  const BLOCK_COLOR={s:"#f87171",p:"#4ade80",d:"#60a5fa",f:"#f472b6"};
  function buildLayerNav(){
    const wrap=document.getElementById("layerBtns"); wrap.innerHTML="";
    gridBlocks.forEach((b,k)=>{
      const el=document.createElement("div");
      el.className="lyr"; el.dataset.k=k; el.style.setProperty("--lc",BLOCK_COLOR[b.key]);
      el.innerHTML=`<b>${BLOCK_LABEL[b.key]}</b><span>${b.count} · ${BLOCK_DESC[b.key]}</span>`;
      el.addEventListener("click",()=>gridFocus(k));
      wrap.appendChild(el);
    });
  }

  function computeFitFor(hw,hh){
    const vFOV=THREE.MathUtils.degToRad(camera.fov)/2, asp=camera.aspect||1.6;
    return Math.max(hh/Math.tan(vFOV),(hw/asp)/Math.tan(vFOV))*1.06*TAP_ZOOM;
  }
  function tweenCamera(pz_target,tz_target,dur){
    if(reduceMotion) dur=0;
    if(dur<=0){ camera.position.set(0,0,pz_target); controls.target.set(0,0,tz_target); controls.update(); render(); return; }
    new TWEEN.Tween(camera.position).to({x:0,y:0,z:pz_target},dur).easing(TWEEN.Easing.Cubic.InOut).start();
    new TWEEN.Tween(controls.target).to({x:0,y:0,z:tz_target},dur).easing(TWEEN.Easing.Cubic.InOut).start();
  }

  /* ---------- zoom (buttons / slider / Ctrl only) ---------- */
  function zoomBy(factor){
    const dir=camera.position.clone().sub(controls.target);
    let d=dir.length()*factor;
    d=Math.min(controls.maxDistance,Math.max(controls.minDistance,d));
    camera.position.copy(controls.target).add(dir.setLength(d));
    controls.update(); syncZoomSlider(); render();
  }
  function setZoomFromSlider(v){   // v: 0 (far) … 100 (near)
    const d=controls.maxDistance + (controls.minDistance-controls.maxDistance)*(v/100);
    const dir=camera.position.clone().sub(controls.target).setLength(d);
    camera.position.copy(controls.target).add(dir);
    controls.update(); render();
  }
  function syncZoomSlider(){
    const d=camera.position.distanceTo(controls.target);
    const v=(controls.maxDistance-d)/(controls.maxDistance-controls.minDistance)*100;
    const sl=document.getElementById("zoomSlider"); if(sl) sl.value=Math.max(0,Math.min(100,v));
  }
  // Reset ONLY the camera framing for the view you're currently in (table / sphere /
  // helix / grid). Undoes panning, zooming and orbit, and re-frames the current
  // arrangement to its initial position. Leaves theme, filters and sort untouched.
  function resetView(){
    controls.minDistance=350; controls.maxDistance=9000;
    const sorting=document.body.classList.contains("sortmode");
    if(!sorting && curLayout==="grid"){ gridFocus(0,900); syncZoomSlider(); return; }
    if(!sorting && curLayout==="sphere"){
      sphereInside=false; setSphereBtn();
      transform(targets.sphere,900,fitDist.sphere); syncZoomSlider(); return;
    }
    const key=sorting?"sort":curLayout;
    transform(targets[key]||targets.table,900,fitDist[key]||fitDist.table);
    syncZoomSlider();
  }
  // pan the view by a screen-space delta (plain wheel/trackpad = scroll through the table)
  function panScreen(dx,dy){
    const dist=camera.position.distanceTo(controls.target);
    const vFOV=THREE.MathUtils.degToRad(camera.fov);
    const wpp=(2*Math.tan(vFOV/2)*dist)/renderer.domElement.clientHeight;
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0);
    const up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
    const move=new THREE.Vector3()
      .addScaledVector(right, dx*wpp)   // scroll right → view follows right
      .addScaledVector(up,    dy*wpp);  // scroll down  → view follows down
    camera.position.add(move); controls.target.add(move); controls.update(); render();
  }
  function gridFocus(k,dur=850){
    curGridLayer=k;
    // focused block: flat grid facing camera at z=0; every other block: parked far behind & hidden
    for(let bi=0; bi<gridBlocks.length; bi++){
      const b=gridBlocks[bi], focused=(bi===k), z=focused?0:-3000;
      b.sub.forEach(s=>{
        const o=targets.grid[s.gi];
        o.position.set(s.x, focused? s.y : s.y*0.15, z);
        o.rotation.set(0,0,0);
      });
    }
    const focus=new Set(gridBlocks[k].members);
    cards.forEach((c,i)=>{ c.el.classList.toggle("gridhide",!focus.has(i)); c.el.classList.remove("layerdim"); });
    transform(targets.grid,dur);                       // animate cards to new positions (camera handled below)
    tweenCamera(computeFitFor(gridBlocks[k].hw,gridBlocks[k].hh),0,dur);
    document.querySelectorAll("#layernav .lyr").forEach(btn=>btn.classList.toggle("active",+btn.dataset.k===k));
    const b=gridBlocks[k];
    document.getElementById("caption").textContent=`${BLOCK_LABEL[b.key]} — ${b.count} elements (${BLOCK_DESC[b.key]}). Use ‹ › or ↑↓ to switch blocks.`;
    render();
  }

  // ---- combinable filters (metal type · state · block · group · period) ----
  const filters={type:new Set(),state:new Set(),block:new Set(),group:new Set(),period:new Set()};
  function elemType(e){ return e.cat==="Metalloid" ? "Metalloid"
      : (e.cat==="Nonmetal"||e.cat==="Noble gas"||e.cat==="Halogen") ? "Nonmetal" : "Metal"; }
  function elemState(e){ const s=e.state||""; return /Gas/.test(s)?"Gas":/Liquid/.test(s)?"Liquid":/Solid/.test(s)?"Solid":""; }
  function elemGroup(e){ return e.block==="f" ? 3 : e.group; }   // lanthanides + actinides sit under group 3
  function anyFilter(){ return filters.type.size||filters.state.size||filters.block.size||filters.group.size||filters.period.size; }
  function applyFilters(){
    activeCat=null; document.querySelectorAll("#legendRows .row").forEach(r=>r.classList.remove("off"));
    const on=anyFilter();
    cards.forEach(c=>{
      const e=c.data;
      const m = (filters.type.size?filters.type.has(elemType(e)):true)
             && (filters.state.size?filters.state.has(elemState(e)):true)
             && (filters.block.size?filters.block.has(e.block):true)
             && (filters.group.size?filters.group.has(String(elemGroup(e))):true)
             && (filters.period.size?filters.period.has(String(e.period)):true);
      c.el.classList.toggle("dim",on && !m);
      c.el.classList.toggle("match",on && m);
    });
    updateHlCount();
    render();
  }
  function updateHlCount(){
    const n=filters.type.size+filters.state.size+filters.block.size;
    document.getElementById("hlCount").textContent=n?`(${n})`:"";
    document.getElementById("hlBtn").classList.toggle("on",n>0);
  }
  function clearFilters(){
    Object.values(filters).forEach(s=>s.clear());
    document.querySelectorAll("#hlMenu input[type=checkbox]").forEach(cb=>cb.checked=false);
    document.querySelectorAll("#groupBar .gp,#periodBar .gp").forEach(b=>b.classList.remove("active"));
    cards.forEach(c=>c.el.classList.remove("dim","match"));
    updateHlCount(); render();
  }
  // group (top) + period (side) selector strips
  function buildGroupPeriodBars(){
    const gb=document.getElementById("groupBar"), pb=document.getElementById("periodBar");
    gb.style.display="flex"; pb.style.display="flex";
    gb.innerHTML='<span class="gplbl">GRP</span>';
    for(let g=1; g<=18; g++){ const b=document.createElement("button"); b.className="gp"; b.textContent=g;
      b.addEventListener("click",()=>toggleGP("group",String(g),b)); gb.appendChild(b); }
    const gr=document.createElement("button"); gr.className="gp gpreset"; gr.textContent="↺"; gr.title="Reset groups";
    gr.addEventListener("click",()=>resetGP("group")); gb.appendChild(gr);
    pb.innerHTML='<span class="gplbl">PER</span>';
    for(let p=1; p<=7; p++){ const b=document.createElement("button"); b.className="gp"; b.textContent=p;
      b.addEventListener("click",()=>toggleGP("period",String(p),b)); pb.appendChild(b); }
    const pr=document.createElement("button"); pr.className="gp gpreset"; pr.textContent="↺"; pr.title="Reset periods";
    pr.addEventListener("click",()=>resetGP("period")); pb.appendChild(pr);
  }
  function toggleGP(kind,val,btn){
    const set=filters[kind];
    if(set.has(val)){ set.delete(val); btn.classList.remove("active"); }
    else { set.add(val); btn.classList.add("active"); }
    applyFilters();
  }
  function resetGP(kind){
    filters[kind].clear();
    const bar=kind==="group"?"#groupBar":"#periodBar";
    document.querySelectorAll(bar+" .gp").forEach(b=>b.classList.remove("active"));
    applyFilters();
  }

  function applySearch(q){
    activeCat=null; document.querySelectorAll("#legendRows .row").forEach(r=>r.classList.remove("off"));
    if(!q){ anyFilter()?applyFilters():cards.forEach(c=>c.el.classList.remove("dim","match")); render(); return; }
    cards.forEach(c=>{
      const e=c.data;
      const hit=e.name.toLowerCase().startsWith(q)||e.sym.toLowerCase()===q||e.sym.toLowerCase().startsWith(q)||String(e.n)===q;
      c.el.classList.toggle("dim",!hit);
      c.el.classList.toggle("match",hit);
    });
    render();
  }

  // click a legend swatch to isolate that category (direct legend ↔ element link)
  let activeCat=null;
  function toggleCategory(cat){
    const rows=document.querySelectorAll("#legendRows .row");
    if(activeCat===cat){
      activeCat=null; rows.forEach(r=>r.classList.remove("off"));
      cards.forEach(c=>c.el.classList.remove("dim","match")); render(); return;
    }
    activeCat=cat;
    rows.forEach(r=>r.classList.toggle("off",r.dataset.cat!==cat));
    cards.forEach(c=>{ const on=c.data.cat===cat; c.el.classList.toggle("dim",!on); c.el.classList.toggle("match",on); });
    render();
  }

  /* ---------- sphere: inside (planetarium) vs outside ---------- */
  // CHANGED: SVG icon + label instead of a ⦿ / ↩ glyph
  function setSphereBtn(){
    document.getElementById("sphereToggle").innerHTML =
      (sphereInside ? window.PT_ICONS.sphereOut : window.PT_ICONS.sphereIn) +
      "<span>" + (sphereInside ? "Step back outside" : "Step inside the sphere") + "</span>";
  }
  function enterInside(){
    sphereInside=true; setSphereBtn(); setCaption("sphereIn");
    controls.minDistance=15; controls.maxDistance=9000;      // stay open during the flight
    transform(targets.sphereIn,1500);                        // flip cards to face the centre
    new TWEEN.Tween(camera.position).to({x:0,y:0,z:60},1700).easing(TWEEN.Easing.Cubic.InOut)
      .onComplete(()=>{ controls.maxDistance=760; }).start(); // glide straight into the core
    new TWEEN.Tween(controls.target).to({x:0,y:0,z:0},1700).easing(TWEEN.Easing.Cubic.InOut).start();
  }
  function exitOutside(){
    sphereInside=false; setSphereBtn(); setCaption("sphere");
    controls.minDistance=15; controls.maxDistance=9000;      // low min so the fly-out doesn't clamp
    transform(targets.sphere,1500,fitDist.sphere);           // flip outward + fly back out
    setTimeout(()=>{ if(!sphereInside) controls.minDistance=350; },1750);
  }

  /* ---------- sort / rank by a property (highest → lowest) ---------- */
  const SORT_META={
    en:{name:"Electronegativity",unit:"",fix:2},
    melt:{name:"Melting point",unit:" K",fix:0},
    boil:{name:"Boiling point",unit:" K",fix:0},
    radius:{name:"Atomic radius",unit:" pm",fix:0},
    ie:{name:"Ionization energy",unit:" eV",fix:2},
    ea:{name:"Electron affinity",unit:" eV",fix:2},
    mass:{name:"Atomic mass",unit:" u",fix:1},
    density:{name:"Density",unit:" g/cm³",fix:2}
  };
  function setSort(prop){
    if(!prop){ if(curLayout==="sort") setLayout("table"); return; }
    curLayout="sort";
    document.querySelectorAll("#controls .bar button").forEach(b=>b.classList.remove("active"));
    document.getElementById("layernav").style.display="none";
    document.getElementById("sphereToggle").style.display="none";
    sphereInside=false; controls.minDistance=350; controls.maxDistance=9000;
    cards.forEach(c=>c.el.classList.remove("layerdim"));
    colorMode=prop; document.getElementById("colorby").value=prop; document.getElementById("tempBar").classList.remove("show"); applyColors();
    buildSortTargets(prop);
    document.body.classList.add("sortmode");
    const meta=SORT_META[prop];
    const flow=sortAsc?"lowest (top-left) → highest":"highest (top-left) → lowest";
    document.getElementById("caption").textContent=`Ranked by ${meta.name} — ${flow}. Colour follows the same scale; grey cards have no data. Toggle ▲/▼ to flip.`;
    transform(targets.sort,1600,fitDist.sort);
  }
  function buildSortTargets(prop){
    const meta=SORT_META[prop];
    const withVal=[], without=[];
    ELEMENTS.forEach((e,i)=>{ (typeof e[prop]==="number"?withVal:without).push(i); });
    withVal.sort((a,b)=> sortAsc ? ELEMENTS[a][prop]-ELEMENTS[b][prop] : ELEMENTS[b][prop]-ELEMENTS[a][prop]);
    const order=withVal.concat(without);
    const cols=15, rows=Math.ceil(order.length/cols);
    targets.sort.length=0; for(let i=0;i<ELEMENTS.length;i++) targets.sort.push(new THREE.Object3D());
    order.forEach((gi,r)=>{
      targets.sort[gi].position.set(((r%cols)-(cols-1)/2)*138, ((rows-1)/2-Math.floor(r/cols))*168, 0);
    });
    fitDist.sort=computeFitFor((cols-1)/2*138+70,(rows-1)/2*168+70);
    cards.forEach((c,i)=>{
      const v=ELEMENTS[i][prop], pv=c.el.querySelector(".pval");
      if(typeof v==="number"){ pv.textContent=(+v).toFixed(meta.fix)+meta.unit; c.el.classList.remove("dim"); }
      else { pv.textContent="—"; c.el.classList.add("dim"); }
      c.el.classList.remove("match");
    });
  }

  function transform(arr,dur,camZ){
    TWEEN.removeAll();
    if(reduceMotion){
      placeInstant(arr);
      if(typeof camZ==="number"){
        const dir=camera.position.clone().sub(controls.target).normalize();
        camera.position.copy(dir.multiplyScalar(camZ)); controls.target.set(0,0,0); controls.update();
      }
      render(); return;
    }
    for(let i=0;i<objects.length;i++){
      const o=objects[i], t=arr[i];
      const d=dur*(0.92+Math.random()*0.16);   // tight, consistent stagger (cleaner)
      new TWEEN.Tween(o.position).to({x:t.position.x,y:t.position.y,z:t.position.z},d).easing(TWEEN.Easing.Cubic.InOut).start();
      new TWEEN.Tween(o.rotation).to({x:t.rotation.x,y:t.rotation.y,z:t.rotation.z},d).easing(TWEEN.Easing.Cubic.InOut).start();
    }
    // glide the camera straight back to frame the new layout, re-centering it
    if(typeof camZ==="number"){
      const dir=camera.position.clone().sub(controls.target).normalize();
      const end=dir.multiplyScalar(camZ);
      new TWEEN.Tween(camera.position).to({x:end.x,y:end.y,z:end.z},dur*1.1)
        .easing(TWEEN.Easing.Cubic.InOut).start();
      new TWEEN.Tween(controls.target).to({x:0,y:0,z:0},dur*1.1).easing(TWEEN.Easing.Cubic.InOut).start();
    }
  }

  function onResize(){
    layout();
    if(curLayout==="grid"){
      gridFocus(curGridLayer,0);              // re-fit the focused block layer
    } else if(curLayout==="sphere" && sphereInside){
      controls.update();                      // stay inside; nothing to reframe
    } else if(curLayout==="sort"){
      const s=document.getElementById("sortby").value; if(s) buildSortTargets(s);
      camera.position.set(0,0,fitDist.sort); controls.target.set(0,0,0); controls.update();
    } else {
      const dir=camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(dir.multiplyScalar(fitDist[curLayout]));
      controls.update();
    }
    if(bohr.renderer) sizeBohr();
    if(shapes.renderer) sizeShapes();
    syncZoomSlider();
  }
  // ---- compact mobile/tablet controls: thin proxies driving the existing desktop controls ----
  function setGPfromSelect(kind,val,barSel){
    filters[kind].clear();
    document.querySelectorAll(barSel+" .gp").forEach(b=>b.classList.remove("active"));
    if(val!=="all"){
      filters[kind].add(val);
      const b=[...document.querySelectorAll(barSel+" .gp")].find(x=>x.textContent.trim()===val);
      if(b) b.classList.add("active");
    }
    applyFilters();
  }
  function buildMobileControls(){
    const $=id=>document.getElementById(id);
    // search → proxy the real search input
    const mS=$("mSearch"), dS=$("search");
    if(mS&&dS){ mS.addEventListener("input",()=>{ dS.value=mS.value; dS.dispatchEvent(new Event("input")); });
      dS.addEventListener("input",()=>{ if(mS.value!==dS.value) mS.value=dS.value; }); }  // CHANGED: mirror desktop -> mobile
    // view select
    const mV=$("mView");
    if(mV){ mV.value=curLayout; mV.addEventListener("change",()=>setLayout(mV.value)); }
    // options sheet
    const sheet=$("mSheet");
    if($("mOptionsBtn")) $("mOptionsBtn").addEventListener("click",()=>{ sheet.hidden=false; });
    if($("mSheetClose")) $("mSheetClose").addEventListener("click",()=>{ sheet.hidden=true; });
    if(sheet) sheet.addEventListener("click",e=>{ if(e.target===sheet) sheet.hidden=true; });
    // colour-by (clone the desktop select so options never drift)
    const cOrig=$("colorby");
    if(cOrig){ const c=cOrig.cloneNode(true); c.id="mColor"; c.removeAttribute("aria-label"); c.value=cOrig.value;
      c.addEventListener("change",()=>{ cOrig.value=c.value; cOrig.dispatchEvent(new Event("change")); });
      cOrig.addEventListener("change",()=>{ c.value=cOrig.value; });   // CHANGED: mirror desktop -> mobile
      $("mColorWrap").appendChild(c); }
    // sort-by + direction
    const sOrig=$("sortby");
    if(sOrig){ const s=sOrig.cloneNode(true); s.id="mSort"; s.removeAttribute("aria-label"); s.value=sOrig.value;
      s.addEventListener("change",()=>{ sOrig.value=s.value; sOrig.dispatchEvent(new Event("change")); });
      sOrig.addEventListener("change",()=>{ s.value=sOrig.value; });   // CHANGED: mirror desktop -> mobile
      const dir=document.createElement("button"); dir.type="button"; dir.id="mSortDir";
      dir.innerHTML=window.PT_ICONS.sort;                              // CHANGED: SVG instead of a ▼ glyph
      dir.classList.toggle("asc", $("sortDir").classList.contains("asc"));
      dir.addEventListener("click",()=>{ $("sortDir").click(); dir.classList.toggle("asc",$("sortDir").classList.contains("asc")); });
      $("mSortWrap").appendChild(s); $("mSortWrap").appendChild(dir); }
    // highlight checkboxes (proxy the desktop ones)
    const mHl=$("mHl");
    if(mHl) document.querySelectorAll("#hlMenu label").forEach(lab=>{
      const orig=lab.querySelector('input[type="checkbox"]'); if(!orig) return;
      const w=document.createElement("label");
      const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=orig.checked;
      cb.addEventListener("change",()=>{ if(orig.checked!==cb.checked) orig.click(); });
      w.appendChild(cb); w.appendChild(document.createTextNode(" "+lab.textContent.trim()));
      w._orig=orig; mHl.appendChild(w);
    });
    // clear all
    if($("mClear")) $("mClear").addEventListener("click",()=>{
      const cf=$("clearFilters"); if(cf) cf.click();
      document.querySelectorAll("#mHl input").forEach(c=>c.checked=false);
      const mG=$("mGroup"), mP=$("mPeriod"); if(mG)mG.value="all"; if(mP)mP.value="all";
    });
    // group / period selects
    const mG=$("mGroup"), mP=$("mPeriod");
    if(mG){ mG.appendChild(new Option("All groups","all")); for(let g=1;g<=18;g++) mG.appendChild(new Option("Group "+g,String(g)));
      mG.addEventListener("change",()=>setGPfromSelect("group",mG.value,"#groupBar")); }
    if(mP){ mP.appendChild(new Option("All periods","all")); for(let p=1;p<=7;p++) mP.appendChild(new Option("Period "+p,String(p)));
      mP.addEventListener("change",()=>setGPfromSelect("period",mP.value,"#periodBar")); }
  }

  function animate(){ requestAnimationFrame(animate); if(document.hidden) return; TWEEN.update(); controls.update(); render(); if(bohr.active) renderBohr(); if(shapes.active) renderShapes(); }
  function render(){ renderer.render(scene,camera); }

  /* ================= DETAIL OVERLAY ================= */
  const overlay=document.getElementById("overlay");
  document.getElementById("close").addEventListener("click",closeDetail);
  overlay.addEventListener("click",e=>{ if(e.target===overlay) closeDetail(); });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeDetail(); });
  document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.t)));

  function switchTab(t){
    document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("active",b.dataset.t===t));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    document.getElementById("panel-"+t).classList.add("active");
    bohr.active=(t==="bohr");
    shapes.active=(t==="shapes");
    if(t==="bohr") sizeBohr();
    if(t==="shapes"){ if(current) buildShapes(current); sizeShapes(); }
  }

  function fmtK(k){ return (typeof k==="number")? `${k} K  (${(k-273.15).toFixed(0)}°C)` : "—"; }
  function val(x,u){ return (x===null||x===undefined||x==="")? "—" : x+(u||""); }

  let current=null;
  function openDetail(e){
    if(window.PT_SFX) window.PT_SFX.click();
    lastFocus=document.activeElement;
    current=e;
    const c=colorFor(e);
    document.getElementById("card").style.setProperty("--c",c);
    document.getElementById("dSym").textContent=e.sym;
    document.getElementById("dName").textContent=e.name;
    document.getElementById("dSub").textContent=`#${e.n} · ${(+e.mass).toFixed(3)} u · ${e.state||"—"}`;
    document.getElementById("dBadge").textContent=e.cat;
    buildOrbital(e);
    buildData(e);
    overlay.classList.add("show");
    switchTab("bohr");
    buildBohr(e);
    const idx=ELEMENTS.findIndex(x=>x.n===e.n);
    const pe=document.getElementById("prevEl"), nx=document.getElementById("nextEl");
    if(pe) pe.disabled=idx<=0;
    if(nx) nx.disabled=idx>=ELEMENTS.length-1;
    updateHash();
    const cb=document.getElementById("close"); if(cb) cb.focus();
  }
  function closeDetail(){
    overlay.classList.remove("show"); bohr.active=false; shapes.active=false;
    if(location.hash) history.replaceState(null,"",location.pathname+location.search);
    const el=lastFocus||document.getElementById("search");
    if(el && el.focus){ try{ el.focus(); }catch(_){} }
  }

  /* ---------- Bohr 3D atom (WebGL) ---------- */
  const bohr={renderer:null,scene:null,camera:null,controls:null,active:false,group:null,shells:[],paused:false,mode:"3d"};
  document.getElementById("bohrPause").addEventListener("click",()=>{
    bohr.paused=!bohr.paused;
    document.getElementById("bohrPause").innerHTML=bohr.paused?window.PT_ICONS.play:window.PT_ICONS.pause;   // CHANGED: SVG
    if(!bohr.paused && bohr.mode==="3d" && bohr.controls) bohr.controls.autoRotate=true;
  });
  document.getElementById("bohrMode").addEventListener("click",()=>{
    bohr.mode = bohr.mode==="3d" ? "2d" : "3d";
    document.getElementById("bohrMode").textContent = bohr.mode==="3d" ? "3D" : "2D";
    if(current) buildBohr(current);
  });
  function initBohr(){
    const canvas=document.getElementById("bohrCanvas");
    bohr.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    bohr.scene=new THREE.Scene();
    bohr.camera=new THREE.PerspectiveCamera(45,1,0.1,1000);
    bohr.camera.position.set(0,6,26);
    bohr.camera.lookAt(0,0,0);
    const l1=new THREE.PointLight(0xffffff,1.1); l1.position.set(15,20,25); bohr.scene.add(l1);
    bohr.scene.add(new THREE.AmbientLight(0x8899bb,0.7));
    // cursor-driven: drag to rotate from any angle, scroll to zoom
    bohr.controls=new THREE.OrbitControls(bohr.camera,canvas);
    bohr.controls.enableDamping=true; bohr.controls.dampingFactor=0.1;
    bohr.controls.enablePan=false; bohr.controls.rotateSpeed=0.6; bohr.controls.zoomSpeed=0.7;
    bohr.controls.minDistance=10; bohr.controls.maxDistance=70;
    bohr.controls.autoRotate=!reduceMotion; bohr.controls.autoRotateSpeed=1.6;
    bohr.controls.addEventListener("start",()=>{ bohr.controls.autoRotate=false; }); // pause spin when grabbed
  }
  function sizeBohr(){
    if(!bohr.renderer) return;
    const wrap=document.getElementById("bohrWrap");
    const w=wrap.clientWidth,h=wrap.clientHeight;
    bohr.renderer.setPixelRatio(window.devicePixelRatio);
    bohr.renderer.setSize(w,h,false);
    bohr.camera.aspect=w/h; bohr.camera.updateProjectionMatrix();
  }
  function buildBohr(e){
    if(!bohr.renderer) initBohr();
    const col=new THREE.Color(colorFor(e));
    while(bohr.scene.children.filter(o=>o.userData.dyn).length){
      const o=bohr.scene.children.find(x=>x.userData.dyn); disposeObj(o); bohr.scene.remove(o);
    }
    bohr.shells=[];
    const g=new THREE.Group(); g.userData.dyn=true; bohr.group=g; bohr.scene.add(g);

    const shells=e.shells;
    const ns=shells.length;
    // normalise: everything fits inside a fixed outer radius, whatever the shell count
    const OUTER=11, nucR=Math.min(1.8,1.0+ns*0.12);
    const innerR=nucR+2.2;
    const step=ns>1?(OUTER-innerR)/(ns-1):0;
    const shellR=si=>innerR+si*step;
    const eSize=Math.max(0.22,0.5-ns*0.03);

    // nucleus + soft glow halo
    g.add(new THREE.Mesh(new THREE.SphereGeometry(nucR,40,40),
      new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.65,roughness:.3,metalness:.1})));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(nucR*1.5,28,28),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.14})));

    const is2D=(bohr.mode==="2d");
    shells.forEach((count,si)=>{
      const r=shellR(si), tilt=is2D?0:si*0.22;
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r,is2D?0.03:0.018,8,120),
        new THREE.MeshBasicMaterial({color:0x9fb6d6,transparent:true,opacity:is2D?0.45:0.30}));
      ring.rotation.x = is2D ? 0 : (Math.PI/2 + tilt);   // 2D: rings lie flat in the screen plane
      g.add(ring);
      const eg=new THREE.Group(); if(!is2D) eg.rotation.x=tilt;
      for(let k=0;k<count;k++){
        const a=(k/count)*Math.PI*2;
        const em=new THREE.Mesh(new THREE.SphereGeometry(eSize,18,18),
          new THREE.MeshStandardMaterial({color:0xbfefff,emissive:0x33aadd,emissiveIntensity:.9,roughness:.4}));
        if(is2D) em.position.set(Math.cos(a)*r,Math.sin(a)*r,0);
        else     em.position.set(Math.cos(a)*r,0,Math.sin(a)*r);
        eg.add(em);
      }
      g.add(eg);
      bohr.shells.push({grp:eg,speed:0.5/(si+1)+0.12,axis:is2D?"z":"y"});
    });
    // camera + controls per mode
    if(is2D){
      bohr.camera.position.set(0,0,OUTER*2.7);
      if(bohr.controls){ bohr.controls.target.set(0,0,0); bohr.controls.enableRotate=false; bohr.controls.autoRotate=false; bohr.controls.update(); }
    } else {
      bohr.camera.position.set(0,OUTER*0.32,OUTER*2.35);
      if(bohr.controls){ bohr.controls.target.set(0,0,0); bohr.controls.enableRotate=true; bohr.controls.autoRotate=!bohr.paused&&!reduceMotion; bohr.controls.update(); }
      else bohr.camera.lookAt(0,0,0);
    }

    const protons=e.n, neutrons=Math.max(0,Math.round(+e.mass)-e.n);
    document.getElementById("bohrInfo").innerHTML=
      `<b>Nucleus:</b> ${protons} protons, ${neutrons} neutrons<br>`+
      `<b>Electron shells:</b> ${shells.join(" · ")}<br>`+
      `<span style="opacity:.6">${is2D?"Flat 2D shell diagram · scroll to zoom.":"Drag to rotate · scroll to zoom · auto-spins until grabbed."}</span>`;
    sizeBohr();
  }
  function renderBohr(){
    if(!bohr.renderer||!bohr.group) return;
    if(!bohr.paused && !reduceMotion) bohr.shells.forEach(s=>{ s.grp.rotation[s.axis]+=s.speed*0.03; }); // electrons orbit
    if(bohr.controls){ if(bohr.paused) bohr.controls.autoRotate=false; bohr.controls.update(); }
    bohr.renderer.render(bohr.scene,bohr.camera);
  }

  /* ---------- Orbital shapes 3D (s / p / d / f lobes) ---------- */
  const shapes={renderer:null,scene:null,camera:null,controls:null,active:false,group:null,forEl:null};
  const ORB_COLORS={s:"#5ab0ff",px:"#ff6b6b",py:"#4ade80",pz:"#facc15",d:"#c084fc",f:"#fb923c"};
  function initShapes(){
    const canvas=document.getElementById("shapesCanvas");
    shapes.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    shapes.scene=new THREE.Scene();
    shapes.camera=new THREE.PerspectiveCamera(45,1,0.1,1000);
    shapes.camera.position.set(0,7,34);
    const l=new THREE.PointLight(0xffffff,1.1); l.position.set(20,25,30); shapes.scene.add(l);
    shapes.scene.add(new THREE.AmbientLight(0x99aacc,0.75));
    shapes.controls=new THREE.OrbitControls(shapes.camera,canvas);
    shapes.controls.enableDamping=true; shapes.controls.dampingFactor=0.1;
    shapes.controls.enablePan=false; shapes.controls.rotateSpeed=0.6;
    shapes.controls.minDistance=14; shapes.controls.maxDistance=90;
    shapes.controls.autoRotate=!reduceMotion; shapes.controls.autoRotateSpeed=1.3;
  }
  function sizeShapes(){
    if(!shapes.renderer) return;
    const wrap=document.getElementById("shapesWrap"), w=wrap.clientWidth,h=wrap.clientHeight;
    shapes.renderer.setPixelRatio(window.devicePixelRatio);
    shapes.renderer.setSize(w,h,false);
    shapes.camera.aspect=w/h; shapes.camera.updateProjectionMatrix();
  }
  // one dumbbell lobe pair along an axis
  function lobePair(color,axis,scale){
    const g=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.25,transparent:true,opacity:.85,roughness:.4});
    [1,-1].forEach(s=>{
      const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,24),mat);
      m.scale.set(scale.x,scale.y,scale.z);
      m.position[axis]=s*scale[axis]*0.9;
      g.add(m);
    });
    return g;
  }
  function makeS(color){ const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.25,transparent:true,opacity:.7,roughness:.4});
    return new THREE.Mesh(new THREE.SphereGeometry(2.4,32,32),mat); }
  function makeP(){ // px, py, pz dumbbells together
    const g=new THREE.Group();
    g.add(lobePair(ORB_COLORS.px,"x",{x:2.6,y:1.1,z:1.1}));
    g.add(lobePair(ORB_COLORS.py,"y",{x:1.1,y:2.6,z:1.1}));
    g.add(lobePair(ORB_COLORS.pz,"z",{x:1.1,y:1.1,z:2.6}));
    return g;
  }
  function cloverleaf(color,rotZ){ // 4-lobe d orbital in a plane
    const g=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.22,transparent:true,opacity:.8,roughness:.45});
    for(let i=0;i<4;i++){
      const a=Math.PI/4 + i*Math.PI/2;
      const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,20),mat);
      m.scale.set(1.9,0.9,0.9);
      m.position.set(Math.cos(a)*1.9,Math.sin(a)*1.9,0);
      m.rotation.z=a; g.add(m);
    }
    g.rotation.z=rotZ||0; return g;
  }
  function makeDz2(color){ // two lobes on z + torus ring
    const g=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.22,transparent:true,opacity:.8,roughness:.45});
    [1,-1].forEach(s=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,20),mat); m.scale.set(1,1,2.4); m.position.z=s*2.4; g.add(m); });
    const torus=new THREE.Mesh(new THREE.TorusGeometry(1.9,0.5,14,32),mat); g.add(torus);
    return g;
  }
  function makeD(){ // 5 d-orbitals arranged in a small cluster
    const g=new THREE.Group();
    const set=[cloverleaf(ORB_COLORS.d,0),cloverleaf(ORB_COLORS.d,Math.PI/4),makeDz2(ORB_COLORS.d)];
    set.forEach((o,i)=>{ o.position.x=(i-1)*0; }); // stacked; rely on rotation to read
    // spread the three shown representatives around
    set[0].position.set(-4.5,0,0); set[1].position.set(4.5,0,0); set[2].position.set(0,0,0);
    set.forEach(o=>g.add(o)); return g;
  }
  function makeF(){ // simplified multi-lobe f representation
    const g=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color:ORB_COLORS.f,emissive:ORB_COLORS.f,emissiveIntensity:.22,transparent:true,opacity:.78,roughness:.45});
    for(let i=0;i<8;i++){ const a=i*Math.PI/4; const m=new THREE.Mesh(new THREE.SphereGeometry(1,18,18),mat);
      m.scale.set(1.7,0.8,0.8); m.position.set(Math.cos(a)*2.1,Math.sin(a)*2.1,(i%2?1:-1)*1.2); m.rotation.z=a; g.add(m); }
    return g;
  }
  function buildShapes(e){
    if(!shapes.renderer) initShapes();
    if(shapes.forEl===e){ shapes.controls.autoRotate=!reduceMotion; return; }
    shapes.forEl=e;
    if(shapes.group){ disposeObj(shapes.group); shapes.scene.remove(shapes.group); }
    const g=new THREE.Group(); shapes.group=g; shapes.scene.add(g);
    // which subshell types does this element occupy? (expand noble-gas core)
    const present={s:false,p:false,d:false,f:false};
    expandConfig(e.cfg).forEach(su=>{ present[su.l]=true; });
    const builders={s:makeS(ORB_COLORS.s),p:makeP(),d:makeD(),f:makeF()};
    const order=["s","p","d","f"].filter(k=>present[k]);
    const spacing=15, x0=-(order.length-1)*spacing/2;
    const legend=[]; const LEGNAMES={s:"s (sphere)",p:"p — pₓ pᵧ p_z",d:"d — 5 orbitals",f:"f — 7 orbitals"};
    order.forEach((k,i)=>{ const o=builders[k]; o.position.x=x0+i*spacing; g.add(o); legend.push(k); });
    // label + legend
    document.getElementById("shapesLabel").textContent=`${e.name} — occupied orbital types: ${order.join(", ")}`;
    const leg=document.getElementById("shapesLegend"); leg.innerHTML="";
    const legcolors={s:ORB_COLORS.s,p:ORB_COLORS.py,d:ORB_COLORS.d,f:ORB_COLORS.f};
    order.forEach(k=>{ const sp=document.createElement("span"); sp.innerHTML=`<i style="background:${legcolors[k]}"></i>${LEGNAMES[k]}`; leg.appendChild(sp); });
    if(present.p){ ["pₓ:"+ORB_COLORS.px,"pᵧ:"+ORB_COLORS.py,"p_z:"+ORB_COLORS.pz].forEach(()=>{}); }
    shapes.controls.autoRotate=!reduceMotion;
    shapes.camera.position.set(0,7,34+order.length*4);
    shapes.controls.update();
  }
  function renderShapes(){
    if(!shapes.renderer||!shapes.group) return;
    if(shapes.controls) shapes.controls.update();
    shapes.renderer.render(shapes.scene,shapes.camera);
  }

  /* ---------- Orbital diagram ---------- */
  const CORE={He:"1s2",Ne:"1s2 2s2 2p6",Ar:"1s2 2s2 2p6 3s2 3p6",
    Kr:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6",
    Xe:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6",
    Rn:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10 6p6"};
  const CAP={s:2,p:6,d:10,f:14}, BOXES={s:1,p:3,d:5,f:7};
  function expandConfig(cfg){
    cfg=cfg.replace(/\(.*?\)/g,"").trim();
    const m=cfg.match(/^\[(\w\w?)\]/);
    let full=cfg;
    if(m&&CORE[m[1]]) full=CORE[m[1]]+" "+cfg.replace(m[0],"");
    const toks=[...full.matchAll(/(\d)([spdf])(\d+)/g)].map(x=>({n:+x[1],l:x[2],e:+x[3]}));
    const order={s:0,p:1,d:2,f:3};
    toks.sort((a,b)=> a.n-b.n || order[a.l]-order[b.l]);
    // merge dups
    const map=new Map();
    toks.forEach(t=>{const k=t.n+t.l; map.set(k,(map.get(k)||0)+t.e);});
    return [...map.entries()].map(([k,e])=>({n:+k[0],l:k.slice(1),e})).sort((a,b)=>a.n-b.n||order[a.l]-order[b.l]);
  }
  function buildOrbital(e){
    const p=document.getElementById("panel-orbital");
    const subs=expandConfig(e.cfg);
    let html=`<div class="config-line"><b>Electron configuration:</b> ${e.cfg}</div>`;
    html+=`<div class="orb-note">Each box is one orbital; arrows are electrons (↑↓ = opposite spins). Filled by the aufbau principle and Hund's rule.</div>`;
    subs.forEach(s=>{
      const boxes=BOXES[s.l]; let e_left=s.e; const cells=[];
      const arrows=new Array(boxes).fill("");
      for(let i=0;i<boxes&&e_left>0;i++){arrows[i]="↑";e_left--;}
      for(let i=0;i<boxes&&e_left>0;i++){arrows[i]="↑↓";e_left--;}
      html+=`<div class="orb-row"><div class="lab">${s.n}${s.l}</div><div class="orb-boxes">`+
        arrows.map(a=>`<div class="orb-box">${a}</div>`).join("")+`</div></div>`;
    });
    p.innerHTML=html;
  }

  /* ---------- Data & facts ---------- */
  function buildData(e){
    const p=document.getElementById("panel-data");
    const grpTxt=(e.block==="f")?`— (${e.cat} series)`:e.group;
    p.innerHTML=`
      ${e.uses?`<div class="prose"><span class="tag">What it's used for</span>${e.uses}</div>`:""}
      ${e.fact?`<div class="prose"><span class="tag">Did you know?</span>${e.fact}</div>`:""}
      <h4 class="sec">Position</h4>
      <div class="grid2">
        <div class="dl"><span class="k">Group</span><span class="v">${grpTxt}</span></div>
        <div class="dl"><span class="k">Period</span><span class="v">${e.period}</span></div>
        <div class="dl"><span class="k">Block</span><span class="v">${e.block}-block</span></div>
        <div class="dl"><span class="k">Category</span><span class="v">${e.cat}</span></div>
      </div>
      <h4 class="sec">Physical</h4>
      <div class="grid2">
        <div class="dl"><span class="k">Atomic mass</span><span class="v">${(+e.mass).toFixed(3)} u</span></div>
        <div class="dl"><span class="k">State (25°C)</span><span class="v">${val(e.state)}</span></div>
        <div class="dl"><span class="k">Density</span><span class="v">${val(e.density," g/cm³")}</span></div>
        <div class="dl"><span class="k">Atomic radius</span><span class="v">${val(e.radius," pm")}</span></div>
        <div class="dl"><span class="k">Melting point</span><span class="v">${fmtK(e.melt)}</span></div>
        <div class="dl"><span class="k">Boiling point</span><span class="v">${fmtK(e.boil)}</span></div>
      </div>
      <h4 class="sec">Chemistry</h4>
      <div class="grid2">
        <div class="dl"><span class="k">Electron config</span><span class="v">${e.cfg}</span></div>
        <div class="dl"><span class="k">Electrons/shell</span><span class="v">${e.shells.join(", ")}</span></div>
        <div class="dl"><span class="k">Electronegativity</span><span class="v">${val(e.en)}</span></div>
        <div class="dl"><span class="k">Ionization energy</span><span class="v">${val(e.ie," eV")}</span></div>
        <div class="dl"><span class="k">Electron affinity</span><span class="v">${val(e.ea," eV")}</span></div>
        <div class="dl"><span class="k">Oxidation states</span><span class="v">${val(e.ox)}</span></div>
      </div>
      <h4 class="sec">Discovery</h4>
      <div class="grid2">
        <div class="dl"><span class="k">Year discovered</span><span class="v">${val(e.year)}</span></div>
        <div class="dl"><span class="k">Atomic number</span><span class="v">${e.n}</span></div>
      </div>`;
  }

  /* ---------- ambient VFX: nebula + parallax starfield + shooting stars ---------- */
  (function starfield(){
    const cv=document.getElementById("bg"), cx=cv.getContext("2d");
    let stars=[], nebula=[], shots=[], W=0, H=0, dpr=Math.min(2,window.devicePixelRatio||1);
    const NEB_COLORS=[[80,120,255],[150,90,255],[40,180,200],[255,90,160]];

    function resize(){
      W=innerWidth; H=innerHeight;
      cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+"px"; cv.style.height=H+"px";
      cx.setTransform(dpr,0,0,dpr,0,0);
      const count=Math.round(W*H/7000);
      stars=Array.from({length:count},()=>{
        const depth=Math.random();            // 0 far … 1 near (parallax + size)
        return {x:Math.random()*W,y:Math.random()*H,z:depth,
          r:depth*1.6+0.25, base:depth*0.5+0.2,
          tw:Math.random()*0.03+0.004, ph:Math.random()*6.28,
          vx:(depth*0.12+0.02)*(Math.random()<.5?-1:1)};
      });
      nebula=Array.from({length:5},(_,i)=>({
        x:Math.random()*W, y:Math.random()*H,
        r:Math.max(W,H)*(0.28+Math.random()*0.28),
        c:THEME_NEBULA[i%THEME_NEBULA.length],
        vx:(Math.random()-.5)*0.06, vy:(Math.random()-.5)*0.05,
        ph:Math.random()*6.28
      }));
    }
    function spawnShot(){
      const y=Math.random()*H*0.5;
      shots.push({x:-60,y,vx:7+Math.random()*5,vy:2+Math.random()*2,life:1});
    }
    let last=0;
    function draw(t){
      cx.clearRect(0,0,W,H);
      // nebula clouds (screen-blend glow)
      cx.globalCompositeOperation="lighter";
      for(const nb of nebula){
        nb.x+=nb.vx; nb.y+=nb.vy; nb.ph+=0.004;
        if(nb.x<-nb.r)nb.x=W+nb.r; if(nb.x>W+nb.r)nb.x=-nb.r;
        if(nb.y<-nb.r)nb.y=H+nb.r; if(nb.y>H+nb.r)nb.y=-nb.r;
        const a=0.05+Math.sin(nb.ph)*0.02;
        const g=cx.createRadialGradient(nb.x,nb.y,0,nb.x,nb.y,nb.r);
        g.addColorStop(0,`rgba(${nb.c[0]},${nb.c[1]},${nb.c[2]},${a})`);
        g.addColorStop(1,"rgba(0,0,0,0)");
        cx.fillStyle=g; cx.fillRect(nb.x-nb.r,nb.y-nb.r,nb.r*2,nb.r*2);
      }
      // stars
      for(const s of stars){
        s.ph+=s.tw; s.x+=s.vx; if(s.x<0)s.x=W; if(s.x>W)s.x=0;
        const a=Math.max(0,s.base+Math.sin(s.ph)*0.25);
        cx.beginPath(); cx.arc(s.x,s.y,s.r,0,6.283);
        cx.fillStyle=`rgba(200,220,255,${a})`; cx.fill();
        if(s.r>1.3){ cx.beginPath(); cx.arc(s.x,s.y,s.r*2.4,0,6.283); cx.fillStyle=`rgba(150,190,255,${a*0.12})`; cx.fill(); }
      }
      // shooting stars
      for(let i=shots.length-1;i>=0;i--){
        const sh=shots[i]; sh.x+=sh.vx; sh.y+=sh.vy; sh.life-=0.012;
        const g=cx.createLinearGradient(sh.x,sh.y,sh.x-sh.vx*9,sh.y-sh.vy*9);
        g.addColorStop(0,`rgba(255,255,255,${sh.life})`); g.addColorStop(1,"rgba(255,255,255,0)");
        cx.strokeStyle=g; cx.lineWidth=2; cx.beginPath(); cx.moveTo(sh.x,sh.y); cx.lineTo(sh.x-sh.vx*9,sh.y-sh.vy*9); cx.stroke();
        if(sh.life<=0||sh.x>W+80) shots.splice(i,1);
      }
      cx.globalCompositeOperation="source-over";
      if(t-last>2600 && Math.random()<0.5){ spawnShot(); last=t; }
      if(!reduceMotion) requestAnimationFrame(draw);
    }
    window.__applyNebula=()=>{ nebula.forEach((nb,i)=>{ nb.c=THEME_NEBULA[i%THEME_NEBULA.length]; }); };
    addEventListener("resize",resize); resize(); if(reduceMotion){ draw(0); } else { requestAnimationFrame(draw); }
  })();


  /* ================= enhancement logic ================= */
  function disposeObj(root){
    root.traverse(o=>{
      if(o.geometry) o.geometry.dispose();
      if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose()); }
    });
  }

  // colour-by selector, incl. the phase/temperature mode
  function setColorMode(mode){
    colorMode=mode;
    const sel=document.getElementById("colorby"); if(sel) sel.value=mode;
    document.getElementById("tempBar").classList.toggle("show", mode==="phase");
    applyColors();
    if(mode==="phase"){ phaseCaption(); }
    else if(mode==="cat"){ if(CAPTIONS[curLayout]) setCaption(curLayout); }
    else {
      const NM={en:"Electronegativity",melt:"Melting point",boil:"Boiling point",radius:"Atomic radius",
        ie:"Ionization energy",ea:"Electron affinity",mass:"Atomic mass",density:"Density"};
      document.getElementById("caption").textContent=`Coloured by ${NM[mode]||mode} — blue (low) \u2192 red (high). Grey cards have no data.`;
    }
  }
  function phaseCaption(){
    document.getElementById("caption").textContent=
      `Cards coloured by physical state at ${tempK} K (${(tempK-273.15).toFixed(0)}°C) — `+
      `blue solid, green liquid, orange gas. Drag the slider to watch elements melt and boil.`;
  }
  function fmtTemp(T){ return `${T} K · ${(T-273.15).toFixed(0)}°C`; }
  (function initTemp(){
    const sl=document.getElementById("tempSlider"), lbl=document.getElementById("tempVal");
    if(!sl) return;
    lbl.textContent=fmtTemp(tempK);
    sl.addEventListener("input",()=>{ tempK=+sl.value; lbl.textContent=fmtTemp(tempK);
      if(colorMode==="phase"){ applyColors(); phaseCaption(); } });
    const pr=document.getElementById("tempPreset");
    if(pr) pr.addEventListener("click",()=>{ sl.value=298; sl.dispatchEvent(new Event("input")); });
  })();

  // table-view arrow-key navigation between neighbouring cards
  let _posMap=null;
  function buildPosMap(){ _posMap={}; const byNum={};
    cards.forEach(c=>byNum[c.data.n]=c.el);
    ELEMENTS.forEach(e=>{ _posMap[e.col+","+e.row]=byNum[e.n]; }); }
  function handleCardArrow(ev,e){
    const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[ev.key];
    if(!d) return;
    ev.preventDefault();
    if(!_posMap) buildPosMap();
    for(let step=1;step<=18;step++){
      const t=_posMap[(e.col+d[0]*step)+","+(e.row+d[1]*step)];
      if(t){ t.focus(); break; }
    }
  }

  // detail overlay: step to previous / next element by atomic number
  function stepEl(delta){
    if(!current) return;
    const idx=ELEMENTS.findIndex(x=>x.n===current.n), ni=idx+delta;
    if(ni<0||ni>=ELEMENTS.length) return;
    openDetail(ELEMENTS[ni]);
  }
  document.getElementById("prevEl").addEventListener("click",()=>stepEl(-1));
  document.getElementById("nextEl").addEventListener("click",()=>stepEl(1));

  // share / deep-link
  function updateHash(){ if(current) history.replaceState(null,"","#"+current.sym); }
  let _toastT;
  function toast(msg){
    const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
    clearTimeout(_toastT); _toastT=setTimeout(()=>t.classList.remove("show"),2200);
  }
  document.getElementById("shareBtn").addEventListener("click",async()=>{
    if(!current) return;
    const url=location.origin+location.pathname+location.search+"#"+current.sym;
    try{ await navigator.clipboard.writeText(url); toast("Link copied — "+current.name); }
    catch(_){ location.hash=current.sym; toast("Link is in the address bar"); }
  });
  function openFromHash(){
    const h=decodeURIComponent((location.hash||"").replace(/^#/,"")).trim();
    if(!h) return;
    const e=ELEMENTS.find(x=>x.sym.toLowerCase()===h.toLowerCase()||String(x.n)===h||x.name.toLowerCase()===h.toLowerCase());
    if(e) openDetail(e);
  }
  window.addEventListener("hashchange",()=>{ if(location.hash) openFromHash(); });

  // overlay: prev/next on arrows + a simple focus trap
  document.addEventListener("keydown",ev=>{
    if(!overlay.classList.contains("show")) return;
    if(ev.key==="ArrowLeft"){ ev.preventDefault(); stepEl(-1); }
    else if(ev.key==="ArrowRight"){ ev.preventDefault(); stepEl(1); }
  });
  overlay.addEventListener("keydown",ev=>{
    if(ev.key!=="Tab") return;
    const list=[...overlay.querySelectorAll('button,[tabindex]:not([tabindex="-1"]),canvas,input')]
      .filter(x=>!x.disabled && x.offsetParent!==null);
    if(!list.length) return;
    const first=list[0], last=list[list.length-1];
    if(ev.shiftKey && document.activeElement===first){ ev.preventDefault(); last.focus(); }
    else if(!ev.shiftKey && document.activeElement===last){ ev.preventDefault(); first.focus(); }
  });

  // global keyboard shortcuts: 1-4 views, / focus search
  window.addEventListener("keydown",ev=>{
    if(overlay.classList.contains("show")) return;
    if(anyOverlayOpen()) return;                 // CHANGED: Guide/About was not blocking 1-4 and /
    const tag=(ev.target.tagName||"").toLowerCase();
    if(tag==="input"||tag==="select"||tag==="textarea") return;
    if(ev.metaKey||ev.ctrlKey||ev.altKey) return;
    if(ev.key==="/"){ ev.preventDefault(); const s=document.getElementById("search"); if(s) s.focus(); return; }
    const views={"1":"table","2":"sphere","3":"helix","4":"grid"};
    if(views[ev.key]) setLayout(views[ev.key]);
  });

  // pinch-to-zoom on the main 3D scene (touch)
  function wireTouchZoom(){
    if(NATIVE_TZOOM) return;                    // OrbitControls handles pinch-zoom on touch devices
    const el=renderer && renderer.domElement; if(!el) return;
    let d0=0;
    const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
    el.addEventListener("touchstart",e=>{ if(e.touches.length===2) d0=dist(e.touches); },{passive:true});
    el.addEventListener("touchmove",e=>{
      if(e.touches.length!==2) return;
      e.preventDefault();
      const d=dist(e.touches); if(!d0){ d0=d; return; }
      zoomBy(d>d0?0.985:1.015); d0=d;
    },{passive:false});
    el.addEventListener("touchend",e=>{ if(e.touches.length<2) d0=0; },{passive:true});
  }

  /* ================= theme factory ================= */
  const THEMES={
    cosmic:{bg1:"#1b2130",bg2:"#0b0d11",accent:"#5ab0ff",accent2:"#93bdff",nebula:[[80,120,255],[150,90,255],[40,180,200],[255,90,160]]},
    galaxy:{bg1:"#2b1e3e",bg2:"#0c0814",accent:"#a490c2",accent2:"#c9b8e6",nebula:[[120,80,200],[160,110,220],[90,80,180],[210,150,240]]},
    ocean:{bg1:"#17313f",bg2:"#060f16",accent:"#3fb0b0",accent2:"#a8dadc",nebula:[[40,150,150],[30,110,140],[80,180,180],[60,140,160]]},
    tech:{bg1:"#14203a",bg2:"#060810",accent:"#3b82f6",accent2:"#00e5ff",nebula:[[0,120,255],[0,220,255],[40,90,220],[0,180,255]]},
    ember:{bg1:"#3a2418",bg2:"#120a06",accent:"#f4a261",accent2:"#e76f51",nebula:[[231,111,81],[244,162,97],[233,196,106],[200,90,70]]},
    forest:{bg1:"#1c3320",bg2:"#070f09",accent:"#a4ac86",accent2:"#c3cba6",nebula:[[80,140,90],[100,150,90],[60,120,80],[120,160,100]]}
  };
  function applyTheme(key){
    const t=THEMES[key]||THEMES.cosmic, r=document.documentElement.style;
    r.setProperty("--bg1",t.bg1); r.setProperty("--bg2",t.bg2);
    r.setProperty("--accent",t.accent); r.setProperty("--accent2",t.accent2);
    THEME_NEBULA.length=0; t.nebula.forEach(c=>THEME_NEBULA.push(c));
    if(window.__applyNebula) window.__applyNebula();
    const sel=document.getElementById("themeSel"); if(sel) sel.value=(THEMES[key]?key:"cosmic");
    try{ localStorage.setItem("pt-theme",key); }catch(_){}
  }
  (function initTheme(){
    const sel=document.getElementById("themeSel"); if(!sel) return;
    sel.addEventListener("change",()=>applyTheme(sel.value));
    let saved="cosmic"; try{ saved=localStorage.getItem("pt-theme")||"cosmic"; }catch(_){}
    applyTheme(saved);
  })();

  init();
  wireTouchZoom();
  buildMobileControls();
  // keep the group/period bars clear of the caption when it grows to 2 lines
  try{
    const _cap=document.getElementById("caption"); let _capH=-1;
    new MutationObserver(()=>{ const h=_cap.offsetHeight; if(h!==_capH){ _capH=h; layout(); } })
      .observe(_cap,{childList:true,characterData:true,subtree:true});
  }catch(_){}
  openFromHash();
  animate();

/* ---- PWA: install + offline ---- */
  (function(){
    // Register the service worker (needed for install + offline). Runs only on http(s),
    // so opening index.html via file:// simply skips it without errors.
    if("serviceWorker" in navigator && location.protocol.startsWith("http")){
      window.addEventListener("load",()=>{
        navigator.serviceWorker.register("sw.js").catch(err=>console.warn("SW registration failed:",err));
      });
    }

    const btn=document.getElementById("installBtn");
    let deferred=null;

    // Chrome / Edge / Android: capture the install prompt and show our button.
    window.addEventListener("beforeinstallprompt",(e)=>{
      e.preventDefault(); deferred=e; if(btn) btn.hidden=false;
    });
    if(btn){
      btn.addEventListener("click",async()=>{
        if(deferred){
          deferred.prompt();
          try{ await deferred.userChoice; }catch(_){}
          deferred=null; btn.hidden=true;
        }else{
          // iOS Safari has no prompt API — tell the user how to install manually.
          const iOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
          alert(iOS
            ? "To install: tap the Share button, then \"Add to Home Screen\"."
            : "To install: open your browser menu (⋮) and choose \"Install app\" / \"Add to Home screen\".");
        }
      });
    }

    // Hide the button once installed / when running as an installed app.
    window.addEventListener("appinstalled",()=>{ if(btn) btn.hidden=true; });
    if(window.matchMedia && matchMedia("(display-mode: standalone)").matches){ if(btn) btn.hidden=true; }

    // iOS never fires beforeinstallprompt — surface the button so users know it's installable.
    const iOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone=(window.navigator.standalone===true)||(window.matchMedia&&matchMedia("(display-mode: standalone)").matches);
    if(iOS && !standalone && btn){ btn.hidden=false; }
  })();

/* ---- icon swap + atom mark ---- */
  /* ADDED: swap every remaining glyph control for a real SVG, and drop an
     animated atom mark next to the title. Runs last so it wins over whatever
     the app wrote into those buttons during start-up. */
  (function(){
    const I = window.PT_ICONS;
    const $ = s => document.querySelector(s);

    // simple case: icon only
    const only = {
      "#resetView": I.reset, "#zoomIn": I.plus, "#zoomOut": I.minus,
      "#close": I.close, "#mSheetClose": I.close,
      "#prevEl": I.left, "#nextEl": I.right, "#layPrev": I.left, "#layNext": I.right,
      "#bohrPause": I.pause
    };
    Object.keys(only).forEach(sel=>{ const el=$(sel); if(el) el.innerHTML = only[sel]; });

    // icon + label
    const withText = {
      "#installBtn": [I.download, "Install app"],
      "#shareBtn":   [I.share,    "Share"],
      "#tempPreset": [I.thermo,   "room"],
      "#clearFilters":[I.clear,   "Clear all"],
      "#mClear":     [I.clear,    "Clear all"]
    };
    Object.keys(withText).forEach(sel=>{
      const el=$(sel); if(!el) return;
      el.innerHTML = withText[sel][0] + "<span>" + withText[sel][1] + "</span>";
    });

    // sort direction: put the arrow in front of the label the app keeps rewriting
    const sd = $("#sortDir");
    if(sd && !sd.querySelector("svg")) sd.insertAdjacentHTML("afterbegin", I.sort);

    // highlight menu button: keep the live #hlCount node, replace the rest
    const hl = $("#hlBtn"), hlCount = $("#hlCount");
    if(hl){
      hl.innerHTML = I.sliders + "<span>Highlight</span>" + I.down;
      if(hlCount) hl.appendChild(hlCount);
    }
    const mo = $("#mOptionsBtn");
    if(mo) mo.innerHTML = I.sliders + "<span>Options</span>" + I.down;

    // sphere toggle: setSphereBtn() rewrites this too, so only fill a bare button
    const sph = $("#sphereToggle");
    if(sph && !sph.querySelector("svg")){
      sph.innerHTML = I.sphereIn + "<span>" + (sph.textContent.trim() || "Step inside the sphere") + "</span>";
    }

    // animated atom mark beside the title
    const ATOM =
      '<svg id="atomMark" viewBox="0 0 24 24" aria-hidden="true">'
      + '<g class="spin"><g><ellipse class="shell" cx="12" cy="12" rx="10.6" ry="4.3"/>'
      +   '<circle class="e" cx="22.6" cy="12" r="1.5"/></g></g>'
      + '<g class="spin b"><g transform="rotate(60 12 12)"><ellipse class="shell" cx="12" cy="12" rx="10.6" ry="4.3"/>'
      +   '<circle class="e" cx="22.6" cy="12" r="1.5"/></g></g>'
      + '<g transform="rotate(-60 12 12)"><ellipse class="shell" cx="12" cy="12" rx="10.6" ry="4.3"/></g>'
      + '<circle class="nuc" cx="12" cy="12" r="2.5"/>'
      + '</svg>';
    const t = document.getElementById("title");
    if(t && !document.getElementById("atomMark")){
      const small = t.querySelector("small");
      const label = (t.childNodes[0] && t.childNodes[0].nodeValue || "Periodic Table").trim();
      t.innerHTML = '<div id="titleRow">' + ATOM + '<span>' + label + '</span></div>';
      if(small) t.appendChild(small);
    }
  })();

/* ---- subtle SFX (synthesized, no audio files) ---- */
  /* ADDED: a tiny Web Audio sound system — a soft tick on element select, a short
     whoosh on view switch. Defaults ON, persisted via localStorage, muted with a
     speaker-icon button next to the view switcher (and mirrored on mobile). Sounds
     only ever fire from user-initiated actions (click handlers already in place),
     so there's no autoplay-before-interaction issue. */
  window.PT_SFX = (function(){
    let ctx=null, muted=false;
    try{ muted = localStorage.getItem("pt-muted")==="1"; }catch(_){}

    function ac(){
      if(ctx) return ctx;
      try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(_){ ctx=null; }
      return ctx;
    }
    function ensureRunning(){
      const c=ac(); if(c && c.state==="suspended"){ c.resume().catch(()=>{}); }
      return c;
    }
    // short oscillator blip/sweep, gain-enveloped so nothing clicks or pops
    function tone({freq=600,to=null,dur=0.09,type="sine",gain=0.05,delay=0}={}){
      if(muted) return;
      const c=ensureRunning(); if(!c) return;
      const t0=c.currentTime+delay;
      const osc=c.createOscillator(), g=c.createGain();
      osc.type=type; osc.frequency.setValueAtTime(freq,t0);
      if(to!=null) osc.frequency.exponentialRampToValueAtTime(Math.max(1,to),t0+dur);
      g.gain.setValueAtTime(0.0001,t0);
      g.gain.exponentialRampToValueAtTime(gain,t0+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(t0); osc.stop(t0+dur+0.02);
    }
    function click(){ tone({freq:920,to:640,dur:0.07,type:"sine",gain:0.055}); }
    function whoosh(){
      tone({freq:260,to:820,dur:0.16,type:"sine",gain:0.035});
      tone({freq:180,to:60, dur:0.22,type:"triangle",gain:0.02,delay:0.02});
    }
    function isMuted(){ return muted; }
    function setMuted(v){
      muted=!!v;
      try{ localStorage.setItem("pt-muted", muted?"1":"0"); }catch(_){}
      syncMuteButtons();
    }
    function toggle(){ setMuted(!muted); }
    function paintBtn(btn){
      if(!btn) return;
      const I=window.PT_ICONS||{};
      btn.innerHTML = muted ? (I.soundOff||"") : (I.soundOn||"");
      btn.classList.toggle("muted",muted);
      btn.setAttribute("aria-pressed", muted?"true":"false");
      btn.title = muted ? "Unmute sound effects" : "Mute sound effects";
    }
    function syncMuteButtons(){
      paintBtn(document.getElementById("muteBtn"));
      paintBtn(document.getElementById("mMuteBtn"));
    }
    return { click, whoosh, isMuted, setMuted, toggle, syncMuteButtons };
  })();
  (function initSFX(){
    const sfx=window.PT_SFX; if(!sfx) return;
    sfx.syncMuteButtons();
    ["muteBtn","mMuteBtn"].forEach(id=>{
      const b=document.getElementById(id);
      if(b) b.addEventListener("click",()=>sfx.toggle());
    });
  })();
