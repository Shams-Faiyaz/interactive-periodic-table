/* scene.js — the 3D scene: build, layouts (table/sphere/helix/grid/sort), camera, zoom, resize, render loop. */
  /* ---------- build scene ---------- */
  function init(){
    ELEMENTS.forEach(e=>{ e.mass=+e.mass; });   // FIX: mass was a string → broke sort & colour-by
    camera=new THREE.PerspectiveCamera(40,window.innerWidth/window.innerHeight,1,10000);
    camera.position.z=3000;
    scene=new THREE.Scene();

    ELEMENTS.forEach((e,idx)=>{
      const el=document.createElement("div");
      el.className="element";
      el.tabIndex=0; el.setAttribute("role","button");
      el.setAttribute("aria-label",`${e.name}, symbol ${e.sym}, atomic number ${e.n}, ${e.cat}`);
      el.dataset.n=e.n; el.title=e.name;
      el.style.setProperty("--c",CATEGORY_COLORS[e.cat]||CATEGORY_COLORS.Unknown);
      // ADDED: --i staggers the idle "breathing" animation cheaply (set once, no per-frame JS)
      el.style.setProperty("--i",idx%14);
      // ADDED: contents live in a .tile-inner wrapper so tap/breathe scale effects can
      // animate `transform` on a child without ever touching the CSS3D renderer's own
      // per-frame transform writes on `.element` itself.
      el.innerHTML=`<div class="tile-inner"><div class="catbar"></div><div class="wt">${e.block}</div><div class="number">${e.n}</div>
        <div class="symbol">${e.sym}</div><div class="name">${e.name}</div><div class="mass">${(+e.mass).toFixed(2)}</div><div class="pval"></div></div>`;
      // ADDED: tactile squash/bounce micro-interaction on selection
      const tapFx=()=>{
        if(reduceMotion) return;
        el.classList.remove("tapped"); void el.offsetWidth; el.classList.add("tapped");
      };
      el.addEventListener("click",ev=>{ev.stopPropagation();tapFx();openDetail(e);});
      // Touch: OrbitControls treats a finger-down as a pan, which swallows the tap/click.
      // Detect a genuine tap (little movement, short time) and open the card ourselves.
      let _tx=0,_ty=0,_tt=0,_moved=false;
      el.addEventListener("touchstart",ev=>{ const t=ev.changedTouches[0]; _tx=t.clientX;_ty=t.clientY;_tt=Date.now();_moved=false; },{passive:true});
      el.addEventListener("touchmove",ev=>{ const t=ev.changedTouches[0]; if(Math.abs(t.clientX-_tx)>12||Math.abs(t.clientY-_ty)>12) _moved=true; },{passive:true});
      el.addEventListener("touchend",ev=>{ if(!_moved && ev.touches.length===0 && Date.now()-_tt<500){ ev.preventDefault(); ev.stopPropagation(); tapFx(); openDetail(e); } },{passive:false});
      el.addEventListener("keydown",ev=>{
        if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); ev.stopPropagation(); tapFx(); openDetail(e); return; }
        if(curLayout==="table" && !overlay.classList.contains("show")) handleCardArrow(ev,e);
      });
      el.addEventListener("animationend",ev=>{ if(ev.animationName==="fxTap") el.classList.remove("tapped"); });
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
    // FIX: a later CSS rule gives #sphereToggle display:inline-flex, so it showed in table view
    // on first load and covered Np/Pu/Am/Cm. setLayout() only hides it after the first switch.
    document.getElementById("sphereToggle").style.display="none";
    layout();                                  // size viewport + compute fit distances
    camera.position.set(0,0,fitDist.table);    // start framed on the table
    controls.update();
    transform(targets.table,1800,fitDist.table); // gentle fly-in from scattered start
    syncZoomSlider();
    // PERF: at most one re-layout per frame while the window is being resized
    let _rz=0; window.addEventListener("resize",()=>{ cancelAnimationFrame(_rz); _rz=requestAnimationFrame(onResize); });
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
    if(dur<=0 && typeof camZ!=="number"){ placeInstant(arr); return; }   // PERF: no zero-length tweens (resize in grid view)
    if(reduceMotion){
      placeInstant(arr);
      if(typeof camZ==="number"){
        const dir=camera.position.clone().sub(controls.target).normalize();
        camera.position.copy(dir.multiplyScalar(camZ)); controls.target.set(0,0,0); controls.update();
      }
      render(); return;
    }
    // ADDED: bouncy/elastic layout transitions — a mild spring overshoot (TWEEN.Easing.Back.Out)
    // instead of plain Cubic.InOut, so switching Table/Sphere/Helix/Grid feels alive rather
    // than mechanical. Camera keeps a gentler ease so the scene doesn't feel disorienting.
    const layoutEasing=TWEEN.Easing.Back.Out;
    for(let i=0;i<objects.length;i++){
      const o=objects[i], t=arr[i];
      const d=dur*(0.92+Math.random()*0.16);   // tight, consistent stagger (cleaner)
      new TWEEN.Tween(o.position).to({x:t.position.x,y:t.position.y,z:t.position.z},d).easing(layoutEasing).start();
      new TWEEN.Tween(o.rotation).to({x:t.rotation.x,y:t.rotation.y,z:t.rotation.z},d).easing(TWEEN.Easing.Cubic.InOut).start();
    }
    // glide the camera straight back to frame the new layout, re-centering it
    if(typeof camZ==="number"){
      const dir=camera.position.clone().sub(controls.target).normalize();
      const end=dir.multiplyScalar(camZ);
      new TWEEN.Tween(camera.position).to({x:end.x,y:end.y,z:end.z},dur*1.1)
        .easing(TWEEN.Easing.Quadratic.Out).start();
      new TWEEN.Tween(controls.target).to({x:0,y:0,z:0},dur*1.1).easing(TWEEN.Easing.Quadratic.Out).start();
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
  // PERF: render on demand. The CSS3D scene is only re-rendered when a tween is running,
  // the camera is moving/damping, or something called render(). Nothing is rendered behind
  // the open detail card. body.fx-busy pauses the idle CSS animations while the scene moves.
  let _dirty=true, _busyT=0, _busyOn=false;
  function animate(t){
    requestAnimationFrame(animate); if(document.hidden) return;
    t=t||performance.now();
    const tweening=TWEEN.getAll().length>0; TWEEN.update();
    const moved=controls.update();
    if(tweening||moved||_dirty){ _busyT=t; if(!_busyOn){ _busyOn=true; document.body.classList.add("fx-busy"); } }
    else if(_busyOn && t-_busyT>400){ _busyOn=false; document.body.classList.remove("fx-busy"); syncZoomSlider(); }   // slider follows the settled camera
    if(!overlay.classList.contains("show") && (tweening||moved||_dirty)){ renderer.render(scene,camera); _dirty=false; }
    if(bohr.active) renderBohr(); if(shapes.active) renderShapes();
  }
  function render(){ _dirty=true; }

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
