# Portfolio site

An interactive, trippy-cartoon portfolio: a glowing cartoon of me with project icons circling it, in an endless
painted panorama (banded sunset, night and dawn skies, inked snowy mountain ranges, pine forests, a
glowing river and a mirror lake) that you explore by flying the orb (hold the mouse or a finger down, arrow keys/WASD, or the wheel). Each
planet opens one item (a project, About, or Contact). `BG.zoom` in `background.js` (0.6) sets how zoomed out everything is. The orb roams freely round the screen and the view only pans when it nears an edge; the SH. mark flies it
home. No build step.

Files: `index.html`, `styles.css`, `background.js`, `sun.js`, `hunt.js`, `flight.js`, `extras.js`, `plain-view.js`, `pointer-effects.js`, and the project pages in `projects/`.

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

All the words live in one hidden list in `index.html`: `<ul class="planet-list">`. Each `<li>` is
one planet, from the innermost orbit outward. Search for `[` to find every placeholder.

- `data-tag` - the small label above the title (e.g. Pipelines, About).
- `data-icon` - the icon the planet is drawn as: `pipeline`, `migrate`, `diagnostics`, `docs`,
  `about` or `contact` (drawn in `sun.js`, `setPlanetIcon`; leave it off for a plain blob planet).
- `.planet-title` - the title, also shown when the planet is hovered.
- `.planet-text` - a short description.
- `.planet-tools` - tools or skills, shown as chips (optional).
- `.planet-links` - links, shown as buttons (optional). Links starting with `http` open in a new tab.

Add or remove `<li>` items to change the planets (up to 8; their sizes, colours and orbits are the
`planets` list in `sun.js`). Put a `resume.pdf` next to `index.html`, or remove that link.

The list is invisible on screen but read by screen readers and search engines, and Tab moves through
it (each item highlights its planet; Enter opens it).

Keep work projects general: describe the problem, your approach and the outcome, not internal system
names or data.

## How it works

- `background.js` draws the background (settings in `BG`): a side-on painted panorama in the style
  of bold, ink-outlined landscape paintings, made from the world position so it never ends. From the
  top down: endless deep space, a banded sky with brush-stroke streaks, a big swirl and stars, two
  mountain ranges (flat lit and shaded faces running diagonally off each peak, snow caps with rock
  streaks, ink lines), forested hills of pines with a river winding down from the valley, a rocky
  shore, and a lake that mirrors the mountains and sky (so flying down never runs out either).
  Along it, scenes take turns every `sceneWidth` px: a sunset with a sunburst, a moonlit night with
  pink alpenglow, or a pastel dawn, each with its sun or moon over a valley notch. The first scene is
  always a sunset. Layout: `horizon`, `shoreLevel`, `sceneWidth`, `valleyWidth`, `farHeight`,
  `midHeight`, `hillHeight`, `treeSpacing`; colours: `paintColours`.
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
  green flannel, brown trousers, green sandals; colours in `SUN.avatar`) in a warm glow, with the
  planets orbiting it as ink-outlined icons for what they hold (settings in `SUN`). It's still called
  the orb in the code. It measures its own speed every frame (`setAvatarMotion`), whatever moved it,
  and blends between poses (`AVATAR_POSES`): hovering and waving with a hiking stick when still,
  leaning in fist-first flying sideways, arms up going up, flailing with knees tucked coming down.
  It turns to face the way it's going, its hair blows in the wind, and speed lines trail behind it
  when it's fast (`moveFrom`, `moveFull`, `linesFrom` and friends). Hover a planet for its title;
  click it for the full panel. The orb glides wherever you click.
- `hunt.js` turns it into a game: every planet starts hidden somewhere in the world. A radar in the
  corner points to the nearest one and pulses faster as you get close; flying close to a hidden planet
  (or clicking it) catches it (it flies home into orbit and its panel opens). A "Contents" button (top left) lists the planets found so far, and clicking one opens its panel. "Show me everything" skips the hunt, and once all
  are found it becomes "Hide them again". Progress is saved in the visitor's browser. Settings are in
  `HUNT` (how far planets drift, how close a click must be, `gravityReach`, flight time, and so on).
- `extras.js` adds hazards and power-ups (settings in `EXTRAS`): the sky ribbons carry the orb along, keep it
  near their middle unless you're steering (`centring`, `wobble`), and make flying faster; black holes (only in the open sky above the peaks) pull it in and fling it back out if they swallow it (never near the
  start or a hidden planet); stardust specks fill the meter under the radar, and Space or the Boost
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
