# SETUP — get Valence online

One step per section. Do them in order. Nothing here needs Git on your computer.

## Before you start

Have all of these files in one folder, side by side:

`index.html` · `table.html` · `manifest.json` · `sw.js` · `icon-192.png` ·
`icon-512.png` · `icon-maskable-512.png` · `apple-touch-icon.png` ·
`favicon.png` · `favicon.ico` · `README.md` · `SETUP.md`

## Step 1 — look at it locally

Double-click `index.html`. It opens in your browser.

Two things will not work over `file://`, and that is normal: the app cannot install,
and it will not cache for offline. Everything else works.

## Step 2 — make a GitHub repo

1. Go to github.com and sign in.
2. Top right **+** → **New repository**.
3. Name it (for example `valence`). Set it **Public**. Do not tick "Add a README".
4. **Create repository**.

## Step 3 — upload the files

1. On the new empty repo page, click **uploading an existing file**.
2. Drag in every file from the list in "Before you start". All of them, at once.
3. Scroll down → **Commit changes**.

## Step 4 — turn on GitHub Pages

1. In the repo, click **Settings**.
2. Left sidebar → **Pages**.
3. **Source**: *Deploy from a branch*.
4. **Branch**: `main`, folder `/ (root)` → **Save**.

## Step 5 — open the live site

Wait about a minute, then open:

`https://<your-username>.github.io/<repo-name>/`

The landing page loads first. The **Open the 3D table** button goes to `table.html`.

## Step 6 — test on a real phone

Open the live address on your phone and check each of these:

- Nav bar fits, nothing overflows sideways
- The big element tile cycles through Na, O, Au, He, Cl, Fe
- Course filter buttons switch the six cards
- Tapping a lesson ticks it, and the electrons appear on the shell rings
- Reload the page: your ticks are still there
- Enrolment form: submitting with a blank name shows the red error
- **Open the 3D table** → the table loads and you can drag to rotate
- In the table: **⬇ Install app** appears, or on iPhone Share → Add to Home Screen

## Step 7 — updating later

Upload the changed file again and commit. The service worker fetches HTML from the
network first, so a changed page shows up straight away rather than staying stuck
on an old cached copy.

If you ever change `sw.js` itself, bump the `CACHE` name at the top
(`periodic-3d-v7` → `periodic-3d-v8`) so old caches get cleared.

## Optional — make the enrolment form real

The form in `index.html` validates and shows a success panel, but sends nothing.
To make it send, use a free no-backend form service (Formspree and Web3Forms both
have free tiers, no card). Give the `<form id="enrolForm">` an `action` and
`method="POST"`, and remove the `ev.preventDefault()` line in the submit handler.
