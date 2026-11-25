# Portfolio site

An interactive, trippy-cartoon portfolio: a glowing cartoon of me in an endless painted panorama
(banded sunset, night and dawn skies, inked snowy mountain ranges, pine forests, a glowing river and
a mirror lake) that you explore by flying (hold the mouse or a finger down, arrow keys/WASD, or the
wheel). Down in the forest by the shore are three places to visit: Trolley Hospitality's office (my
work and its projects), James Madison University (what I studied) and a cabin (about me). Go inside
one to walk around it and look at what's there. The Contents button lists them and flies you there;
the Map button (or M) shows them on a map, and clicking one fast travels you straight to its door.
`BG.zoom` in `background.js` (0.6) sets how zoomed out everything is. The orb roams freely round the
screen and the view only pans when it nears an edge; the SH. mark flies it home. No build step.

Files: `index.html`, `styles.css`, `background.js`, `sun.js`, `town.js`, `office.js`, `places.js`, `map.js`, `flight.js`, `extras.js`, `joystick.js`, `zoom.js`, `plain-view.js`, `pointer-effects.js`, and the project pages in `projects/`.

## Project pages

- `projects/nightly-pipeline.html` - the written case study of the nightly pipeline project.
- `projects/pipeline-game.html` ("Run the night") - the same project as a six-level mini-game on the
  home page's painted panorama (it loads `../background.js` and `../styles.css`). Each level teaches one part
  and ends with a "What I did" card: the tangle of 46 jobs, catching downloads into bronze (canvas),
  cleaning raw fields into silver, writing a report class, a night run with a failed download and
  the next night's gap-filling, and spotting differences between old and new tables. The code is in
  `pipeline-game.js` (settings in `GAME`, level data in `SILVER_ROWS`, `CLASS_PARTS`, `NIGHT_CHOICES`
  and `SWITCH_ROUNDS`) and the look in `pipeline-game.css`. Every level can be skipped, and the
  route at the top jumps back to any level already reached. Keep its facts in step with
  `nightly-pipeline.html`.

## Fill in your content

All the words live in one hidden list in `index.html`: `<ul class="planet-list">` (it's still
called the planet list in the code). Each top-level `<li>` is a place in the world, and the items
marked `data-kind="moon"` after it are the things inside that place. Search for `[` to find every
placeholder.

- `data-tag` - the small label above the title (e.g. Pipelines, About).
- `data-icon` - for a place, which building it is (`company`, `university` or `about`; `town.js`
  draws them and `BG.clearings` in `background.js` says where they stand). For a thing inside, which
  station it gets in the room (`pipeline`, `migrate`, `diagnostics`, `docs`, `pos`, `outdoors`,
  `music`, `bar`, `contact`; anything else gets a plain desk; `office.js` draws them).
- `.planet-title` - the title, also shown in the labels and the Contents list.
- `.planet-text` - a short description (several make several paragraphs).
- `.planet-tools` - tools or skills, shown as chips (optional).
- `.planet-links` - links, shown as buttons (optional). Links starting with `http` open in a new tab.

Add or remove things inside a place by adding or removing its moon items (each room has slots for
four to seven, `slots` in `OFFICE.rooms`). Put a `resume.pdf` next to `index.html`, or remove that
link.

