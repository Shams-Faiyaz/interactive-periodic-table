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

- `index.html`, `index.css`, `index.js` — landing page
- `table.html`, `table.css`, `table.js` — the 3D periodic table app
- `elements-data.js` — the data for all 118 elements, loaded before `table.js`
- `manifest.json` — PWA app definition (installing opens `table.html`)
- `sw.js` — service worker (offline cache + install)
- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
  `apple-touch-icon.png`, `favicon.png`, `favicon.ico` — icons

No build step, no npm, no dev server. The only outside code is three.js r128,
tween.js 18.6.4, `CSS3DRenderer.js` and `OrbitControls.js`, loaded from a CDN
inside `table.html`.

## Bugs fixed in the original single-file version

Every changed line is commented `// CHANGED` in `table.js`.

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

Additive only — nothing here touches the 3D transforms the CSS3D renderer
writes every frame, and every animation is switched off under
`prefers-reduced-motion: reduce`.

- Real SVG icon set (`window.PT_ICONS`) instead of glyphs throughout the UI.
- An accent-tinted aurora behind the scene, fine film grain, card hover sheen,
  pulsing search hits, and a breathing halo on the active element panel.
- A squash-and-bounce reaction on selecting a card (via a `.tile-inner`
  wrapper, so the animation doesn't fight the renderer's own transform).
- Softer, rounder control bars/dropdowns/buttons, matching the landing page's
  claymorphism.
- Springy `Back.Out` easing on Table/Sphere/Helix/Grid view transitions.
- The landing page's pink/orange/yellow accent gradient reused for focus
  rings, active buttons and legend swatches — the dark base theme and the
  element category colours are untouched.
- A slow idle "breathing" glow on cards at rest, paused on hover/match/tap.

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
