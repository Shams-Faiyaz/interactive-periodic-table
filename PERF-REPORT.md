# PERF-REPORT — interactive-periodic-table

Working folder: `~/Documents/periodic table final` (fresh clone of GitHub `main` @ `71bab7b`, 23 Aug 2026)
Live: https://interactive-periodic-table-chi.vercel.app/

## Progress
- [x] Step 0 — find latest version (done 17 Nov 2026)
- [x] Step 1 — measure baseline (done)
- [x] Step 2 — hunt causes (3 Opus workers reported)
- [x] Step 3 — fix (applied, measured)
- [x] Step 4 — verify (round 1 failed on one old bug, fixed, round 2 passed)
- [ ] Step 5 — commit, push, confirm deploy

## Step 0 — copies found

**Chosen: GitHub `main` @ `71bab7b`.** The live Vercel site is byte-identical to it (all 9 served files compared). No local copy has newer site code.

| Path | Last modified | Size | Difference from GitHub |
|---|---|---|---|
| **GitHub `main` (71bab7b)** = live Vercel site | 23 Aug 2026 | 385 KB | **NEWEST. Chosen.** |
| ~/Documents/claude-code/interactive-periodic-table | 23 Aug 2026 | 401 KB | Same commit. Uncommitted: edits to `learning outcome.md`, a `.gitignore`, empty `typespeed/`, `.vercel/` link. Site code identical. |
| ~/Documents/stem-visualiser-suite/reference/interactive-periodic-table | 30 Aug (copy date) | 398 KB | Identical clone, clean. |
| ~/Documents/study-antigravity-v1/chemistry/periodic-table (and identical twin in ~/Documents/cladu guiding system/…) | 30 Aug 2026 | 399 KB | Embed copy for the STEM suite. `index.html` is `table.html` plus a "← STEM Suite" back button. JS and CSS identical. Not a newer version. |
| ~/Documents/study-visulizing-antigravity/periodic table | 30 Aug (copy date) | 408 KB | Old single-file version (209 KB index.html, still has Firebase login). Older. |
| ~/Documents/codes/vsc/personal/projects-myself-can-be-released-ig/periodic-table-pwa (+ "pwa 2", .zip) | 18 Jul 2026 | 354 KB | Old single-file PWA. Older. |
| ~/Documents/codes/vsc/personal/periodic-table-3d, ~/Documents/periodic-table-3d.zip | 18 Jul 2026 | 1.5 MB | Old React/Vite prototype. Different project shape. Older. |
| ~/Downloads/valence-periodic-table, valence-periodic-table_1 (+ zips) | 14 Aug 2026 | ~410 KB | Flat pre-reorganise layout. Older, stale. |
| ~/Downloads/periodic-table-pwa (+ zip) | 18 Jul 2026 | 354 KB | Old single-file PWA. Stale. |
| ~/Downloads/periodic-table-3d, "3d 2", "3d (1)", "3d (2)" (+ zips) | 17–18 Jul 2026 | ~300 KB each | Old React/Vite prototypes. Stale. |
| ~/Downloads/periodic table, ~/Downloads/local_0b6ffbb3…/outputs | 17 Jul 2026 | ~655 KB | Earliest patched single-file builds. Stale. |
| ~/Downloads/Interactive Periodic Table · Learn Chemistry in 3D.html (+ _files) | 15 Aug 2026 | 279 KB | Browser "Save page" of the old Firebase version. Stale. |
| ~/Documents/periodic table final | 17 Nov 2026 | empty | Was empty. Now the working folder. |

Note: the uncommitted `learning outcome.md` edits in `~/Documents/claude-code/…` are docs only and are not in this clone. Nothing there was touched.

## Step 1 — baseline (live site, before any fix)

How measured: headless Brave (Chromium), 1440x900 at 2x pixel ratio, script in the session scratchpad (`measure.mjs`, puppeteer-core, not part of the site). "4x CPU" simulates a slow laptop or phone. FPS is from requestAnimationFrame. "Style+layout" is main-thread milliseconds spent per second of wall time.

| Phase | FPS (normal CPU) | FPS (4x slower CPU) | Main thread busy (4x) | Style+layout ms/s (normal / 4x) |
|---|---|---|---|---|
| Idle, nothing moving | 26.2 | 15.1 | 95% | 98 / 555 |
| Hovering tiles | 24.0 | 18.0 | 91% | 111 / 496 |
| Scroll-panning | 31.2 | 14.3 | 100% | 143 / 589 |
| Typing in search | 41.6 | 48.0 | 79% | 40 / 205 |
| Switching table ↔ sphere | 26.8 | 15.6 | 100% | 193 / 572 |
| Detail card open (Au) | 24.0 | 14.5 | 88% | 135 / 423 |