The list is invisible on screen but read by screen readers and search engines, and Tab moves through
it (Enter opens an item's panel). "Just show me the work" shows it as ordinary cards.

Keep work projects general: describe the problem, your approach and the outcome, not internal system
names or data.

## How it works

- `background.js` draws the background (settings in `BG`): a side-on painted panorama in the style
  of bold, ink-outlined landscape paintings, made from the world position so it never ends. From the
  top down: endless deep space, a banded sky with brush-stroke streaks, a big swirl and stars, two
  mountain ranges (flat lit and shaded faces running diagonally off each peak, snow caps with rock
  streaks, ink lines), forested hills of pines with a river winding down from the valley, a rocky
  shore, and a lake that mirrors the mountains and sky (so flying down never runs out either).
  Along it, a new scene with its own valley notch and river comes every `sceneWidth` px.
  The world loops: fly `dayWidth` landscape px sideways and you're back where you started, with the
  same mountains, forest, ribbons, stardust and places (every pattern in the painting is
  sized so a whole number of it fits one loop). Like the Earth, the loop has a day side and a night
  side, and the painting's colours change along it through one whole day: pastel dawn, warm sunset
  colours, moonlit night with pink alpenglow, with stronger colour round sunrise and sunset
  (`twilightFlush`, `twilightGlow`, `twilightSpan`, `nightDeepness`). The sun hangs over the middle
  of the day side and the moon over the middle of the night side, so at any moment some places see
  the sun and others the moon. From where you are, the one that's up shows overhead in the middle
  of its side and lower and further across the screen towards its horizon (`sunSwing`), setting as
  you fly away; round twilight both are up (`moonOverlap`). The whole pattern turns slowly by
  itself too (`dayDrift`). Both show only where there's open sky in front of them (with a column of
  light on the lake). Settings: `dayWidth`, `dayStart`, `dayShare` (share of the day the sun is
  up), `sunLow` and `sunHigh` (the landscape heights they rise from and climb to), `sunRadius`,
  `moonRadius`.
  Layout: `horizon`, `shoreLevel`, `sceneWidth`, `valleyWidth`, `farHeight`, `midHeight`,
  `hillHeight`, `treeSpacing`; colours: `paintColours`.
  High in the sky, swirling ribbons with stars streaming along them wind along evenly spaced levels
  of one smooth field, so they never cross (`riverSize`, `riverWidth`, `riverSpacing`, `riverFlow`);
  they taper out above the peaks (`ribbonCeiling`, `ribbonFade`) and are the currents in `extras.js`.
  The world gets a new layout with each `?swirls=` number. On top: the outlined rings and streamers
  and the breathing, melting warp; the sky sways and brightens like the northern lights (the
  `aurora...` settings) and glints drift over the water (`waterGlints`). Without WebGL a still
  tie-dye picture shows instead.
  - The page is only a window on the world: when the orb nears its edge, `flight.js` slides the
    world back underneath (`setBackgroundShift` and friends) and scrolls to match, and only the
    newly uncovered strip of landscape is drawn.
  - Soft glowing rays stream out of the orb (the `ray...` settings). Expanding rings and the swirl
    round the orb are switched off (`ringStrength: 0`, `vortexSpin: 0`); raise them to bring them back.
  - The centre point starts in the middle of the screen; a click on empty space moves it.
  - The ray directions get a new random layout on every visit. The layout number is printed in the
    browser console; open the page with `?swirls=12345` to see a layout again, or set
    `swirlSeed: 12345` in `BG` to keep one for good.
- `sun.js` draws the centre point as a full-body cartoon of me (curly hair, sunglasses, big grin,
  green flannel, brown trousers, green sandals; colours in `SUN.avatar`) in a warm glow (settings in
  `SUN`). It's still called the orb in the code. It also fills the labels and the details panels from
  the list. (The planets that used to orbit it are switched off with `SUN.showPlanets`: each is a
  place in the world now.) It measures its own speed every frame (`setAvatarMotion`), whatever moved it,
  and blends between poses (`AVATAR_POSES`): hovering and waving with a hiking stick when still,
  leaning in fist-first flying sideways, arms up going up, flailing with knees tucked coming down.
  It turns to face the way it's going, its hair blows in the wind, and speed lines trail behind it
  when it's fast (`moveFrom`, `moveFull`, `linesFrom` and friends). The orb glides wherever you click.
