/* main.js — start-up (runs last), PWA install + service worker, icon swap and the title atom mark. */
  init();
  wireTouchZoom();
  buildMobileControls();
  // keep the group/period bars clear of the caption when it grows to 2 lines
  try{
    const _cap=document.getElementById("caption"); let _capH=-1;
    let _capQ=false;   // PERF: read layout once per frame, not inside the mutation callback
    new MutationObserver(()=>{ if(_capQ) return; _capQ=true; requestAnimationFrame(()=>{ _capQ=false; const h=_cap.offsetHeight; if(h!==_capH){ _capH=h; layout(); } }); })
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