- Long tasks over 50 ms: 4 in a 30 s run on normal CPU (170, 204, 50, 223 ms). On 4x CPU: about 330, nearly every frame.
- Total blocking time: 120 ms at load, 447 ms over the run (normal CPU). 1,113 ms at load and 5,931 ms over the run (4x CPU).
- Layout shift (CLS): 0.036.
- 244 CSS animations running at idle. 1,500 DOM nodes.

Reading it: the page is slowest when nothing is happening. Typing in search is *faster* than idle because dimmed tiles pause their "breathing" animation. That points straight at the idle animation on all 118 tiles.

## Step 2 — causes found (ranked)

1. **Idle "breathing" on all 118 tiles** (css/table.css ~689-707). Animates `box-shadow`, which forces style recalculation and repaint of every tile every frame, forever. Biggest cause.
2. **Starfield canvas** (js/table.js ~1082-1148). Full-screen 2x canvas, 5 screen-sized gradients plus ~300 stars redrawn every frame, never pauses under the detail card or in a hidden tab.
3. **Main loop renders every frame** (js/table.js 741) even when nothing moves and behind the open card, plus extra synchronous renders on every wheel event.
4. **Full-screen blur behind the detail card** (`#overlay` backdrop-filter) on top of animated layers, plus ~10 other `backdrop-filter` panels and one per toolbar button.
5. **`#fxAurora`**: 150%-of-screen layer with `filter:blur(70px)`, animated with scale. **`#fxGrain`**: full-screen `mix-blend-mode` layer animating `background-position`.
6. **`filter` transitions on dim/match** when searching or filtering; `.match` pulses an 84px box-shadow forever.
7. **WebGL atom views use uncapped pixel ratio**; one geometry and material per electron.
8. Unthrottled resize, temperature slider recolouring 118 tiles per event, forced layouts in the caption observer.
9. `#installBtn::after` animates `left`; `transition: all` shorthand on toolbar buttons; reduced-motion rule overridden later in the file.
10. Service worker serves css/js cache-first under `periodic-3d-v10`. **Must bump to v11** or returning visitors keep the slow files. CDN scripts not deferred.

## Step 3 — fixes applied

Measured after each round on the local copy (same method as the baseline).

| # | File | Fix | Result |
|---|---|---|---|
| 1 | css/table.css | Removed the `box-shadow` half of the idle "breathing" animation on all 118 tiles (the static glow and the gentle scale stay). | Idle 26 → 59 FPS. Biggest single win. |
| 2 | js/table.js | Main loop now renders on demand: only while a tween runs, the camera moves, or something changed. Nothing is rendered behind the open detail card. Wheel, zoom, search and filter no longer force extra renders. | Script time at idle down about 10x. |
| 3 | js/table.js | Starfield: about 30 FPS instead of 60 (speeds doubled so it looks the same), fully paused in a hidden tab and under the detail card, pixel ratio capped at 1.5, resize debounced. | Part of the script-time drop. |
| 4 | js/table.js + css/table.css | `body.detail-open` and `body.fx-busy` pause the ambient CSS animations while the card is open or the scene is moving. | Detail card 24 → 60 FPS (14 → 60 on 4x CPU). |
| 5 | css/table.css | No more `filter` transition on tiles when searching or filtering. Search-hit pulse runs 3 times, not forever. | Smoother search. |
| 6 | css/table.css | Grain layer animates `transform`, not `background-position`. Aurora drift no longer scales a 70px-blurred layer. Install-button sweep animates `transform`, not `left`. Removed the per-button `backdrop-filter` (the bar behind already blurs). `transition:.18s` (= all) replaced by named properties. | Less repaint and fewer blur layers. |
| 7 | js/table.js | Atom views: pixel ratio capped at 2, one shared geometry and material for all electrons. Temperature slider, caption observer and window resize batched to once per frame. Recolour skips tiles whose colour did not change. | Cheaper detail card and sliders. |
| 8 | css/table.css | Reduced motion: tile transitions and the breathing/tap animations are now really off (an earlier rule was being overridden). | Respects the OS setting. |
| 9 | sw.js | Cache name `periodic-3d-v10` → `v11` so returning visitors get the new files. Same-origin assets are now true stale-while-revalidate. Pinned CDN libraries are cache-first. | Faster repeat loads, fix reaches users. |
| 10 | table.html | `defer` on the four CDN scripts. | Parser no longer blocked by three.js. |
| 11 | js/index.js, css/index.css | Landing page: hero timer skips hidden tabs, nav blur 14px → 8px, fixed background moved to a composited `body::before`. | Smoother landing-page scroll. |

