# Valence — landing page + Interactive Periodic Table (installable PWA)

Two pages that share one set of files.

- `index.html` — **the landing page.** Playful claymorphism design: hero, course
  catalogue with working filters, a clickable progress tracker, student reviews
  and an enrolment form.
- `table.html` — **the app.** The 3D periodic table you already had, with all 118
  elements, Bohr models, orbital shapes, trend heatmaps and phase colouring.
  This is the old `index.html`, renamed, with three bugs fixed (see below).

## Files (upload ALL of them to the repo root — keep them side by side)

- `index.html` — landing page
- `table.html` — the 3D periodic table app
- `manifest.json` — PWA app definition (installing opens `table.html`)
- `sw.js` — service worker (offline + install)
- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`,
  `favicon.png`, `favicon.ico` — icons

No build step, no npm, no dev server. Double-click `index.html` to look at it.
Installing the app needs a real HTTPS address, so use GitHub Pages for that.

## Bugs fixed in `table.html`

Every changed line is commented `// CHANGED` in the file.

1. **"Atomic mass" colour mode did nothing.** `propRange()` kept only values where
   `typeof v === "number"`, but every mass is stored as a string (`"1.0080"`,
   `"[227]"`). So the range came back as `[Infinity, -Infinity]`, all 118 cards
   went flat grey, and the legend printed `Infinity` and `-Infinity`.
   A new `numOf()` helper parses numeric strings first. Verified: the mass range
   is now `1.008` to `295.216`, and the other seven colour modes are unchanged.
2. **Keyboard shortcuts leaked through the Guide/About panel.** With that panel
   open, pressing `1`–`4` still switched the 3D view behind it and `R` still reset
   the camera. A new `anyOverlayOpen()` helper blocks shortcuts while either
   overlay is showing.
3. **The mobile control sheet drifted out of sync.** The phone sheet clones the
   desktop colour and sort menus, but the copy was only ever updated in one
   direction. Changing sort from the desktop path (which also rewrites the colour
   menu) left the phone sheet showing the wrong value. The mirror now runs both
   ways, for search, colour and sort.

## UI/UX + VFX pass on `table.html`

Additive only. Nothing here touches the 3D transforms the CSS3D renderer writes
every frame, and every added animation is switched off under
`prefers-reduced-motion: reduce`.

**Real SVGs instead of glyphs.** One shared icon set (`window.PT_ICONS`, defined at
the top of `<body>`) now fills the reset, install, zoom in/out, close, previous,
next, share, play/pause, sort direction, highlight, options, clear and
step-inside-the-sphere buttons. The search fields get a magnifier baked in as a
background image, so their markup is untouched. The title gets an animated atom
mark with two counter-rotating electron shells.

Three buttons rewrite their own contents in JavaScript, so those three lines were
changed to keep the SVG: `sortDir` now flips a CSS class and swaps only its label,
`setSphereBtn()` writes icon plus label, and the Bohr pause button swaps play for
pause. All marked `// CHANGED`.

**Effects.** An accent-tinted aurora that drifts behind the scene and re-tints
itself whenever you change theme. Fine film grain so the background gradients stop
banding. A light sheen that sweeps across an element card on hover, with the
category bar shimmering while you hover. Search hits pulse instead of sitting
still. Active view buttons and chips carry a slow accent ring. The install button
has a sweep. In the element panel the active tab draws a sliding gradient
underline and the big symbol sits in a breathing halo.

**Everyday polish.** Glass and blur on the control bars, a 2px lift on hover with
an accent-tinted shadow, legend swatches that grow and glow, and a pip on the toast.

## What is real and what is sample content

Real: all element data in `table.html`.

Sample, swap it before you publish: the course names, lesson counts and durations,
the three student reviews, and the day-streak number in the progress tracker.
The enrolment form is front-end only and does not send anywhere.

## Publish (GitHub Pages)

Step-by-step in `SETUP.md`.

## Firebase sign-in (optional — guest mode always works)

Config is already in `table.html`. To turn on real sign-in:

1. Firebase Console → **Authentication → Sign-in method** → enable **Email/Password**.
2. Firebase Console → **Authentication → Settings → Authorized domains** → add your
   live domain (e.g. `<username>.github.io`).

## Secure the API key (do this — the key is public by design, so lock it down)

Google Cloud Console → **APIs & Services → Credentials** → the browser key:

- **Application restrictions → Websites**: add `<username>.github.io/*` and `localhost/*`
- **API restrictions → Restrict key**: Identity Toolkit API (+ Token Service API)

A Firebase web API key is safe to ship publicly. Restricting it stops others reusing
it on their own sites. GitHub's secret-scanning alert can be dismissed once restricted.

## Install the app

- **Android (Chrome):** open the site → **⬇ Install app** (or ⋮ → Install app).
- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Desktop (Chrome/Edge):** install icon in the address bar.

Install needs HTTPS. Opening the file over `file://` will not install — that's expected.

## Notes

- Keyboard in the table: `1–4` switch views · `R` reset view · `/` search.
- Progress ticks on the landing page are stored in that browser only. There is no account.
