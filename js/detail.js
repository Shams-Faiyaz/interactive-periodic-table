/* detail.js — the element detail card: open/close, tabs, orbital diagram, data panel, prev/next, share link, keyboard. */
  /* ================= DETAIL OVERLAY ================= */
  const overlay=document.getElementById("overlay");
  document.getElementById("close").addEventListener("click",closeDetail);
  overlay.addEventListener("click",e=>{ if(e.target===overlay) closeDetail(); });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape" && overlay.classList.contains("show")) closeDetail(); });
  document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.t)));

  // a11y: expose the tab strip and its panels as real tabs
  document.querySelectorAll("#tabs button").forEach(b=>{ b.setAttribute("role","tab"); b.id="tab-"+b.dataset.t; b.setAttribute("aria-controls","panel-"+b.dataset.t); b.setAttribute("aria-selected",b.classList.contains("active")?"true":"false"); });
  document.querySelectorAll("#panels .panel").forEach(p=>{ p.setAttribute("role","tabpanel"); p.setAttribute("aria-labelledby",p.id.replace("panel-","tab-")); });
  function switchTab(t){
    document.querySelectorAll("#tabs button").forEach(b=>{ const on=b.dataset.t===t; b.classList.toggle("active",on); b.setAttribute("aria-selected",on?"true":"false"); });
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
    overlay.classList.add("show"); document.body.classList.add("detail-open");
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
    overlay.classList.remove("show"); document.body.classList.remove("detail-open"); bohr.active=false; shapes.active=false;
    _dirty=true;
    if(location.hash) history.replaceState(null,"",location.pathname+location.search);
    const el=lastFocus||document.getElementById("search");
    if(el && el.focus){ try{ el.focus(); }catch(_){} }
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
