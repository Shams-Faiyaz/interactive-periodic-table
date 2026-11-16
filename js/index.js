(function(){
  "use strict";
  const $  = (s,r)=> (r||document).querySelector(s);
  const $$ = (s,r)=> [...(r||document).querySelectorAll(s)];
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================================
     HERO — cycle the big tile through real elements
     ========================================================= */
  const HERO = [
    {n:11, sym:"Na", name:"Sodium",   cat:"Alkali metal",  note:"melts at 371 K",  tint:["#FF9E6B","#FF7A3D","#D9481A"]},
    {n:8,  sym:"O",  name:"Oxygen",   cat:"Nonmetal",      note:"boils at 90 K",   tint:["#6FD6FF","#3DA5FF","#1663C4"]},
    {n:79, sym:"Au", name:"Gold",     cat:"Transition",    note:"melts at 1337 K", tint:["#FFE071","#FFD23F","#C9931A"]},
    {n:2,  sym:"He", name:"Helium",   cat:"Noble gas",     note:"boils at 4 K",    tint:["#A98BFF","#7B4BFF","#4B21B8"]},
    {n:17, sym:"Cl", name:"Chlorine", cat:"Halogen",       note:"boils at 239 K",  tint:["#4FE3D2","#00C2B2","#008A7E"]},
    {n:26, sym:"Fe", name:"Iron",     cat:"Transition",    note:"melts at 1811 K", tint:["#FF7FAE","#FF3D8B","#B5124F"]}
  ];
  const tileNum=$("#tileNum"), tileSym=$("#tileSym"), tileNm=$("#tileNm"),
        tileMeta=$("#tileMeta"), bigTile=$("#bigTile");
  let heroI = 0;
  function paintHero(i){
    const e = HERO[i];
    tileNum.textContent = e.n;
    tileSym.textContent = e.sym;
    tileNm.textContent  = e.name.toUpperCase();
    tileMeta.textContent = e.cat + " · " + e.note;
    bigTile.style.setProperty("--tint","linear-gradient(150deg,"+e.tint[0]+","+e.tint[1]+" 55%,"+e.tint[2]+")");
  }
  paintHero(0);
  if(!reduce){
    setInterval(()=>{ if(document.hidden) return; heroI = (heroI+1) % HERO.length; paintHero(heroI); }, 3200);
  }

  /* =========================================================
     REVEAL ON SCROLL
     ========================================================= */
  if(reduce || !("IntersectionObserver" in window)){
    $$(".rv").forEach(el=> el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(entries=>{
      entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } });
    }, {rootMargin:"0px 0px -60px 0px", threshold:.08});
    $$(".rv").forEach(el=> io.observe(el));
  }

  /* =========================================================
     SERVICE WORKER — offline support, http(s) only
     ========================================================= */
  if("serviceWorker" in navigator && location.protocol.indexOf("http")===0){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("sw.js").catch(e=> console.warn("SW registration failed:", e));
    });
  }
})();
