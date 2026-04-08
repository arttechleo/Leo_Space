# Changelog

## 2026-04-08

- Resume (`contact.html`): add dark-mode overrides and a slide-in "View Interactive Resume" Figma prototype CTA near the hero heading.
- Resume (`contact.html`): replace CTA with embedded first-slide Figma prototype hero frame on black background.
- Resume (`contact.html`): swap Figma embed for local static hero image from first slide and force pure white hero/footer typography (no gray).
- Resume (`contact.html`): expand Figma embed to 90vw hero, restyle metric cards as dark panels with white numbers, and enlarge resume/bento preview selectors.
- Resume (`contact.html`): make Figma embed full viewport width with edge-to-edge wrapper and 90vh iframe height.
- Resume (`contact.html`): remove proto-section side padding/max-width constraints and enforce full-bleed iframe container with no internal spacing.
- Resume (`contact.html`): switch to embedded Figma URL with `hide-ui=1` and apply scaled full-bleed 85vh iframe treatment with 600px minimum height.
- About: adjust splat orientation, landscape canvas sizing, and scroll-driven camera push.
- About: switch to full-width splat hero layout with bottom fade, corrected forward-facing rotation, and closer camera framing.
- About: clamp horizontal splat rotation to a 240-degree range for both auto-rotation and drag input.
- About: start splat Y rotation at 60deg, auto-rotate to 180deg, and clamp drag between -20deg and 200deg.
- About: shift rotation window +45deg and update scroll camera fly-in with capped 600px progression, right drift, and dynamic look-at.
- About: use looping +/-20deg auto-swing around 135deg and disable auto-rotation after first scroll or drag interaction.
- About: shift looping splat rotation center to 240deg while keeping a +/-20deg swing.
- About: invert looping rotation center to 60deg and widen swing to +/-45deg.
- About: center looping rotation at 180deg with tighter +/-25deg swing and slower cinematic auto-rotation speed.

## 2026-04-03

- Site-wide Vision Pro / spatial-computing pass: single background `#f2f2f2` via `:root` tokens; SF Pro system stack on `html`/`body` and interior pages; index nav, canvas band (`60px` top offset), flanking columns, hero word land/scatter, short-style project cards with odd-`nth-child` alternation (scroll-progress outside `#scroll-content`), progress dots, zoom flash, canvas zoom vignette; `app.js` initializes Three only on `body.index-page`, rebuilds empty `#scroll-progress` with landing dot + 12.
- `contact.html`: hiring-focused resume page with metric grid (resume-sourced figures), ASU / capstone copy, Vision Pro–aligned “looking for,” mail + LinkedIn + GitHub + spatialme.xyz; removed printer UI and `contact-style.css`.
- `about.html` / `research.html`: `main` + `page-label`, quantified narrative (SCG, Article, Volumetrics, Nanome, SIGGRAPH, SFU, ASU, publications); no placeholder “work in progress.”

- About: switch Spark `SplatMesh` to compressed PLY for faster loads.

- Index: unified `#EBEBEB` page background (radial on `body.index-page`, scroll column, landing, project sections, canvas bottom fade); transparent canvas; project sections use `PROJECT_DISPLAY` with YouTube or local MP4, description, tags, CTA (no full-page fetch). Overview camera forced to `(0,1.5,12)` / lookAt `(0,1.5,0)`, FOV 52, `storeOverviewState` synced; `updateCanvasSize` sets FOV.
- Index hero title matches comp copy **Hello,I am Leo** (no space after comma): single first span `Hello,I`, then `am` / `Leo` with word gaps; three-word stagger + exit.
- Index landing: hero anchored bottom-left (`flex-end` + `align-self` on title), scroll hint stays centered; hero words use `margin-left` gaps between separate spans.
- Index cinematic layer: page/nav/column/word load animations, scroll-hint breathe + line, `zoom-flash` + canvas vignette during camera moves, `animateCameraEpic` / `animateCameraArc` (overview↔project vs project↔project), GLTF model rise-in on load; `prefers-reduced-motion` scoped to index.
- Index “doom scroll”: document scroll below a fixed 62vh canvas band; `#scroll-content` with landing + 12 `.project-section`s; project `IntersectionObserver` uses `rootMargin: -60vh` / landing `threshold: 0.25` for overview return. `PROJECT_ZOOMS` from `buildProjectZooms()` + `monitorPositions[]` (placeholders — replace via `logAllMonitorPositions()`). Arc transition between projects; epic from overview; hero/hint fade on any project; `.visible` cleared on landing. Fixed `#scroll-progress` dots; `#scroll-content` / `.scroll-section` + `html` scroll-snap proximity. Console: `logAllMonitorPositions`, `testZoom(x,y,z,standoff)`. Preloads each `projectN.html` into section inners with headers. `project-style.css` linked on index for injected markup.
- Index polish: monumental hero title (bottom bleed), radial page background, refined nav metrics, column copy/borders/vertical alignment, `.ground-shadow` under the 3D subject, higher z-index for UI/tooltips.
- Rebuilt the index page layout: centered nav pill, full-viewport canvas, fixed left/right spatial copy columns (Mixed Reality / Gaussian Splatting), bottom-left hero title; no footer or hint markup on the page. Kept `#three-canvas` inside `#canvas-container` for `app.js`.
- Added a short-lived “hover to explore” pill over the index Three.js canvas (`#hover-hint`), with pulse animation and auto-dismiss after 4s or on first pointer interaction over the canvas.