One slip caught and fixed during this step: a trailing comment swallowed the line that starts the starfield, so the stars vanished. Found by before/after screenshot comparison, fixed, re-checked.

### Before and after

Desktop 1440x900:

| Phase | FPS before | FPS after | FPS before (4x CPU) | FPS after (4x CPU) |
|---|---|---|---|---|
| Idle | 26.2 | 60.1 | 15.1 | 60.2 |
| Hovering tiles | 24.0 | 60.1 | 18.0 | 60.0 |
| Scroll-panning | 31.2 | 60.1 | 14.3 | 60.0 |
| Typing in search | 41.6 | 60.1 | 48.0 | 56.7 |
| Switching table ↔ sphere | 26.8 | 56.3 | 15.6 | 32.6 |
| Detail card open | 24.0 | 60.1 | 14.5 | 60.1 |

| Metric | Before | After |
|---|---|---|
| Total blocking time, whole run, normal CPU | 447 ms | 89 ms |
| Total blocking time, whole run, 4x CPU | 5,931 ms | 360 ms |
| Blocking time at load, normal CPU | 120 ms | 0 ms |
| Long tasks over 50 ms, normal CPU / 4x CPU | 4 / about 330 | 1 / 23 |
| Layout shift (CLS) | 0.036 | 0.034 |
| Running CSS animations at idle | 244 | 126 |

Mobile 390x844, 4x CPU: idle 23 → 60 FPS, panning 20 → 60, detail card 14 → 60, blocking time 1,260 → 103 ms, long tasks 102 → 4.

### Not fixed, on purpose

- **Layout switch on a slow CPU is still about 33 FPS** (was 16). Every frame of a switch moves 118 real DOM tiles in 3D, and the browser must restyle each one. That is how the CSS3D design works. Fixing it properly means drawing tiles in WebGL, which is a redesign.
- **The tile "breathing" scale animation still costs about 20% of one CPU core at idle** (FPS stays at 60). It is kept because it is part of the look. To remove it, delete the `.element .tile-inner{ animation:fxBreatheScale ...}` line in css/table.css.
- Heavy static tile styling (3-layer shadows, text glows) and the remaining panel blurs are unchanged, to keep the look.
- Not changed: font weights, icon sizes, landing-page design.
- Seen but left alone (not performance): "Step inside the sphere" button shows in table view on first load; a stray `</style>` at the end of css/table.css.

## Step 4 — verify

**Round 1 (fresh Opus worker, black box): FAIL on one functional check, PASS on every performance threshold.**

- Performance, its own measurements: desktop 60 FPS idle / hover / pan / card open, 58 in layout switch; on 4x CPU 60 / 60 / 60 / 60 and 35 in switch. Blocking time over the run 76 ms (305 ms at 4x CPU). Mobile 4x CPU 60 FPS idle and card open. No console errors or warnings in any run.
- Passed: all four card tabs on H, C, Fe, Au, U, Og with both 3D canvases drawing; every view, sort, colour, filter, theme, legend, zoom and keyboard control; starfield drawing; mobile 390px (no sideways scroll, tap opens card, tabs work); landing page; reduced motion (0 animations at rest).
- **Failed: 114 of 118 tiles clickable.** The "Step inside the sphere" button showed in table view on first load and sat on top of Np, Pu, Am and Cm. This bug is on the old live site too (visible in the "before" screenshot). A later CSS rule overrode its `display:none`.
- Minor: the zoom slider did not follow the real zoom after Reset.

**Fix applied (js/table.js):** the sphere button is hidden at start-up, and the zoom slider re-syncs when the camera settles. My re-check: 118 of 118 tiles open the right card, the button shows only in sphere view, the slider goes 76 → 81 → 85 → back to 76 after Reset, no console errors.

**Round 2 (second fresh Opus worker, black box): PASS.** 118 of 118 tiles open the right card. Sphere button shows only in sphere view. Zoom slider follows zoom and reset. All views, filters, sorts, colours, themes, card tabs, mobile 390px, landing page and reduced motion pass. 0 page errors, 0 console errors or warnings, 0 failed requests. Performance: 60 FPS idle / hover / pan / card open and 58 in layout switch; on 4x CPU 60 / 60 / 60 / 60 and 34 in switch. Blocking time 79 ms over the run (295 ms at 4x CPU). CLS 0.052.

Things the verifier noted that are NOT fixed (they are design or layout matters, the same on the old site, and outside this performance job):
- On a 390px phone the table does not fit the screen at first load. Groups 1 and 18 start off-screen until you pan or pinch.
- On mobile the install button overlaps the right end of the search box.
- In grid view (f-block) the Lu tile sits partly behind the zoom control.
- The detail card still fades out briefly with reduced motion on.
