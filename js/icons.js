/* icons.js — shared inline-SVG icon set (window.PT_ICONS). Loaded first. */
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
