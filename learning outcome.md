# Learning outcome

Project: **Valence** — a landing page plus an interactive 3D periodic table that
installs like an app.

Repo: `https://github.com/Shams-Faiyaz/interactive-periodic-table`
Live: `https://shams-faiyaz.github.io/interactive-periodic-table/`
Folder on my machine: `~/Documents/interactive-periodic-table`
Written: 22 August 2026

---

## 1. What I built

Two pages that share one folder.

* `index.html` is the landing page. Soft clay style. Hero, about section, install
  guide, keyboard shortcut panel, launch section, footer.
* `table.html` is the actual app. All 118 elements floating in 3D. You can spin
  them, search them, colour them by any property, sort them, filter them, and
  click one open to see its Bohr model, its orbital shapes, its orbital diagram
  and its data.

It is a Progressive Web App, which means the browser can install it to a home
screen or a desktop and it keeps working with no internet after the first visit.
`manifest.json` describes the app and `sw.js` is the service worker that stores
the files for offline use.

There is no build step, no npm install and no dev server. I double click a file
and it opens. The only outside code is loaded from a CDN inside `table.html`:
three.js r128, tween.js 18.6.4, `CSS3DRenderer.js` and `OrbitControls.js`.

Rough size of what came out of it:

* `table.js` about 81 KB
* `elements-data.js` about 55 KB, which is the data for all 118 elements
* `table.css` about 44 KB
* `index.css` about 14 KB
* The first commit alone was 18 files and 3,219 lines.

---

## 2. Where the idea came from

The idea started as a picture in my head, not as a spec. I wanted the periodic
table to stop being a flat poster on a classroom wall. I wanted it to be a thing
you could grab and turn.

The About section on my own landing page is the shortest version of the reason I
started:

> "a developer who wanted to help students actually enjoy learning chemistry, so
> this free, interactive 3D periodic table got built. All 118 elements, their
> structures and trends, in one place."

Everything else grew out of that one image. If the table is a 3D object, then it
can also be a sphere. If it can be a sphere, it can be a helix, and a plain grid.
That is where the four views came from. If each card is a real object, then
clicking one should open the atom itself, so the Bohr model tab came next. If I
have real numbers for every element, then I can paint the whole table by any of
those numbers, which turned into the colour by menu with ten modes. And if I have
melting and boiling points, then a temperature slider can melt or boil a whole
period in front of you. That is the feature I am happiest with, because it is the
one you cannot do on paper.

I did not plan all of this on day one. Each feature came from asking "what does
this thing already make possible" about the feature before it.

---

## 3. How the idea turned into a plan

Three rules I set for myself before writing anything, and kept:

1. **Free and no sign up.** The hero stats on the landing page say it out loud:
   118 elements, 4 views, 0 sign ups, $0 forever. A student should be able to open
   it in a school computer lab with no account.
2. **One folder, no tooling.** Anything that needs npm, a build step or a dev
   server is a thing that can break later when I come back to it. So plain HTML,
   CSS and JavaScript, and libraries from a CDN.
3. **It has to work on a real phone.** Not "it resizes". Actually usable with a
   thumb.

---

## 4. How it actually got built, in order

The git history is the honest record. There are two commits so far.

**Commit `1f02c14`, 22 August 2026, 13:40. "Initial commit: Valence landing page
plus 3D periodic table PWA."**

Before this commit the whole thing lived as one giant single file. This commit is
where it became a real project. What happened in it:

* Split the single file pages into separate `html`, `css` and `js` files.
* Moved the About and Guide content out of the app and into proper landing page
  sections, so the app screen is just the app.
* Removed login and Firebase completely. This was the biggest call I made. The app
  had sign in wired up, and cutting it made the whole product simpler and matched
  rule number one.
* Added mobile touch polish and sound effects.
* 18 files, 3,219 lines added.

**Commit `cccb467`, same day, 15:53. "Add playful/smooth polish pass to the 3D
periodic table."**

Two hours and thirteen minutes later. This one was about making the app feel like
the landing page without wrecking the sci fi look of the table itself:

* A squash and bounce reaction when you select an element card. This needed a new
  `.tile-inner` wrapper, because the CSS3D renderer writes its own transform onto
  `.element` every single frame, so animating that element directly would fight
  the renderer. Wrapping it was the fix.
* Rounder, softer control bars, dropdowns and buttons.
* Springier easing on the Table, Sphere, Helix and Grid transitions using
  `TWEEN.Easing.Back.Out`, with the camera left on a gentler ease so it does not
  make you sick.
* The landing page pink, orange and yellow gradient reused as accent only on
  search focus, active buttons and legend swatches. The dark base theme and the
  category colours stayed untouched.
* A slow idle breathing glow on cards at rest, paused whenever a card is hovered,
  matched, dimmed or tapped.
* 123 lines added across `table.css` and `table.js`.

That commit carries the trailer `Co-Authored-By: Claude Sonnet 5`, so the record
of the collaboration is inside the repo itself.

---

## 5. Three real bugs I found and fixed

These are written up in `README.md` and every changed line in the code is marked
`// CHANGED` so I can find them again.

**Bug 1. The "Atomic mass" colour mode did nothing.**
`propRange()` only kept values where `typeof v === "number"`. Every atomic mass in
my data is stored as a string, like `"1.0080"` or `"[227]"` for the unstable ones.
So the function found zero numbers, the range came back as `[Infinity, -Infinity]`,
all 118 cards went flat grey, and the legend printed the words Infinity and
minus Infinity on screen. The fix was a `numOf()` helper that parses numeric
strings first. After the fix the mass range reads 1.008 to 295.216, and I checked
the other seven colour modes still behaved.

This one taught me the most. The bug was not in the colour code at all. It was a
type mismatch between how I stored the data and how I read it, two files apart.

