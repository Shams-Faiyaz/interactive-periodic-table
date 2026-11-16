/* controls.js — filters, search, category isolate, colour-by + temperature, mobile controls, themes. */
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
    let _tq=false;   // PERF: recolour at most once per frame while dragging
    sl.addEventListener("input",()=>{ tempK=+sl.value; lbl.textContent=fmtTemp(tempK);
      if(colorMode==="phase" && !_tq){ _tq=true; requestAnimationFrame(()=>{ _tq=false; applyColors(); phaseCaption(); }); } });
    const pr=document.getElementById("tempPreset");
    if(pr) pr.addEventListener("click",()=>{ sl.value=298; sl.dispatchEvent(new Event("input")); });
  })();

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
