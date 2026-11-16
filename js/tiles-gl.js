/* tiles-gl.js — draws the 118 element tiles in WebGL (one small quad each) instead of
   118 DOM nodes moved by CSS 3D transforms. The tile body, border, glow, hover sheen and
   search pulse are computed in a fragment shader; the text comes from a texture atlas
   drawn once on a 2D canvas. Colour, dim, highlight and sort-label changes are eased
   per tile, so every state change is a smooth transition and costs no DOM work. */
const TILE_W=112, TILE_H=140, TILE_PAD=64;   // PAD = transparent margin that holds the glow

const Tiles=(function(){
  const list=[];                 // per-tile state, index = position in ELEMENTS
  const meshes=[];
  let geo=null, texA=null, texB=null, cvA=null, cvB=null;
  let cols=14, rows=9, S=2;      // atlas grid + pixels per CSS px
  const shared={ uSortMix:{value:0}, uTime:{value:0}, uMapA:{value:null}, uMapB:{value:null} };
  let sortMixT=0, sortMeta=null, sortProp=null;
  let hoverI=-1, focusI=-1, instant=false, pulseUntil=0;
  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();

  const VERT=`
    varying vec2 vP;
    void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const FRAG=`
    precision highp float;
    uniform sampler2D uMapA, uMapB;
    uniform vec4 uUV;            // atlas cell: offset.xy, size.zw
    uniform vec3 uColor;
    uniform float uOp, uGray, uMatch, uHover, uFocus, uSheen, uSortMix, uTime;
    varying vec2 vP;
    float sdBox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
    float soft(float d, float s){ return 0.5*exp(-(d*d)/(2.0*s*s)); }
    void main(){
      vec2 hb=vec2(${(TILE_W/2).toFixed(1)},${(TILE_H/2).toFixed(1)});
      float d=sdBox(vP,hb,8.0);
      float aa=max(fwidth(d),0.0001);
      float body=1.0-smoothstep(-aa,aa,d);
      vec2 t=(vP+hb)/(2.0*hb);                       // 0..1 across the tile, y up
      float od=max(d,0.0);

      // --- outside: drop shadow + coloured glow (premultiplied, glow is half-additive)
      float sh=0.5*soft(max(sdBox(vP+vec2(0.0,3.0),hb,8.0),0.0),6.0)*2.0;
      float pulse=0.5+0.5*sin(uTime*4.19);            // 1.5 s period, like the old fxMatch
      float gRest=0.30*soft(od,7.0)*2.0;
      float gHover=0.95*soft(od,13.0)*2.0;
      float gMatchW=soft(od,mix(13.0,20.0,pulse))*2.0;
      float gMatchC=0.95*soft(od,mix(26.0,42.0,pulse))*2.0;
      vec3 glowRGB=uColor*mix(gRest,gHover,uHover);
      float glowA=mix(gRest,gHover,uHover)*0.55;
      glowRGB=mix(glowRGB, vec3(1.0)*gMatchW+uColor*gMatchC, uMatch);
      glowA=mix(glowA, clamp(gMatchW+gMatchC*0.6,0.0,1.0), uMatch);
      vec3 rgb=glowRGB*(1.0-body);
      float a=max(glowA, sh*(1.0-uMatch))*(1.0-body);

      // --- tile body: dark glass tinted by the category colour
      vec3 bg=mix(vec3(0.035,0.043,0.059),uColor,0.13);
      float rad=1.0-smoothstep(0.0,1.0,length((t-vec2(0.5,1.1))*vec2(0.8,1.0))/0.78);
      bg=mix(bg,uColor,0.34*rad);
      float lin=1.0-smoothstep(0.0,0.42,dot(t-vec2(0.0,1.0),normalize(vec2(0.35,-1.0)))/1.05);
      bg+=vec3(0.06)*lin;
      // category bar across the top, with a highlight that slides while hovered
      float bar=step(1.0-5.0/${TILE_H.toFixed(1)},t.y);
      float slide=0.5+0.5*sin((t.x*2.2-uTime*4.5));
      vec3 barC=mix(uColor,mix(uColor,vec3(1.0),0.65),slide*uHover);
      bg=mix(bg,barC,bar*0.95);
      // 1px border
      float edge=smoothstep(-1.6-aa,-0.9,d);
      vec3 bc=mix(mix(vec3(0.0),uColor,0.62),uColor,uHover);
      bc=mix(bc,vec3(1.0),uMatch);
      bg=mix(bg,bc,edge);
      // sheen sweep on hover
      float sx=(t.x+ (1.0-t.y)*0.45) - mix(-0.4,1.9,uSheen);
      float sheen=(1.0-smoothstep(0.0,0.14,abs(sx)))*0.28*sin(3.14159*clamp(uSheen,0.0,1.0));
      bg+=vec3(sheen);
      float bodyA=0.80*body;
      rgb=rgb*(1.0-bodyA)+bg*bodyA;
      a=a*(1.0-bodyA)+bodyA;

      // --- text from the atlas (premultiplied white text with a baked dark shadow)
      vec2 uv=uUV.xy+t*uUV.zw;
      vec4 tx=mix(texture2D(uMapA,uv),texture2D(uMapB,uv),uSortMix)*body;
      rgb=rgb*(1.0-tx.a)+tx.rgb;
      a=a*(1.0-tx.a)+tx.a;

      // --- keyboard focus ring (3px, 2px outside the tile)
      float ring=(1.0-smoothstep(1.5,1.5+aa+0.8,abs(d-3.5)))*uFocus;
      rgb=mix(rgb,vec3(1.0),ring); a=max(a,ring);

      float l=dot(rgb,vec3(0.3,0.59,0.11));
      rgb=mix(rgb,vec3(l),uGray);
      gl_FragColor=vec4(rgb,a)*uOp;
    }`;

  /* ---------- text atlas ---------- */
  function fit(ctx,text,maxW,px,weight,family){
    let p=px; ctx.font=`${weight} ${p}px ${family}`;
    const w=ctx.measureText(text).width;
    if(w>maxW){ p=px*maxW/w; ctx.font=`${weight} ${p}px ${family}`; }
    return p;
  }
  function drawAtlas(cv,sort){
    const cw=TILE_W*S, ch=TILE_H*S;
    cv.width=cols*cw; cv.height=rows*ch;
    const ctx=cv.getContext("2d");
    ctx.clearRect(0,0,cv.width,cv.height);
    const EXO="'Exo','Helvetica Neue',Arial,sans-serif", MONO="'Roboto Mono',ui-monospace,monospace";
    ELEMENTS.forEach((e,i)=>{
      const cx=(i%cols)*cw, cy=Math.floor(i/cols)*ch;
      ctx.save();
      ctx.beginPath(); ctx.rect(cx,cy,cw,ch); ctx.clip();
      ctx.setTransform(S,0,0,S,cx,cy);
      ctx.fillStyle="#fff"; ctx.textBaseline="middle";
      ctx.shadowColor="rgba(0,0,0,.9)"; ctx.shadowBlur=3*S; ctx.shadowOffsetY=1*S;
      ctx.textAlign="right"; ctx.font=`800 14.7px ${MONO}`; ctx.fillText(String(e.n),TILE_W-11,18);
      ctx.textAlign="left";  ctx.font=`800 10px ${MONO}`; ctx.globalAlpha=.95; ctx.fillText(String(e.block).toUpperCase(),11,17); ctx.globalAlpha=1;
      ctx.textAlign="center";
      ctx.shadowBlur=7*S; ctx.shadowOffsetY=2*S; ctx.shadowColor="rgba(0,0,0,.72)";
      ctx.font=`700 32.8px ${EXO}`; ctx.fillText(e.sym,TILE_W/2,48);
      ctx.shadowBlur=3*S; ctx.shadowOffsetY=1*S; ctx.shadowColor="rgba(0,0,0,.92)";
      if(!sort){
        fit(ctx,e.name,TILE_W-10,17.9,700,EXO); ctx.fillText(e.name,TILE_W/2,105);
        ctx.fillStyle="rgba(255,255,255,.9)"; ctx.font=`600 13.4px ${MONO}`; ctx.fillText((+e.mass).toFixed(2),TILE_W/2,125);
      } else {
        fit(ctx,e.name,TILE_W-10,11.8,700,EXO); ctx.fillText(e.name,TILE_W/2,103);
        const v=e[sortProp], txt=(typeof v==="number")?(+v).toFixed(sortMeta.fix)+sortMeta.unit:"—";
        fit(ctx,txt,TILE_W-8,13.1,800,MONO); ctx.fillText(txt,TILE_W/2,126);
      }
      ctx.restore();
    });
  }
  function makeTex(cv,renderer){
    const tx=new THREE.CanvasTexture(cv);
    tx.premultiplyAlpha=true; tx.generateMipmaps=true;
    tx.minFilter=THREE.LinearMipmapLinearFilter; tx.magFilter=THREE.LinearFilter;
    tx.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return tx;
  }

  /* ---------- build ---------- */
  function build(renderer,scene,objects){
    const small=(window.matchMedia&&matchMedia("(pointer:coarse)").matches)||window.innerWidth<=900;
    S=small?1.5:2;
    const maxTex=renderer.capabilities.maxTextureSize||4096;
    while(cols*TILE_W*S>maxTex||rows*TILE_H*S>maxTex) S-=0.25;
    cvA=document.createElement("canvas"); cvB=document.createElement("canvas");
    drawAtlas(cvA,false);
    texA=makeTex(cvA,renderer); shared.uMapA.value=texA; shared.uMapB.value=texA;
    geo=new THREE.PlaneGeometry(TILE_W+2*TILE_PAD,TILE_H+2*TILE_PAD);
    ELEMENTS.forEach((e,i)=>{
      const c=new THREE.Color(CATEGORY_COLORS[e.cat]||CATEGORY_COLORS.Unknown);
      const mat=new THREE.ShaderMaterial({
        vertexShader:VERT, fragmentShader:FRAG, transparent:true, premultipliedAlpha:true,
        depthTest:false, depthWrite:false, side:THREE.FrontSide,
        uniforms:{
          uMapA:shared.uMapA, uMapB:shared.uMapB, uSortMix:shared.uSortMix, uTime:shared.uTime,
          uUV:{value:new THREE.Vector4((i%cols)/cols, 1-(Math.floor(i/cols)+1)/rows, 1/cols, 1/rows)},
          uColor:{value:c.clone()}, uOp:{value:1}, uGray:{value:0}, uMatch:{value:0},
          uHover:{value:0}, uFocus:{value:0}, uSheen:{value:1}
        }
      });
      mat.extensions.derivatives=true;
      const m=new THREE.Mesh(geo,mat);
      m.userData.i=i;
      m.position.copy(objects[i].position);
      scene.remove(objects[i]); scene.add(m); objects[i]=m;      // tweens keep driving objects[i]
      meshes.push(m);
      list.push({mesh:m,u:mat.uniforms, colT:c.clone(), colAt:0, colNext:null,
        opT:1, grayT:0, matchT:0, hoverT:0, focusT:0, tap:-1, sheen:1, hidden:false});
    });
    // redraw once the web fonts are in, so the atlas does not keep the fallback face
    const _fontsIn=document.fonts&&document.fonts.check&&document.fonts.check("700 33px Exo")&&document.fonts.check("800 15px 'Roboto Mono'");
    if(!_fontsIn&&document.fonts&&document.fonts.load){
      Promise.all(["700 33px Exo","700 18px Exo","800 15px 'Roboto Mono'","600 13px 'Roboto Mono'"].map(f=>document.fonts.load(f)))
        .then(()=>{ drawAtlas(cvA,false); texA.needsUpdate=true; if(sortProp){ drawAtlas(cvB,true); texB.needsUpdate=true; } render(); })
        .catch(()=>{});
    }
  }

  /* ---------- state setters (all eased in update) ---------- */
  function setColor(i,hex,delay){
    const s=list[i]; if(!s) return;
    if(instant||!delay){ s.colT.set(hex); s.colNext=null; }
    else { s.colNext=new THREE.Color(hex); s.colAt=performance.now()+delay; }
    render();
  }
  function setState(i,dim,match){
    const s=list[i]; if(!s) return;
    s.opT=s.hidden?0:(dim?0.12:1); s.grayT=dim?0.85:0; s.dim=!!dim;
    if(match&&!s.matchT) pulseUntil=performance.now()+4500;   // three 1.5 s pulses, then steady
    s.matchT=match?1:0; render();
  }
  function setHidden(i,hidden){
    const s=list[i]; if(!s) return;
    s.hidden=!!hidden; s.opT=hidden?0:(s.dim?0.12:1);
    if(!hidden) s.mesh.visible=true; render();
  }
  function setHover(i){
    if(i===hoverI) return;
    if(hoverI>=0) list[hoverI].hoverT=0;
    hoverI=i;
    if(i>=0){ list[i].hoverT=1; list[i].sheen=0; }
    render();
  }
  function setFocus(i){
    if(focusI>=0) list[focusI].focusT=0;
    focusI=i; if(i>=0) list[i].focusT=1; render();
  }
  function tap(i){ if(list[i]&&!instant){ list[i].tap=performance.now(); render(); } }
  function setSort(prop,meta){
    if(prop){
      sortProp=prop; sortMeta=meta;
      drawAtlas(cvB,true);
      if(!texB){ texB=makeTex(cvB,renderer); } else texB.needsUpdate=true;
      shared.uMapB.value=texB; sortMixT=1;
    } else sortMixT=0;
    render();
  }
  function setInstant(v){ instant=!!v; }

  /* ---------- per-frame easing; returns true while anything is still moving ---------- */
  function ease(cur,target,k){ const d=target-cur; return Math.abs(d)<0.002?target:cur+d*k; }
  function update(dt,now){
    let busy=false;
    const kC=instant?1:1-Math.exp(-dt/0.16), kO=instant?1:1-Math.exp(-dt/0.12), kH=instant?1:1-Math.exp(-dt/0.07);
    shared.uTime.value=now/1000;
    const sm=ease(shared.uSortMix.value,sortMixT,kO); if(sm!==shared.uSortMix.value){ shared.uSortMix.value=sm; busy=true; }
    for(let i=0;i<list.length;i++){
      const s=list[i], u=s.u;
      if(s.colNext){ if(now>=s.colAt){ s.colT.copy(s.colNext); s.colNext=null; } busy=true; }
      const c=u.uColor.value, t=s.colT;
      if(Math.abs(c.r-t.r)+Math.abs(c.g-t.g)+Math.abs(c.b-t.b)>0.004){ c.r+=(t.r-c.r)*kC; c.g+=(t.g-c.g)*kC; c.b+=(t.b-c.b)*kC; busy=true; }
      else if(c.r!==t.r||c.g!==t.g||c.b!==t.b) c.copy(t);
      let v;
      v=ease(u.uOp.value,s.opT,kO);      if(v!==u.uOp.value){ u.uOp.value=v; busy=true; }
      v=ease(u.uGray.value,s.grayT,kO);  if(v!==u.uGray.value){ u.uGray.value=v; busy=true; }
      v=ease(u.uMatch.value,s.matchT,kO);if(v!==u.uMatch.value){ u.uMatch.value=v; busy=true; }
      v=ease(u.uHover.value,s.hoverT,kH);if(v!==u.uHover.value){ u.uHover.value=v; busy=true; }
      v=ease(u.uFocus.value,s.focusT,kH);if(v!==u.uFocus.value){ u.uFocus.value=v; busy=true; }
      if(s.sheen<1){ s.sheen=instant?1:Math.min(1,s.sheen+dt/0.7); u.uSheen.value=s.sheen; busy=true; }
      if(s.hoverT===1&&!instant) busy=true;                      // sliding category bar while hovered
      if(s.tap>=0){                                              // squash + bounce on select
        const p=(now-s.tap)/460;
        if(p>=1){ s.tap=-1; s.mesh.scale.setScalar(1); }
        else { const k=p<0.4?1-0.09*Math.sin(Math.PI*p/0.4):1+0.045*Math.sin(Math.PI*(p-0.4)/0.6)*(1-p); s.mesh.scale.setScalar(k); }
        busy=true;
      }
      if(s.hidden&&u.uOp.value<0.004&&s.mesh.visible) s.mesh.visible=false;
    }
    if(now<pulseUntil&&!instant) busy=true;
    return busy;
  }

  /* ---------- picking: which tile is under a screen point ---------- */
  function pick(clientX,clientY,camera,dom){
    const r=dom.getBoundingClientRect();
    ndc.set(((clientX-r.left)/r.width)*2-1, -((clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(ndc,camera);
    const hits=ray.intersectObjects(meshes,false);
    const fw=TILE_W+2*TILE_PAD, fh=TILE_H+2*TILE_PAD;
    for(const h of hits){
      const s=list[h.object.userData.i];
      if(s.hidden||!h.uv) continue;
      if(Math.abs((h.uv.x-0.5)*fw)<=TILE_W/2 && Math.abs((h.uv.y-0.5)*fh)<=TILE_H/2) return h.object.userData.i;
    }
    return -1;
  }
  // screen rectangle of a tile (used by tests and by anything that needs to point at one)
  function screenRect(i,camera,dom){
    const m=meshes[i], r=dom.getBoundingClientRect(), v=new THREE.Vector3();
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{
      v.set(sx*TILE_W/2,sy*TILE_H/2,0).applyMatrix4(m.matrixWorld).project(camera);
      const x=r.left+(v.x+1)/2*r.width, y=r.top+(1-v.y)/2*r.height;
      x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y);
    });
    return {left:x0,top:y0,width:x1-x0,height:y1-y0};
  }

  return { build,setColor,setState,setHidden,setHover,setFocus,tap,setSort,setInstant,update,pick,screenRect,
           get hover(){ return hoverI; }, list };
})();
window.PT_TILES=Tiles;
