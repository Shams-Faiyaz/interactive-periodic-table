/* starfield.js — background canvas: nebula, parallax stars, shooting stars. */
  /* ---------- ambient VFX: nebula + parallax starfield + shooting stars ---------- */
  (function starfield(){
    const cv=document.getElementById("bg"), cx=cv.getContext("2d");
    let stars=[], nebula=[], shots=[], W=0, H=0, dpr=Math.min(1.5,window.devicePixelRatio||1);   // PERF: 1.5 cap
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
          tw:(Math.random()*0.03+0.004)*2, ph:Math.random()*6.28,
          vx:(depth*0.12+0.02)*2*(Math.random()<.5?-1:1)};   // PERF: x2 per step, drawn at ~30fps = same speed
      });
      nebula=Array.from({length:5},(_,i)=>({
        x:Math.random()*W, y:Math.random()*H,
        r:Math.max(W,H)*(0.28+Math.random()*0.28),
        c:THEME_NEBULA[i%THEME_NEBULA.length],
        vx:(Math.random()-.5)*0.12, vy:(Math.random()-.5)*0.10,
        ph:Math.random()*6.28
      }));
    }
    function spawnShot(){
      const y=Math.random()*H*0.5;
      shots.push({x:-60,y,vx:(7+Math.random()*5)*2,vy:(2+Math.random()*2)*2,life:1});
    }
    let last=0, _lastDraw=0;
    function draw(t){
      // PERF: ~30fps, and nothing at all while the tab is hidden or the detail card covers the sky
      if(!reduceMotion){
        requestAnimationFrame(draw);
        if(document.hidden || overlay.classList.contains("show") || t-_lastDraw<30) return;
        _lastDraw=t;
      }
      cx.clearRect(0,0,W,H);
      // nebula clouds (screen-blend glow)
      cx.globalCompositeOperation="lighter";
      for(const nb of nebula){
        nb.x+=nb.vx; nb.y+=nb.vy; nb.ph+=0.008;
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
        const sh=shots[i]; sh.x+=sh.vx; sh.y+=sh.vy; sh.life-=0.024;
        const g=cx.createLinearGradient(sh.x,sh.y,sh.x-sh.vx*4.5,sh.y-sh.vy*4.5);
        g.addColorStop(0,`rgba(255,255,255,${sh.life})`); g.addColorStop(1,"rgba(255,255,255,0)");
        cx.strokeStyle=g; cx.lineWidth=2; cx.beginPath(); cx.moveTo(sh.x,sh.y); cx.lineTo(sh.x-sh.vx*4.5,sh.y-sh.vy*4.5); cx.stroke();
        if(sh.life<=0||sh.x>W+80) shots.splice(i,1);
      }
      cx.globalCompositeOperation="source-over";
      if(t-last>2600 && Math.random()<0.25){ spawnShot(); last=t; }
    }
    window.__applyNebula=()=>{ nebula.forEach((nb,i)=>{ nb.c=THEME_NEBULA[i%THEME_NEBULA.length]; }); };
    let _srz=0; addEventListener("resize",()=>{ clearTimeout(_srz); _srz=setTimeout(resize,150); }); resize();   // PERF: debounced
    if(reduceMotion){ draw(0); } else { requestAnimationFrame(draw); }
  })();
