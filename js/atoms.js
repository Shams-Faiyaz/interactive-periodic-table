/* atoms.js — the two WebGL views inside the detail card: Bohr atom and orbital shapes. */
  /* ================= enhancement logic ================= */
  function disposeObj(root){
    root.traverse(o=>{
      if(o.geometry) o.geometry.dispose();
      if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose()); }
    });
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
    bohr.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));   // PERF: cap (3x phones drew 9x pixels)
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
    // PERF: one shared geometry + material for every electron (was one of each per electron)
    const eGeo=new THREE.SphereGeometry(eSize,18,18);
    const eMat=new THREE.MeshStandardMaterial({color:0xbfefff,emissive:0x33aadd,emissiveIntensity:.9,roughness:.4});
    shells.forEach((count,si)=>{
      const r=shellR(si), tilt=is2D?0:si*0.22;
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r,is2D?0.03:0.018,8,120),
        new THREE.MeshBasicMaterial({color:0x9fb6d6,transparent:true,opacity:is2D?0.45:0.30}));
      ring.rotation.x = is2D ? 0 : (Math.PI/2 + tilt);   // 2D: rings lie flat in the screen plane
      g.add(ring);
      const eg=new THREE.Group(); if(!is2D) eg.rotation.x=tilt;
      for(let k=0;k<count;k++){
        const a=(k/count)*Math.PI*2;
        const em=new THREE.Mesh(eGeo,eMat);
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
    shapes.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
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
