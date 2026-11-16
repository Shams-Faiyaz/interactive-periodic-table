# Valence — landing page + Interactive Periodic Table (installable PWA)

Two pages, one folder.

- `index.html` — **the landing page.** Claymorphism design: hero, an About
  section, a Guide / how-to-use section with install steps and keyboard
  shortcuts, and a launch banner. No sign-up, no login, no forms.
- `table.html` — **the app.** All 118 elements floating in 3D. Spin them,
  search them, colour them by any of ten properties, sort them, filter them,
  and click one open for its Bohr model, orbital shapes, orbital diagram and
  data. Guest-only — there is no account system anywhere in the project.

## Files

```
index.html, table.html      pages
manifest.json, sw.js        PWA definition + service worker (stay at root — scope)
css/index.css, css/table.css
js/index.js                 landing page
js/elements-data.js         data for all 118 elements
js/icons.js                 SVG icon set (PT_ICONS)
js/core.js                  shared state, constants, colour helpers, legend
js/perf.js                  automatic performance mode (PT_PERF) + Effects menu logic
js/tiles-gl.js              the 118 element tiles, drawn in WebGL (PT_TILES)
js/scene.js                 camera, the four layouts, zoom, sort, the frame loop
js/controls.js              search, highlight filters, colour-by, themes, phone controls
js/atoms.js                 3D Bohr atom and 3D orbital shapes
js/detail.js                element card, tabs, keyboard, share links
js/starfield.js             background stars
js/sfx.js                   sounds
js/main.js                  start-up: runs init, then the frame loop, then the PWA setup
icons/                      icon-192.png, icon-512.png, icon-maskable-512.png,
                             apple-touch-icon.png, favicon.png, favicon.ico
```

`manifest.json` and `sw.js` have to stay at the root: a service worker's cache
scope defaults to the folder it's served from, so moving `sw.js` into a
subfolder would stop it controlling the pages at the root.

No build step, no npm, no dev server. The only outside code is three.js r128,
tween.js 18.6.4 and `OrbitControls.js`, loaded from a CDN inside `table.html`.

The `js/` files are plain scripts, not modules. They share one global scope and
`table.html` loads them in the order listed above, so that order matters: a
file can use anything defined in a file above it.

## How the tiles are drawn

The 118 tiles are flat WebGL rectangles, not HTML elements. One shader draws
the rounded card, border, glow, hover sheen and search pulse. All the text is
painted once onto a single image (a "text atlas") and each tile shows its own
piece of it. Because the browser no longer has to restyle 118 HTML nodes,
colour changes, filters and sorting can ease smoothly on every tile at once.

Each tile still has a real, invisible `<button>` (in `#tileProxies`) so the
keyboard and screen readers work exactly as before: Tab to a tile, arrow keys
to move, Enter to open.

## Effects menu (performance mode)

The **Effects** menu has three settings, remembered between visits:

- **Auto** (default): watches real frame times while the table is moving. If
  the device cannot keep up, it switches to Lite by itself and says so.
- **Full**: everything on.
- **Lite**: no aurora, grain or blur layers, lower pixel density, slower stars.

All motion is timed in seconds, not frames, so it runs at whatever rate the
screen offers: 60 FPS on a 60 Hz screen, 120 FPS on a 120 Hz screen.

## Bugs fixed in the original single-file version

Every changed line is commented `// CHANGED` in the `js/` files.

1. **"Atomic mass" colour mode did nothing.** `propRange()` kept only values
   where `typeof v === "number"`, but every mass is stored as a string
   (`"1.0080"`, `"[227]"`). A `numOf()` helper now parses numeric strings
   first. The mass range now reads `1.008` to `295.216`.
2. **Keyboard shortcuts leaked through open panels.** An `anyOverlayOpen()`
   helper blocks `1`–`4` and `R` while an overlay (the element detail panel,
   the mobile control sheet) is open.
3. **The mobile control sheet drifted out of sync.** The phone sheet clones
   the desktop colour and sort menus; the mirror now runs both directions for
   search, colour and sort.

## UI/UX + VFX pass on `table.html`

Additive only — nothing here touches the 3D layout itself, and every
animation is switched off under
`prefers-reduced-motion: reduce`.

- Real SVG icon set (`window.PT_ICONS`) instead of glyphs throughout the UI.
- An accent-tinted aurora behind the scene, fine film grain, card hover sheen,
  pulsing search hits, and a breathing halo on the active element panel.
- A squash-and-bounce reaction on selecting a card.
- Softer, rounder control bars/dropdowns/buttons, matching the landing page's
  claymorphism.
- Springy `Back.Out` easing on Table/Sphere/Helix/Grid view transitions.
- The landing page's pink/orange/yellow accent gradient reused for focus
  rings, active buttons and legend swatches — the dark base theme and the
  element category colours are untouched.
- Colour-by, highlight, search and sort changes ease on every tile, with a
  diagonal wave when the colour scheme changes. (The old idle "breathing" glow
  was removed: it was the main cause of lag.)

## Publish (GitHub Pages)

Step-by-step in `SETUP.md`.

## Install the app

- **Android (Chrome):** open the site → **⬇ Install app** (or ⋮ → Install app).
- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Desktop (Chrome/Edge):** install icon in the address bar.

Install needs HTTPS. Opening the file over `file://` will not install — that's
expected.

## Notes

- Keyboard in the table: `1–4` switch views · `R` reset view · `/` search.
- No accounts, no forms, no analytics. Nothing on either page is sent
  anywhere.
