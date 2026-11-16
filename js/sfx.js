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