- `town.js` draws the places: a building for each top-level item, each in its own clearing in the
  forest just above the lake shore, a little way apart (`BG.clearings` in `background.js`: the
  company straight below where the orb starts, the university to the left, About me to the right).
  The company is a mountain lodge laid out like the real thing, left to right: a gravel lot of its
  box trucks, the timber garage they park in (one bay door rolling up and down), the timber and
  stone office lodge with a tall glass gable that glows, the log kitchen with a smoking stone
  chimney, the timber-frame barn of a warehouse with its loading docks (one of the trucks being
  loaded, a forklift shuttling pallets), and the gravel lot where suppliers' semis deliver, with
  lanterns, a fire pit, a grass yard, driveways and a road along the shore in front; the university is a brick college hall with a white columned porch, a
  cupola with a clock and purple and gold flags; About me is a log cabin with a smoking stone
  chimney, a porch lantern, flower boxes and a mailbox. The landscape itself leaves each clearing
  (no painted trees, a meadow floor with a ragged edge); the trees just in front of each building
  (`frontHalfWidth`, `clearingFrontDepth`) are drawn by `town.js` instead, over the building, so
  their tops show, with a path through them to the shore. Each is made to sit in the painting:
  drawn at the landscape's own resolution, in the same palette with flat lit and shaded faces, lit
  from the same side as the trees, hazed like them, with painted pines round its clearing; the
  windows glow at night. Hover a building for its label; click or tap it to go inside. Flying the
  orb over one pops up an invitation to go in (press Enter or E, or click or tap it;
  `promptReach`, `promptKeys`, `promptTouch`). Settings in `TOWN` (`size`, `haze`, and each place's
  sign, label, size and pines in `places`).
- `office.js` is the inside of each place: a top-down, tile-by-tile room where a small version of
  the cartoon walks around (arrow keys or WASD, or a d-pad and A button on touch screens). Each
  thing inside (the moons after the place's item in the list) has a station, and a board by the door
  introduces the place. Trolley Hospitality's office has stations themed on the group's businesses
  (a vending machine piping its sales into a tank, an old and a new micro-market fridge, a wall of
  screens, a shelf of binders, the restaurant counter's till), an espresso machine for the office
  coffee service and a toy trolley round the rug; the university's lecture room has a chalkboard,
  rows of desks, a globe and textbooks; the cabin has climbing and paddling gear, a guitar and a
  chess game, a cider bar, a writing desk and a fireplace. All are painted in the same style, with
  the light of the time of day outside. Face a station and press Space, Enter or A to read about it
  page by page in a text box, ending with its tools and links; stations you've read get a tick.
  Walk out of the door, press Escape or use the x button to leave. The world outside stops drawing
  while you're inside. Each room's look, layout, slots, props and intro lines are in
  `OFFICE.rooms`.
- `places.js` turns the Contents button into a list of the places, left to right: click one to fly
  to its door, or click a thing inside to open its panel straight away.
- `map.js` adds the Map button (and the M key): a map of the stretch of shore with the places, the
  sky coloured by the time of day along it, the sun over the day side and the moon over the night
  side, and where you are (an arrow at the edge if you're off it). Click or tap a place to fast
  travel there: a flash, and you're at its door (`setOrbTeleported` in `flight.js`). Settings in
  `MAP`.
- `extras.js` adds power-ups (settings in `EXTRAS`): the sky ribbons carry the orb along, keep it
  near their middle unless you're steering (`centring`, `wobble`), and make flying faster; stardust specks fill the stardust meter in the corner, and Space or the Boost
  button spends some for a burst of speed. All of it pauses while a panel is open.
- `flight.js` moves the orb instead of scrolling: hold to fly towards the pointer, a quick click
  dashes there, keys and the wheel nudge it, and the view pans only when the orb nears an edge or
  corner (`cameraEdge`; settings in `FLIGHT`).
- `pointer-effects.js` draws the soft line that follows the cursor (settings in `TRAIL`). A click also
  sends a gentle wave through the swirls (the `ripple...` settings in `BG`).

## Preview locally

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Publish on GitHub Pages

1. Create a public repo named `<your-username>.github.io` on GitHub.
2. Push these files to its `main` branch:

```bash
git init
git add .
git commit -m "Portfolio site"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
git push -u origin main
```

3. In the repo, go to **Settings → Pages** and set the source to **Deploy from a branch**, `main`, `/ (root)`.
4. After a minute the site is live at `https://<your-username>.github.io`.
