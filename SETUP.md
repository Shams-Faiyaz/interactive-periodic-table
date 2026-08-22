# SETUP — Valence, deployed

The project is live on GitHub Pages, deployed straight from the `main`
branch of `github.com/Shams-Faiyaz/interactive-periodic-table`.

## Local preview

Double-clicking `index.html` opens it in a browser, but two things need a
real HTTP server instead of `file://`: installing the app, and the service
worker caching it for offline use. `.claude/launch.json` defines a
`valence-static` config that runs `python3 -m http.server 8123` for that.

## Publishing an update

Push to `main`. GitHub Pages redeploys automatically — no manual upload step.

The service worker fetches HTML network-first, so a changed page shows up
immediately rather than staying stuck on an old cached copy. If `sw.js`
itself changes, bump the `CACHE` name at the top of the file so old caches on
returning visitors' devices get cleared.

## Install the app

- **Android (Chrome):** open the live site → **⬇ Install app** (or ⋮ → Install app).
- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Desktop (Chrome/Edge):** install icon in the address bar.