**Bug 2. Keyboard shortcuts leaked through the panels.**
With the Guide or About panel open, pressing `1` to `4` still switched the 3D view
behind it and `R` still reset the camera. Fixed with an `anyOverlayOpen()` helper
that blocks shortcuts while either overlay is showing.

**Bug 3. The mobile control sheet drifted out of sync.**
The phone sheet clones the desktop colour and sort menus, but the copying only ran
one way. Changing sort from the desktop path also rewrites the colour menu, which
left the phone sheet showing a stale value. The mirror now runs in both directions
for search, colour and sort.

---

## 6. How I used Claude Code

Claude Code is the terminal tool. It sits in the project folder, reads and edits
the real files, and runs commands. This is what it was for:

* **The heavy refactor.** Splitting one enormous file into `index.html`,
  `index.css`, `index.js`, `table.html`, `table.css`, `table.js` and
  `elements-data.js` is exactly the kind of job that is boring and easy to get
  wrong by hand. It touched every file at once and kept everything working.
* **Debugging by tracing, not by guessing.** The atomic mass bug needed someone to
  follow the value from `elements-data.js` into `propRange()` and notice the type
  was wrong. That is a read the whole chain job.
* **Git, which I do not know.** I did not want to learn Git to ship this. Claude
  Code ran `git init`, staged, committed with real messages that explain the why
  and not just the what, added the remote and pushed to
  `Shams-Faiyaz/interactive-periodic-table`.
* **The local preview.** `.claude/launch.json` sets up a `valence-static` config
  that runs `python3 -m http.server 8123`, because the service worker and the
  install prompt will not work over `file://` and need a real server.
* **Writing the docs as we went.** `README.md` and `SETUP.md` were written during
  the work, not after it. That matters, because my sessions get cut off and a
  written file survives when a session does not.
* **Marking its own edits.** Every line it changed in a bug fix got a `// CHANGED`
  comment, so I can audit what it touched without reading the diff.

The rule I held it to the whole time was fix my code, do not replace it. Keep my
structure and my variable names, change the minimum. The polish commit is a good
example. It is additive only, it does not touch the 3D transforms the renderer
writes each frame, and every animation is switched off under
`prefers-reduced-motion: reduce`.

## 7. How I used Claude in the desktop app

The desktop app was for the thinking half rather than the typing half:

* Talking through the shape of the product before any code. What the landing page
  should say, what belongs on the app screen and what does not, whether login was
  worth keeping.
* Wording. The hero line "Learn all 118 elements by playing with them", the four
  hero stats, and the promise that it stays free and open source.
* The deployment walkthrough, one numbered step at a time, waiting for me to
  confirm each one before the next. That whole sequence is now `SETUP.md`, seven
  steps from "double click index.html" to "test on a real phone", so if a session
  dies I can finish it myself.
* The device to device checks. `SETUP.md` step 6 is a real test list for a phone:
  nav bar does not overflow, the big element tile cycles Na, O, Au, He, Cl, Fe,
  the filters switch cards, ticks survive a reload, the blank name error shows,
  the 3D table loads and drags.

The split that worked: the desktop app for deciding what to build, Claude Code for
building it in the actual folder.

---

## 8. What I actually learned

**Technical**

* Why a wrapper element exists. You cannot animate a node that a renderer rewrites
  every frame. You wrap it and animate the wrapper.
* Data type discipline. Storing numbers as strings cost me a whole feature that
  looked fine until someone selected it.
* What a service worker really does, and why a network first strategy for HTML
  stops a changed page getting stuck on an old cached copy. Also that changing
  `sw.js` means bumping the `CACHE` name, `periodic-3d-v7` to `periodic-3d-v8`,
  or old caches never clear.
* That a PWA install needs HTTPS, so `file://` will never install and that is
  expected behaviour, not a bug.
* That a Firebase web API key is public by design, and the real protection is
  restricting it by website and by API in the Google Cloud console.
* Accessibility is not a bolt on. Every animation in the polish pass is gated
  behind `prefers-reduced-motion`, and the controls carry `aria-label` and
  `role` attributes.

**About building things**

* Cutting a feature can be the best commit. Removing Firebase login made the
  product better.
* Two commits and about two hours separated a working thing from a thing that
  feels good. The second half is not optional.
* Write the setup file while you still remember the steps.
* Mobile is a second full round of work, not a resize.

**About working with AI**

* It is much better at "here is my file, this specific thing is broken" than at
  "build me an app". The three bug fixes are precise because the symptoms were
  precise.
* Making it explain the fix before writing the code is what turned this into
  learning instead of copy and paste.
* Making it mark its own edits with `// CHANGED` keeps me in control of my own
  codebase.

---

## 9. What is real and what is sample

Real: every bit of element data in the table. All 118 elements, their categories,
masses, melting and boiling points, radii, ionization energies and electron
affinities.

The course catalogue, student reviews, progress tracker and enrolment form from
the earliest draft of the landing page are gone entirely, not just marked as
sample. The landing page now only carries the hero, the About section and the
Guide section, all of it real. There is nothing on either page that is
placeholder content, and nothing that sends data anywhere.

---

## 10. Where it stands

The product is live and matches the three rules from section 3. Free, no
sign-up, one folder with no build tooling, and usable on a real phone screen —
the mobile pass tightened tap targets and camera framing on narrow viewports
and confirmed touch drag/pinch on the 3D view.

The open-source, free-forever line in the About section is a standing
condition on the project, not a task: anyone reusing the code keeps it
open and free, the same way.

---

## Notes on this document

Everything above is taken from the files and the git history in this folder.
The "where the idea came from" story in section 2 and the split of work in
section 7 between the desktop app and Claude Code are written from my side of
it, not pulled from the repo.
