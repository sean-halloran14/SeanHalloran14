// =============================================================================
// Tie-dye page background
// =============================================================================
// Two canvases sit behind the page content, both drawn at low resolution
// (BG.resolution and BG.swirlResolution) and scaled up by the browser.
//
// The background is a painted panorama (WebGL), in the style of bold,
// ink-outlined landscape paintings: seen side-on, from the top down, endless
// deep space, a banded sky with swirls, sky ribbons (the currents) and stars,
// two mountain ranges with snow caps, forested hills with a glowing river,
// a rocky shore, and a lake that mirrors everything above it (so flying down
// never runs out of world either). Along it, scenes take turns, each with a
// valley notch and a river winding down from it. The world is a ring going
// round the sun: the sun stays at one spot on the screen, and flying sideways
// carries the orb round it, so the sun rises and sets as it travels (and a
// moon rises in its place at night). The painting's colours follow the same
// day (BG.dayWidth): pastel dawn while the sun rises, warm sunset while it
// sets, moonlit night while it's down. The sun and moon are drawn by the live
// layer, only where there's open sky in front of them. It's made from the world
// position, so the world never ends: flight.js keeps the orb near the middle
// of the page by sliding the world underneath (setBackgroundShift). The
// aurora flow and glow (7) move over the sky.
//
// .page-bg-base   (only without WebGL: static, painted once)
//   1. Base gradient - each section's data-bg colours (browns, greens, blues),
//                      blended diagonally into its neighbours.
//   2. Blobs         - soft ellipses in the same colours, for a tie-dye look.
//   3. Warp          - pushed into swirls once, on the CPU.
//   4. Cel shading   - the colours are flattened into a few solid bands with
//                      dark ink lines between them, like a hand-inked poster.
//
// .page-bg-swirls (animated, orange/red, transparent elsewhere)
//   Everything here comes out of one centre point:
//   5. Rings         - bold, flat, ink-outlined bands born at the point one
//                      after another, cycling through warm colours, expanding
//                      outward in every direction until they leave the page.
//                      The page starts already full of rings.
//   6. Rays          - ink-outlined cartoon streamers from the point, their
//                      dashes streaming outward. While planets are still
//                      hidden (hunt.js), there is one ray aimed at each of
//                      them, stopping just short; once all are found they go
//                      back to a slowly revolving spray off the page.
//   7. Aurora        - the base picture above is handed to the shader too, and
//                      its own colour bands sway and ripple in slow curtain-
//                      like waves, brightening in stepped bands where the
//                      curtains pass - so the background itself moves like the
//                      northern lights. (Without WebGL the still base shows.)
//   8. Live warp     - every frame, a WebGL shader melts the rings and rays,
//                      ripples colour waves through them, adds a red/blue
//                      fringe to their edges,
//                      with flowing noise, sends a slow breathing ripple out
//                      from the point, and a vortex at the point twists the
//                      innermost rings back and forth. A click sends a wave
//                      out through it too (setBackgroundRipple).
//
// The centre point is drawn as a glowing orb, with orbiting planets, by sun.js.
// It starts at the centre of the page. A left click moves it
// (setCentrePoint, called from pointer-effects.js): rings already in flight
// keep expanding from where they were born, new rings come from the new spot,
// and the rays fade across to it, so nothing jumps.
//
// styles.css also drifts both canvases slowly in different directions.
//
// The base colours come from data-bg on the stage in index.html
// (data-bg="--forest --brown ...", top to bottom).
//
// Seeded random generators:
//   BG.seed       - the base colours and blobs. Fixed, so the page keeps its look.
//   BG.swirlSeed  - the ray directions and timing. "random" picks a new layout on
//                   every visit; a number pins one layout. The seed in use is
//                   printed to the browser console, and adding ?swirls=12345 to
//                   the page address previews that layout.
//
// Motion stops for visitors who ask for reduced motion, and the swirl layer
// falls back to a still image if WebGL isn't available.
// =============================================================================

const BG = {
  zoom: 0.6,               // below 1 zooms out: the landscape, orb, planets, rings and rays
                           // are all drawn smaller, so more of the world fits on screen
  // Base gradient
  angleDeg: 165,           // 180 = straight down; lower = more diagonal
  sectionStart: 0.35,      // where a section's first colour sits (0-1 of its height)
  sectionEnd: 0.65,        // where a section's last colour sits

  seed: 7,                 // base colours and blobs
  swirlSeed: "random",     // ray layout: "random" or a number such as 4821

  // Blobs (base colours)
  blobsPerSection: 8,
  blobSpill: 0.25,         // how far blobs may reach past a section (share of its height)
  blobSpillMax: 160,       // ...but never more than this many px
  blobMaxHeight: 650,      // px
  blobMinStrength: 60,     // opacity range, percent
  blobMaxStrength: 90,

  // Accents (orange/red)
  accentColours: ["--sunset", "--ember"],
  inkColour: "--brown-deep", // cartoon outline colour

  // Rings expanding from the centre point
  ringInterval: 2.6,       // seconds between new rings
  ringSpeed: 60,           // outward speed when a ring is born, px per second
  ringAcceleration: 700,   // a ring's speed doubles every this far out, px
  ringColours: ["--sunset", "--horizon", "--ember", "--sun-glow"],  // cycled ring by ring
  ringWidth: 10,           // band width, px; grows a little as rings spread
  ringOutline: 2,          // ink outline either side of a band, px
  ringStrength: 0,         // band opacity, percent (0 = no rings)
  ringFadeIn: 140,         // rings are fully visible once this far out, px

  // Rays flowing out of the centre point
  rayCount: 7,             // how many rays
  rayJitter: 0.35,         // random turn of each ray away from even spacing (share of the gap)
  rayBend: 0.25,           // how much each ray curves over its length, radians
  rayStart: 50,            // rays begin this far from the point, px
  rayDash: 420,            // length of each streaming dash, px
  rayGap: 300,             // gap between dashes, px
  raySpeed: 90,            // how fast dashes stream outward, px per second
  rayColours: ["--sun-glow", "--horizon"],  // alternated ray by ray
  rayWidth: 7,             // streamer width, px
  rayOutline: 0,           // ink outline either side, px (0 = none: soft glowing rays)
  rayStrength: 30,         // streamer opacity, percent
  rayStopShort: 70,        // rays aimed at a hidden planet stop this far before it, px
  rayFade: 1.2,            // seconds for rays to fade across when the point moves

  // Revolution round the centre point (rays)
  revolveSpeed: 0.03,      // radians per second (0 = off)
  revolveDirection: 1,     // 1 = clockwise, -1 = anticlockwise

  // Static warp (base canvas)
  warpStrength: 230,       // how far colours get pushed, px (0 = off)
  warpSwirlSize: 400,      // rough size of one swirl, px; smaller = tighter
  warpCurl: 0.6,           // how much the second push bends the first
  warpDetail: 0.35,        // small extra ripples on top of the main swirls
  saturation: 1.2,         // 1 = unchanged
  celBands: 7,             // solid colour bands in the background (0 = smooth, no ink)
  celInk: 0.6,             // how dark the ink lines between bands are (0-1)
  celSmoothing: 3,         // softens fine detail first, so ink lines come out clean

  // Live warp (swirl canvas)
  liveSpeed: 0.16,         // how fast the flowing noise moves
  liveStrength: 65,        // how far the live warp melts rings and rays, px
  breatheWavelength: 240,  // distance between the breathing ripples from the point, px
  breatheSpeed: 1.3,       // how fast they travel outward
  breatheStrength: 9,      // how far they push the picture, px
  hueSwing: 0.18,          // colour waves: how far colours shift round the wheel, radians
                           // (small keeps them within the palette's oranges, reds and golds)
  hueWavelength: 260,      // distance between colour waves, px
  hueSpeed: 0.7,           // how fast the colour waves travel outward
  celebrateHueSwing: 0.9,  // colour-wave strength during the 'found them all' celebration
  colourSplit: 1.5,        // red/blue fringe on edges, px (0 = off)

  // Aurora: the background's own colours flow and shimmer in curtain-like
  // waves (no extra colours are added).
  auroraStrength: 0.18,    // how much the sky brightens where curtains pass (0 = none)
  auroraFlow: 0.5,         // how far the sky's bands sway (multiplies auroraSway)
  auroraPeriod: 950,       // height of one repeat of the curtains, px (they tile the world)
  auroraSway: 120,         // how far the curtains sway up and down, px
  auroraWave: 750,         // length of their waves across the page, px
  auroraSpeed: 0.35,       // how fast they sway
  auroraEdge: 70,          // softness of their bright lower edge, px
  auroraSteps: 4,          // flat brightness steps (0 = smooth glow)
  shimmer: 0.06,           // drifting vertical light rays over the sky (0 = off)
  riverFlow: 1.6,          // how fast the stars stream along the sky ribbons
  waterGlints: 0.5,        // how bright the moving glints on the lake and rivers are (0 = off)
  vortexRadius: 440,       // reach of the twist at the centre point, px
  vortexSpin: 0,           // biggest twist, in radians (0 = no swirl round the orb)
  vortexSpeed: 0.35,       // how fast the twist swings back and forth
  fps: 30,                 // frames per second for the animation

  // Click wave through the swirl layer
  rippleSpeed: 200,        // how fast the wave spreads, px per second
  rippleWavelength: 110,   // distance between wave crests, px
  rippleWidth: 120,        // how wide the moving band of the wave is, px
  rippleStrength: 42,      // how far the wave bends the swirls, px
  rippleLifetime: 5.5,     // seconds until the wave has died away

  // Landscape: a side-on painted panorama, measured in landscape px (world
  // px / zoom), with y going down and 0 where the page's middle starts.
  // Everything is generated from the world position, so it goes on forever.
  horizon: 300,            // where the sky meets the far mountains, px
  shoreLevel: 1050,        // where the forest meets the lake, px (the lake mirrors all above)
  sceneWidth: 3600,        // one scene (its valley, river and moon) every this many px
  valleyWidth: 700,        // how wide each scene's valley notch is, px
  farHeight: 650,          // how tall the far mountain range rises, px
  midHeight: 430,          // ...the nearer range
  hillHeight: 200,         // ...the forested hills
  treeSpacing: 66,         // distance between pine trees, px
  // Clearings in the forest for the places (town.js stands a building in
  // each, by its item's data-icon): no trees, a meadow floor, a ragged edge.
  // The trees just in front of each building (frontHalfWidth either side,
  // clearingFrontDepth down) are drawn by town.js instead, over the
  // building, so their tops aren't hidden behind it. Landscape px; at most
  // three (the shader's array size).
  clearingFloor: 900,      // the buildings' feet (y; the shore is at shoreLevel)
  clearingFrontDepth: 230,
  clearings: [
    { place: "company", x: 0, halfWidth: 720, depth: 230, frontHalfWidth: 740 },
    { place: "university", x: -2300, halfWidth: 340, depth: 210, frontHalfWidth: 220 },
    { place: "about", x: 2300, halfWidth: 270, depth: 170, frontHalfWidth: 170 },
  ],
  // Sky ribbons: swirling bands high in the sky (the currents in extras.js),
  // with stars streaming along them. They wind along evenly spaced levels of
  // one smooth field, so they never cross, and fade out above the peaks.
  riverSize: 1700,         // how far apart the ribbons wind, px (bigger = longer, lazier bends)
  riverWidth: 80,          // half the width of a ribbon, px (it varies a little)
  riverSpacing: 0.27,      // how far apart neighbouring ribbons are (in the field's units)
  ribbonCeiling: -400,     // ribbons stay above this height (y, px), tapering out towards it
  ribbonFade: 450,         // how far above the ceiling they reach full width, px
  // The paintings' colours. Order matters (the shader's SPACE, INDIGO, ...).
  paintColours: [
    "#0b0d24",             // SPACE: deep space
    "#1f1b52",             // INDIGO
    "#4d2b7d",             // VIOLET
    "#b23a7e",             // MAGENTA
    "#f2722c",             // ORANGE
    "#ffc94d",             // GOLD
    "#1d4596",             // NIGHT_BLUE
    "#4fc0f2",             // GLOW: night glow, cyan
    "#f4bccb",             // PASTEL_PINK
    "#bfe9d6",             // PASTEL_MINT
    "#f5f2ff",             // SNOW
    "#f2a3d6",             // SNOW_PINK: alpenglow
    "#3b4180",             // ROCK
    "#191732",             // ROCK_DARK
    "#0e2a24",             // PINE
    "#45a062",             // PINE_LIGHT
    "#0a0814",             // INK
  ],

  // The sun and moon: pinned to the screen. The world turns round them as the
  // orb flies sideways, so they rise and set with the distance travelled, and
  // the painting's colours follow (dawn, sunset, night).
  dayWidth: 26000,         // landscape px of sideways flying from one sunrise to the next; the whole
                           // world repeats every this many px too (one day per trip round)
  dayStart: 0.1,           // where in the day the orb starts (0 = sunrise; see dayShare)
  dayShare: 0.6,           // share of the day the sun is up (sunset at this point; the rest is night)
  dayDrift: 600,           // seconds for the day to go all the way round by itself, even sitting still
  dayRepaint: 0.008,       // repaint the landscape's colours once the day has drifted this far (share of a day)
  twilightFlush: 1,        // how much sunrise and sunset flush the colours (0 = not at all)
  twilightGlow: 0.8,       // how strong the glow over the sky is round sunrise and sunset (0-1)
  nightDeepness: 0.55,     // how much darker and bluer the night gets (0-1)
  twilightSpan: 0.8,       // how long sunrise and sunset colours last: how far from the horizon they reach (sun heights, 0-1)
  // Like the Earth: the loop has a day side and a night side. The sun hangs
  // over the middle of the day side and the moon over the middle of the
  // night side. Wherever the orb is, the one that's up there shows: right
  // overhead in the middle of its side, lower and further across the screen
  // towards the horizon, setting as the orb flies away from it.
  sunSwing: 0.42,          // how far across the screen they sit when on the horizon (share of the screen from the middle)
  sunLow: 380,             // landscape y they rise from and set to (just behind the far mountains), px
  sunHigh: -480,           // landscape y at their highest (above the tallest peaks), px
  sunRadius: 95,           // landscape px (shrinks with the zoom like the landscape)
  moonRadius: 62,          // landscape px
  moonOverlap: 0.08,       // the moon rises this much of a day before sunset and sets this much after sunrise,
                           // so round twilight the sun and moon share the sky

  // Canvas
  margin: 260,             // extra picture around the page so drift/warp edges never show
  resolution: 0.3,         // base canvas pixels per page pixel; lower = faster, softer
  liteResolution: 0.24,    // swirlResolution in lite mode (slow devices)
  liteFps: 24,             // fps in lite mode
  liteSlowness: 1.6,       // go lite if frames come this many times slower than fps
  swirlResolution: 0.36,   // same for the animated swirl layer (higher = crisper outlines, slower)
};

// Settings measured in px that shrink with BG.zoom (applied once, below).
const ZOOMED_SETTINGS = [
  "ringSpeed", "ringAcceleration", "ringWidth", "ringOutline", "ringFadeIn",
  "rayStart", "rayDash", "rayGap", "raySpeed", "rayWidth", "rayOutline", "rayStopShort",
  "liveStrength", "breatheWavelength", "breatheStrength", "hueWavelength", "warpSwirlSize",
  "auroraPeriod", "auroraSway", "auroraWave", "auroraEdge", "vortexRadius",
  "rippleSpeed", "rippleWavelength", "rippleWidth", "rippleStrength",
];

function setZoomedSettings() {
  // Scales the px settings above by BG.zoom, so the zoom is one setting. The
  // landscape is zoomed in its shader instead (setTerrainUniforms).
  for (const name of ZOOMED_SETTINGS) {
    BG[name] = BG[name] * BG.zoom;
  }
}

setZoomedSettings();
const BG_START_ZOOM = BG.zoom;  // zoom.js zooms out from here and back

const MAX_RIPPLES = 4;     // must match the shader's array size; oldest is replaced

const backgroundPage = document.querySelector(".page");
const baseCanvas = document.querySelector(".page-bg-base");
const swirlCanvas = document.querySelector(".page-bg-swirls");
const backgroundSections = document.querySelectorAll("[data-bg]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function getSwirlSeed() {
  // A number from ?swirls= in the address wins (handy for trying layouts),
  // then a number in BG.swirlSeed, otherwise a fresh random one for this visit.
  const fromAddress = Number(new URLSearchParams(window.location.search).get("swirls"));
  if (Number.isInteger(fromAddress) && fromAddress > 0) {
    return fromAddress;
  }
  if (typeof BG.swirlSeed === "number") {
    return BG.swirlSeed;
  }
  return 1 + Math.floor(Math.random() * 99999);
}

// Picked once per visit, so resizing keeps the same layout.
const swirlSeed = getSwirlSeed();
console.info("Background swirl layout: " + swirlSeed + " (pin it with BG.swirlSeed or ?swirls=" + swirlSeed + ")");

// Everything the swirl animation needs between frames.
const swirlState = {
  ready: false,
  pendingShift: null,          // a world shift the view hasn't scrolled to match yet (setBackgroundShift)
  dayDrift: 0,                 // how far the day has drifted by itself (share of a day; BG.dayDrift)
  paintedDrift: 0,             // ...and how far it had when the landscape was last painted
  gl: null,
  program: null,
  texture: null,
  terrainProgram: null,        // draws the landscape into a texture
  copyProgram: null,           // copies the landscape across when the world shifts
  terrainTextures: [],         // [current landscape, spare]
  framebuffer: null,
  origin: null,                // world px of the page's top-left corner
  uniforms: {},
  sourceCanvas: document.createElement("canvas"),  // rings + rays, before warping
  centre: { x: 0, y: 0 },      // centre point on the canvas picture, page px
  centrePage: null,            // a clicked point in page px, kept across resizes
  pictureWidth: 0,             // canvas picture size in page px (page plus margins)
  pictureHeight: 0,
  rings: [],                   // each: centre it was born at, and when
  nextRingTime: 0,
  rayLayout: [],               // each ray's direction, bend, colour and dash timing
  rayGroups: [],               // rays drawn from a centre; old ones fade out after a click
  vortexPhase: 0,
  ripples: new Float32Array(MAX_RIPPLES * 4),  // x, y (canvas px), start time, strength
  nextRipple: 0,
  celebrateUntil: -1,          // colour waves flare until this time (seconds)
  celebrating: false,
  lite: false,                 // lite mode on (setLiteMode)
  liteChecked: false,
  liteSamples: [],             // gaps between drawn frames, ms
  canvasWidth: 0,
  canvasHeight: 0,
  startTime: performance.now(),
  lastFrameTime: 0,
  frame: 0,
};

// ---------- Helpers ----------

function getSeededRandom(seed) {
  // Small deterministic random number generator (mulberry32).
  let state = seed;
  return function () {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getRandomBetween(random, low, high) {
  return low + (high - low) * random();
}

function getRandomItem(random, items) {
  return items[Math.floor(random() * items.length)];
}

function getHexColour(hex) {
  // Turns "#1f1b52" into [r, g, b].
  const digits = hex.replace("#", "");
  return [
    parseInt(digits.slice(0, 2), 16),
    parseInt(digits.slice(2, 4), 16),
    parseInt(digits.slice(4, 6), 16),
  ];
}

function getColourValue(name) {
  // Reads a colour such as --forest from styles.css and returns [r, g, b].
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function getRgba(name, strength) {
  const rgb = getColourValue(name);
  return "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + (strength / 100) + ")";
}

function getSeconds() {
  return (performance.now() - swirlState.startTime) / 1000;
}

function getSectionInfo(section, pageTop) {
  // A section's colours and where it sits, in page pixels measured on the
  // canvas picture (which starts BG.margin above and to the left of the page).
  const box = section.getBoundingClientRect();
  return {
    colours: section.dataset.bg.trim().split(/\s+/),
    top: box.top - pageTop + BG.margin,
    height: box.height,
  };
}

function setCanvasSize(canvas, canvasWidth, canvasHeight) {
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
}

function setCanvasPlacement(canvas) {
  canvas.style.inset = "-" + BG.margin + "px";
  canvas.style.width = "calc(100% + " + (2 * BG.margin) + "px)";
  canvas.style.height = "calc(100% + " + (2 * BG.margin) + "px)";
}

function getDrawingContext(canvas, resolution) {
  // Clears the canvas and returns a 2D context that draws in page pixels;
  // the transform scales them down to the canvas's resolution.
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(resolution, 0, 0, resolution, 0, 0);
  return context;
}

// ---------- Base canvas: gradient ----------

function setBaseGradient(context, sections, width, height) {
  const angle = BG.angleDeg * Math.PI / 180;
  const directionX = Math.sin(angle);
  const directionY = -Math.cos(angle);
  const lineLength = Math.abs(width * directionX) + Math.abs(height * directionY);
  const centreX = width / 2;
  const centreY = height / 2;
  const gradient = context.createLinearGradient(
    centreX - directionX * lineLength / 2, centreY - directionY * lineLength / 2,
    centreX + directionX * lineLength / 2, centreY + directionY * lineLength / 2
  );

  for (const section of sections) {
    const count = section.colours.length;
    for (let i = 0; i < count; i++) {
      let fraction = 0.5;
      if (count > 1) {
        fraction = BG.sectionStart + (BG.sectionEnd - BG.sectionStart) * i / (count - 1);
      }
      // Distance along the angled line for this height, measured down the centre.
      const y = section.top + section.height * fraction;
      const position = ((y - centreY) * directionY + lineLength / 2) / lineLength;
      gradient.addColorStop(Math.min(1, Math.max(0, position)), getRgba(section.colours[i], 100));
    }
  }

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

// ---------- Base canvas: blobs ----------

function setSectionBlobs(context, section, pageWidth, random) {
  for (let i = 0; i < BG.blobsPerSection; i++) {
    const colour = getRandomItem(random, section.colours);
    const spill = Math.min(BG.blobSpill * section.height, BG.blobSpillMax);
    const x = BG.margin + getRandomBetween(random, -0.1, 1.1) * pageWidth;
    const radiusX = getRandomBetween(random, 0.22, 0.5) * pageWidth;
    const radiusY = Math.min(BG.blobMaxHeight, Math.max(220, getRandomBetween(random, 0.35, 0.8) * section.height));
    // Keep the visible middle of the blob (about half its radius) inside the
    // section plus its spill, so big blobs can't wash into a neighbour.
    const lowest = section.top - spill + radiusY * 0.5;
    const highest = section.top + section.height + spill - radiusY * 0.5;
    let y = section.top + section.height / 2;
    const roll = random();
    if (highest > lowest) {
      y = lowest + roll * (highest - lowest);
    }
    const strength = getRandomBetween(random, BG.blobMinStrength, BG.blobMaxStrength);

    // Canvas radial gradients are circles, so draw a unit circle and stretch it.
    context.save();
    context.translate(x, y);
    context.scale(radiusX, radiusY);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, getRgba(colour, strength));
    gradient.addColorStop(0.55, getRgba(colour, strength * 0.6));
    gradient.addColorStop(1, getRgba(colour, 0));
    context.fillStyle = gradient;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
  }
}

// ---------- Base canvas: static warp (CPU) ----------

function getNoiseField(random, width, height, cellSize) {
  // Smooth random values between 0 and 1: random numbers on a coarse grid,
  // blended smoothly between grid points. Positions outside the area are clamped.
  const columns = Math.ceil(width / cellSize) + 2;
  const rows = Math.ceil(height / cellSize) + 2;
  const grid = new Float32Array(columns * rows);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = random();
  }

  return function (x, y) {
    const gx = Math.min(columns - 1.001, Math.max(0, x / cellSize));
    const gy = Math.min(rows - 1.001, Math.max(0, y / cellSize));
    const column = Math.floor(gx);
    const row = Math.floor(gy);
    let tx = gx - column;
    let ty = gy - row;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const topLeft = grid[row * columns + column];
    const topRight = grid[row * columns + column + 1];
    const bottomLeft = grid[(row + 1) * columns + column];
    const bottomRight = grid[(row + 1) * columns + column + 1];
    const top = topLeft + (topRight - topLeft) * tx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
    return top + (bottom - top) * ty;
  };
}

function getWarpMap(width, height, resolution) {
  // Works out where every canvas pixel takes its colour from. First push:
  // big, lazy noise decides where to look up the second push, so the second
  // push curls around instead of just shifting.
  const random = getSeededRandom(BG.seed + 2000);
  const swirl = BG.warpSwirlSize * resolution;
  const strength = BG.warpStrength * resolution;
  const curl = swirl * BG.warpCurl;

  const curlX = getNoiseField(random, width, height, swirl * 1.7);
  const curlY = getNoiseField(random, width, height, swirl * 1.7);
  const pushX = getNoiseField(random, width, height, swirl);
  const pushY = getNoiseField(random, width, height, swirl);
  const detailX = getNoiseField(random, width, height, swirl / 2.5);
  const detailY = getNoiseField(random, width, height, swirl / 2.5);
  const sampleX = new Float32Array(width * height);
  const sampleY = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bentX = x + (curlX(x, y) - 0.5) * curl;
      const bentY = y + (curlY(x, y) - 0.5) * curl;
      const shiftX = (pushX(bentX, bentY) - 0.5 + (detailX(bentX, bentY) - 0.5) * BG.warpDetail) * strength;
      const shiftY = (pushY(bentX, bentY) - 0.5 + (detailY(bentX, bentY) - 0.5) * BG.warpDetail) * strength;
      sampleX[y * width + x] = Math.min(width - 2, Math.max(0, x + shiftX));
      sampleY[y * width + x] = Math.min(height - 2, Math.max(0, y + shiftY));
    }
  }
  return { width: width, height: height, sampleX: sampleX, sampleY: sampleY };
}

function setWarp(context, warpMap, celShaded) {
  // Each pixel copies the colour (and transparency) from its spot in the warp
  // map, blending the four nearest source pixels so swirls stay smooth.
  // Saturation is boosted at the same time.
  const width = warpMap.width;
  const height = warpMap.height;
  const source = context.getImageData(0, 0, width, height);
  const output = context.createImageData(width, height);
  const from = source.data;
  const to = output.data;
  const pixel = [0, 0, 0, 0];

  for (let i = 0; i < width * height; i++) {
    const sampleX = warpMap.sampleX[i];
    const sampleY = warpMap.sampleY[i];
    const left = Math.floor(sampleX);
    const upper = Math.floor(sampleY);
    const fx = sampleX - left;
    const fy = sampleY - upper;
    const i00 = (upper * width + left) * 4;
    const i10 = i00 + 4;
    const i01 = i00 + width * 4;
    const i11 = i01 + 4;

    for (let channel = 0; channel < 4; channel++) {
      const top = from[i00 + channel] + (from[i10 + channel] - from[i00 + channel]) * fx;
      const bottom = from[i01 + channel] + (from[i11 + channel] - from[i01 + channel]) * fx;
      pixel[channel] = top + (bottom - top) * fy;
    }

    // Saturation: push each colour channel away from the pixel's grey value.
    const grey = 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
    const target = i * 4;
    for (let channel = 0; channel < 3; channel++) {
      to[target + channel] = grey + (pixel[channel] - grey) * BG.saturation;
    }
    to[target + 3] = pixel[3];
  }

  if (celShaded && BG.celBands > 0) {
    setCelShading(to, width, height);
  }
  context.putImageData(output, 0, 0);
}

function getSmoothedLightness(data, width, height, radius) {
  // Each pixel's lightness, blurred by averaging its neighbours (a box blur,
  // run across then down, twice), so tiny detail doesn't break up the bands.
  let values = new Float32Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    values[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  if (radius <= 0) {
    return values;
  }
  let scratch = new Float32Array(width * height);
  for (let pass = 0; pass < 2; pass++) {
    // Across.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let total = 0;
        let count = 0;
        for (let k = -radius; k <= radius; k++) {
          const nx = Math.min(width - 1, Math.max(0, x + k));
          total += values[y * width + nx];
          count += 1;
        }
        scratch[y * width + x] = total / count;
      }
    }
    // Down.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let total = 0;
        let count = 0;
        for (let k = -radius; k <= radius; k++) {
          const ny = Math.min(height - 1, Math.max(0, y + k));
          total += scratch[ny * width + x];
          count += 1;
        }
        values[y * width + x] = total / count;
      }
    }
  }
  return values;
}

function setCelShading(data, width, height) {
  // Cartoon shading: every pixel's brightness is snapped to one of a few
  // bands (keeping its colour), so smooth blends become flat areas. Then the
  // edges between bands are inked with a dark line.
  let darkest = 255;
  let brightest = 0;
  for (let i = 0; i < data.length; i += 4) {
    const light = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    darkest = Math.min(darkest, light);
    brightest = Math.max(brightest, light);
  }
  const range = Math.max(1, brightest - darkest);
  const bands = new Uint8Array(width * height);
  const smooth = getSmoothedLightness(data, width, height, BG.celSmoothing);

  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const light = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // The band comes from the softened lightness, so its edges are smooth
    // curves rather than speckles; the colour keeps its own hue.
    const band = Math.min(BG.celBands - 1, Math.max(0, Math.floor((smooth[p] - darkest) / range * BG.celBands)));
    bands[p] = band;
    const flat = darkest + (band + 0.5) / BG.celBands * range;
    const factor = flat / Math.max(1, light);
    for (let channel = 0; channel < 3; channel++) {
      data[i + channel] = Math.min(255, data[i + channel] * factor);
    }
  }

  const ink = getColourValue(BG.inkColour);
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const p = y * width + x;
      if (bands[p] === bands[p + 1] && bands[p] === bands[p + width]) {
        continue;
      }
      const i = p * 4;
      for (let channel = 0; channel < 3; channel++) {
        data[i + channel] = data[i + channel] + (ink[channel] - data[i + channel]) * BG.celInk;
      }
    }
  }
}

// ---------- Centre point ----------

function setCentreFromPage(pageWidth, pageHeight) {
  // The centre of the page, unless the visitor has clicked somewhere.
  let point = swirlState.centrePage;
  if (point === null) {
    point = { x: pageWidth / 2, y: pageHeight / 2 };
  }
  swirlState.centre = { x: point.x + BG.margin, y: point.y + BG.margin };
}

function getCentrePagePoint() {
  // Where the centre point is, in page px measured from the top-left of .page.
  // Used by sun.js to draw the sun there.
  if (swirlState.centrePage !== null) {
    return { x: swirlState.centrePage.x, y: swirlState.centrePage.y };
  }
  const pageBox = backgroundPage.getBoundingClientRect();
  return { x: pageBox.width / 2, y: pageBox.height / 2 };
}

function setCentrePagePosition(pageX, pageY) {
  // Moves the centre point a little at a time (flight.js, while the visitor
  // flies the orb). Unlike setCentrePoint, the rays don't fade across: the
  // current rays simply travel along with the point.
  const pageBox = backgroundPage.getBoundingClientRect();
  swirlState.centrePage = { x: pageX, y: pageY };
  setCentreFromPage(pageBox.width, pageBox.height);
  for (const group of swirlState.rayGroups) {
    if (group.fadingSince === null) {
      group.x = swirlState.centre.x;
      group.y = swirlState.centre.y;
    }
  }
  if (swirlState.gl) {
    setVortexUniform();
  }
}

function setCentrePoint(clientX, clientY) {
  // Moves the centre point to a spot on the screen. Called by
  // pointer-effects.js on a left click. Rings already in flight carry on from
  // where they were born; the rays fade across to the new spot.
  const pageBox = backgroundPage.getBoundingClientRect();
  swirlState.centrePage = { x: clientX - pageBox.left, y: clientY - pageBox.top };
  setCentreFromPage(pageBox.width, pageBox.height);
  setNewRayGroup(getSeconds());
  if (swirlState.gl) {
    setVortexUniform();
  }
}

function getFarthestCornerDistance(point) {
  // How far a ring from this point must grow to have left the whole picture.
  const corners = [
    [0, 0],
    [swirlState.pictureWidth, 0],
    [0, swirlState.pictureHeight],
    [swirlState.pictureWidth, swirlState.pictureHeight],
  ];
  let farthest = 0;
  for (const corner of corners) {
    farthest = Math.max(farthest, Math.hypot(corner[0] - point.x, corner[1] - point.y));
  }
  return farthest;
}

// ---------- Rings ----------

function getRingRadius(age) {
  // A ring's size after this many seconds. It starts at ringSpeed and its
  // speed doubles every ringAcceleration px, which works out to this curve.
  return BG.ringAcceleration * (Math.exp(BG.ringSpeed * age / BG.ringAcceleration) - 1);
}

function setNewRing(born, colourIndex) {
  swirlState.rings.push({
    x: swirlState.centre.x,
    y: swirlState.centre.y,
    born: born,
    colour: BG.ringColours[colourIndex % BG.ringColours.length],
  });
}

function setPrefilledRings(seconds) {
  // Fills the page with rings as if they had always been flowing, so the
  // first thing a visitor sees is already in motion.
  swirlState.rings = [];
  const reach = getFarthestCornerDistance(swirlState.centre) + BG.ringWidth;
  let age = 0;
  let index = 0;
  while (getRingRadius(age) < reach) {
    setNewRing(seconds - age, index);
    age += BG.ringInterval;
    index += 1;
  }
  // Oldest first, so the newest ring is drawn on top.
  swirlState.rings.reverse();
  swirlState.nextRingTime = seconds + BG.ringInterval;
}

function setRingFlow(seconds) {
  // Adds a new ring at the centre point every ringInterval, and drops rings
  // that have grown past the edge of the picture.
  let index = swirlState.rings.length;
  while (seconds >= swirlState.nextRingTime) {
    setNewRing(swirlState.nextRingTime, index);
    swirlState.nextRingTime += BG.ringInterval;
    index += 1;
  }
  const alive = [];
  for (const ring of swirlState.rings) {
    const radius = getRingRadius(seconds - ring.born);
    if (radius < getFarthestCornerDistance(ring) + BG.ringWidth * 2) {
      alive.push(ring);
    }
  }
  swirlState.rings = alive;
}

function setRings(context, seconds) {
  // Each ring as a flat colour band with a dark ink outline, round the point
  // it was born at. Rings fade in as they leave the point and widen a little
  // as they spread. (Off when BG.ringStrength is 0.)
  if (BG.ringStrength <= 0) {
    return;
  }
  for (const ring of swirlState.rings) {
    const radius = getRingRadius(seconds - ring.born);
    if (radius <= 0) {
      continue;
    }
    const visibility = Math.min(1, radius / BG.ringFadeIn);
    const width = BG.ringWidth * (1 + Math.min(1.5, radius / 1500));
    context.beginPath();
    context.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
    context.lineWidth = width + 2 * BG.ringOutline;
    context.strokeStyle = getRgba(BG.inkColour, 85 * visibility);
    context.stroke();
    context.lineWidth = width;
    context.strokeStyle = getRgba(ring.colour, BG.ringStrength * visibility);
    context.stroke();
  }
}

// ---------- Rays ----------

function getRayLayout(random) {
  // Directions spread evenly round the point, each nudged a little, with its
  // own gentle bend, colour and dash timing.
  const rays = [];
  const gap = Math.PI * 2 / BG.rayCount;
  const start = random() * Math.PI * 2;
  for (let i = 0; i < BG.rayCount; i++) {
    let bend = BG.rayBend * getRandomBetween(random, 0.4, 1);
    if (random() < 0.5) {
      bend = -bend;
    }
    rays.push({
      angle: start + i * gap + getRandomBetween(random, -0.5, 0.5) * BG.rayJitter * gap,
      bend: bend,
      colour: BG.rayColours[i % BG.rayColours.length],
      phase: random() * (BG.rayDash + BG.rayGap),
      speed: BG.raySpeed * getRandomBetween(random, 0.85, 1.2),
      width: BG.rayWidth * getRandomBetween(random, 0.75, 1.15),
    });
  }
  return rays;
}

function setNewRayGroup(seconds) {
  // Rays from the current centre point. Any older groups start fading out.
  for (const group of swirlState.rayGroups) {
    if (group.fadingSince === null) {
      group.fadingSince = seconds;
    }
  }
  swirlState.rayGroups.push({
    x: swirlState.centre.x,
    y: swirlState.centre.y,
    born: seconds,
    fadingSince: null,
  });
}

function getRayGroupVisibility(group, seconds) {
  const fadeIn = Math.min(1, (seconds - group.born) / BG.rayFade);
  if (group.fadingSince === null) {
    return fadeIn;
  }
  return fadeIn * Math.max(0, 1 - (seconds - group.fadingSince) / BG.rayFade);
}

function getRayPoints(group, ray, seconds) {
  // A nearly straight line from just outside the point to beyond the picture,
  // curving gently by its bend and turning slowly with the revolution.
  const turn = BG.revolveDirection * BG.revolveSpeed * seconds;
  const length = getFarthestCornerDistance(group) + BG.rayWidth;
  const steps = 10;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const along = i / steps;
    const distance = BG.rayStart + along * (length - BG.rayStart);
    const angle = ray.angle + turn + ray.bend * along * along;
    points.push({
      x: group.x + Math.cos(angle) * distance,
      y: group.y + Math.sin(angle) * distance,
    });
  }
  return points;
}

function setSmoothPath(context, points) {
  // Draws a smooth curve through every point (Catmull-Rom turned into Bezier curves).
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const before = points[Math.max(0, i - 1)];
    const start = points[i];
    const end = points[i + 1];
    const after = points[Math.min(points.length - 1, i + 2)];
    context.bezierCurveTo(
      start.x + (end.x - before.x) / 6, start.y + (end.y - before.y) / 6,
      end.x - (after.x - start.x) / 6, end.y - (after.y - start.y) / 6,
      end.x, end.y
    );
  }
}

function getRayTargets() {
  // Hidden planets the rays should point at, on the canvas picture (page px
  // plus the margin). Empty when there's no hunt or all have been found.
  const targets = [];
  if (typeof getMissingPlanetPoints !== "function") {
    return targets;
  }
  for (const point of getMissingPlanetPoints()) {
    targets.push({ x: point.x + BG.margin, y: point.y + BG.margin });
  }
  return targets;
}

function getAimedRayPoints(group, ray, target) {
  // A ray from just outside the point towards a hidden planet, bowing gently
  // to one side and stopping a little before the planet.
  const dx = target.x - group.x;
  const dy = target.y - group.y;
  const distance = Math.hypot(dx, dy);
  const length = Math.max(BG.rayStart + 10, distance - BG.rayStopShort);
  const ux = dx / Math.max(1, distance);
  const uy = dy / Math.max(1, distance);
  const steps = 10;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const along = i / steps;
    const reach = BG.rayStart + along * (length - BG.rayStart);
    const bow = Math.sin(Math.PI * along) * ray.bend * 0.25 * length;
    points.push({
      x: group.x + ux * reach - uy * bow,
      y: group.y + uy * reach + ux * bow,
    });
  }
  return points;
}

function setRays(context, seconds) {
  // Dashed rays whose dashes stream outward from the point over time.
  const alive = [];
  for (const group of swirlState.rayGroups) {
    if (getRayGroupVisibility(group, seconds) > 0 || group.fadingSince === null) {
      alive.push(group);
    }
  }
  swirlState.rayGroups = alive;

  context.lineCap = "round";
  context.setLineDash([BG.rayDash, BG.rayGap]);
  const targets = getRayTargets();
  for (const group of swirlState.rayGroups) {
    const visibility = getRayGroupVisibility(group, seconds);
    // One ray per hidden planet while the hunt is on; otherwise the usual spray.
    let rayTotal = swirlState.rayLayout.length;
    if (targets.length > 0) {
      rayTotal = targets.length;
    }
    for (let r = 0; r < rayTotal; r++) {
      const ray = swirlState.rayLayout[r % swirlState.rayLayout.length];
      let points = null;
      if (targets.length > 0) {
        points = getAimedRayPoints(group, ray, targets[r]);
      } else {
        points = getRayPoints(group, ray, seconds);
      }
      context.lineDashOffset = -(ray.phase + seconds * ray.speed);
      // An ink outline (if any), then a soft wide glow, then the colour.
      setSmoothPath(context, points);
      if (BG.rayOutline > 0) {
        context.lineWidth = ray.width + 2 * BG.rayOutline;
        context.strokeStyle = getRgba(BG.inkColour, 85 * visibility);
        context.stroke();
      }
      context.lineWidth = ray.width * 2.6;
      context.strokeStyle = getRgba(ray.colour, BG.rayStrength * 0.35 * visibility);
      context.stroke();
      context.lineWidth = ray.width;
      context.strokeStyle = getRgba(ray.colour, BG.rayStrength * visibility);
      context.stroke();
    }
  }
  context.setLineDash([]);
}

function setSwirlSource(seconds) {
  // Rings and rays at this moment in time, before the live warp.
  const context = getDrawingContext(swirlState.sourceCanvas, BG.swirlResolution);
  setRings(context, seconds);
  setRays(context, seconds);
  if (typeof setExtrasDrawn === "function") {
    setExtrasDrawn(context, seconds);   // stardust (extras.js)
  }
}

// ---------- Swirl canvas: live warp (WebGL) ----------

const SWIRL_VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const SWIRL_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D u_image;    // rings and rays
uniform sampler2D u_base;     // the cel-shaded background picture
uniform float u_auroraFlow;   // how far the background's bands sway
uniform vec2 u_size;          // canvas size in canvas pixels
uniform float u_time;         // seconds
uniform float u_seed;
uniform float u_swirl;        // swirl size in canvas pixels
uniform float u_strength;     // push in canvas pixels
uniform float u_curl;
uniform float u_detail;
uniform float u_speed;
uniform float u_spin;
uniform float u_vortexSpeed;
uniform vec4 u_vortex;        // centre vortex: x, y, radius (canvas pixels), phase
uniform vec3 u_breathe;       // breathing ripple: wavelength (px), speed, strength (px)
uniform vec3 u_hue;           // colour waves: swing (radians), wavelength (px), speed
uniform float u_split;        // red/blue fringe, px
uniform vec4 u_auroraShape;   // wave frequency (per px), speed, sway (px), period (px)
uniform vec3 u_auroraLook;    // edge softness (px), brightening (0-1), steps (0 = smooth)
uniform vec4 u_ripples[4];    // x, y (canvas pixels), start time (s), strength (0 = unused)
uniform vec4 u_rippleShape;   // speed (px/s), wavelength (px), band width (px), lifetime (s)
uniform float u_rippleStrength;  // px
uniform vec2 u_worldOffset;   // the picture's top-left in the world, canvas px
uniform float u_shimmer;      // strength of the drifting light rays (0 = off)
uniform float u_riverFlow;    // how fast the streaks run along the sky ribbons
uniform float u_waterGlints;  // brightness of the glints on water (0 = off)
uniform vec4 u_sun;           // the sun: x, y, radius (canvas pixels), height (-1 midnight, 0 horizon, 1 midday)
uniform vec4 u_moon;          // the moon: x, y, radius (canvas pixels), how much it's up (0-1)
uniform float u_sunRising;    // 1 in the morning half of the day (sunrise), 0 in the evening half (sunset)
uniform vec3 u_twilight;      // how strong: sunrise/sunset flush (0-1), sky glow (0-1), night (0-1)
uniform float u_twilightSpan; // how far from the horizon (in sun heights) the sunrise/sunset colours reach

float getHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float getNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = getHash(cell);
  float b = getHash(cell + vec2(1.0, 0.0));
  float c = getHash(cell + vec2(0.0, 1.0));
  float d = getHash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float getCurtainSway(vec2 p, float fk) {
  // How far curtain number fk is swayed at this point (slow waves plus a
  // little wandering noise).
  return sin(p.x * u_auroraShape.x * (1.0 + 0.35 * fk) + u_time * u_auroraShape.y * (1.0 + 0.25 * fk) + fk * 2.1)
    * u_auroraShape.z
    + (getNoise(vec2(p.x * 0.004 + fk * 7.3, u_time * 0.06)) - 0.5) * u_auroraShape.z * 1.6;
}

float getAuroraGlow(vec2 p) {
  // Three curtains that tile down the world. Each has a bright, fairly crisp
  // lower edge and long rays fading upward, and shimmers with vertical
  // streaks. Stepped into flat bands for the cartoon look. 0 = no curtain.
  float glow = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float within = mod(p.y - getCurtainSway(p, fk) + fk * u_auroraShape.w / 3.0, u_auroraShape.w);
    float edge = within - u_auroraShape.w * 0.72;
    float curtain = 0.0;
    if (edge < 0.0) {
      curtain = exp(edge / (u_auroraShape.w * 0.22));
    } else {
      curtain = exp(-(edge * edge) / (u_auroraLook.x * u_auroraLook.x));
    }
    float rays = 0.45 + 0.55 * getNoise(vec2(p.x * 0.035 + fk * 13.1, u_time * 0.35 + fk));
    glow = max(glow, curtain * rays);
  }
  if (u_auroraLook.z > 0.0) {
    glow = floor(glow * u_auroraLook.z + 0.35) / u_auroraLook.z;
  }
  return glow;
}

vec2 getAuroraFlow(vec2 p) {
  // Moves the background's bands: mostly up and down in long slow waves (like
  // curtains rippling), with a gentle drift sideways.
  float down = getCurtainSway(p, 0.0) * 0.6 + getCurtainSway(p, 1.0) * 0.4;
  float across = sin(p.y * u_auroraShape.x * 0.6 + u_time * u_auroraShape.y * 0.7) * u_auroraShape.z * 0.35;
  return vec2(across, down) * u_auroraFlow;
}

void main() {
  // Canvas pixel position, with y measured from the top like the 2D canvas.
  vec2 position = vec2(gl_FragCoord.x, u_size.y - gl_FragCoord.y);
  vec2 p = (position + u_worldOffset) / u_swirl + u_seed;
  float t = u_time * u_speed;

  // Flowing two-step warp: the first noise bends where the second is read.
  vec2 bend = vec2(
    getNoise(p * 0.6 + vec2(0.0, t)),
    getNoise(p * 0.6 + vec2(5.2, 1.3) - vec2(t, 0.0))
  );
  vec2 bent = p + (bend - 0.5) * u_curl * 2.0;
  vec2 push = vec2(
    getNoise(bent + vec2(1.7, 9.2) + t * 0.8),
    getNoise(bent + vec2(8.3, 2.8) - t * 0.8)
  );
  vec2 detail = vec2(
    getNoise(bent * 2.5 + vec2(3.1, 4.7) + t),
    getNoise(bent * 2.5 + vec2(6.1, 0.3) - t)
  );
  vec2 samplePosition = position + ((push - 0.5) + (detail - 0.5) * u_detail) * u_strength;

  // Click waves: a ring-shaped wave moves out from each click, pushing the
  // picture in and out along the way, and fades as it spreads.
  for (int i = 0; i < 4; i++) {
    vec4 ripple = u_ripples[i];
    float age = u_time - ripple.z;
    if (ripple.w <= 0.0 || age < 0.0 || age > u_rippleShape.w) {
      continue;
    }
    vec2 away = position - ripple.xy;
    float reach = length(away);
    if (reach < 0.001) {
      continue;
    }
    float front = age * u_rippleShape.x;
    float band = exp(-pow((reach - front) / u_rippleShape.z, 2.0));
    float wave = sin((reach - front) * 6.2831853 / u_rippleShape.y);
    float fade = 1.0 - age / u_rippleShape.w;
    samplePosition += (away / reach) * wave * band * fade * fade * ripple.w * u_rippleStrength;
  }

  // Breathing: slow ripples travel out from the centre point forever,
  // pushing the picture in and out so everything gently throbs.
  vec2 fromCentre = position - u_vortex.xy;
  float centreDistance = length(fromCentre);
  if (centreDistance > 0.001) {
    float breath = sin(centreDistance * 6.2831853 / u_breathe.x - u_time * u_breathe.y);
    samplePosition += (fromCentre / centreDistance) * breath * u_breathe.z;
  }

  // Centre vortex: twists the picture round the centre point, strongest in
  // the middle, swinging back and forth over time.
  vec2 offset = samplePosition - u_vortex.xy;
  float falloff = exp(-dot(offset, offset) / (u_vortex.z * u_vortex.z));
  float angle = u_spin * falloff * sin(u_time * u_vortexSpeed + u_vortex.w);
  float c = cos(angle);
  float s = sin(angle);
  samplePosition = u_vortex.xy + vec2(c * offset.x - s * offset.y, s * offset.x + c * offset.y);

  // Colour fringe: red is read a little further out from the centre point
  // and blue a little further in, like an old 3D print.
  vec2 uv = samplePosition / u_size;
  vec2 outward = vec2(0.0);
  if (centreDistance > 0.001) {
    outward = fromCentre / centreDistance * u_split / u_size;
  }
  vec4 middle = texture2D(u_image, clamp(uv, 0.0, 1.0));
  vec4 outer = texture2D(u_image, clamp(uv + outward, 0.0, 1.0));
  vec4 inner = texture2D(u_image, clamp(uv - outward, 0.0, 1.0));
  float alpha = max(max(outer.a, middle.a), inner.a);
  vec3 rgb = vec3(outer.r, middle.g, inner.b);

  // Colour waves: hues swing back and forth in rings travelling out from the
  // centre point (brightness stays the same, only the colour turns).
  float hue = u_hue.x * sin(centreDistance / u_hue.y * 6.2831853 - u_time * u_hue.z);
  float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
  float chromaI = dot(rgb, vec3(0.596, -0.274, -0.322));
  float chromaQ = dot(rgb, vec3(0.211, -0.523, 0.312));
  float hueCos = cos(hue);
  float hueSin = sin(hue);
  float turnedI = chromaI * hueCos - chromaQ * hueSin;
  float turnedQ = chromaI * hueSin + chromaQ * hueCos;
  rgb = vec3(
    luma + 0.956 * turnedI + 0.621 * turnedQ,
    luma - 0.272 * turnedI - 0.647 * turnedQ,
    luma - 1.106 * turnedI + 1.703 * turnedQ
  );

  rgb = clamp(rgb, 0.0, alpha);

  // The background. Its alpha says what each pixel is: land (0), sky (0.12),
  // a sky ribbon (0.2-0.7, with its flow direction) or water (0.9). The
  // sky's bands flow like curtains and brighten where the curtains pass; the
  // land holds still; water glints. Then the rings and rays sit on top.
  vec4 stillSample = texture2D(u_base, clamp(position / u_size, 0.0, 1.0));
  bool isSky = stillSample.a > 0.08 && stillSample.a < 0.8;
  bool isWater = stillSample.a >= 0.8;
  vec2 basePosition = position;
  if (isSky) {
    basePosition = position + getAuroraFlow(position + u_worldOffset);
  }
  vec4 baseSample = texture2D(u_base, clamp(basePosition / u_size, 0.0, 1.0));
  // The sway never reaches across onto the land (that would smear the
  // skyline into the sky).
  if (!isSky || baseSample.a < 0.08 || baseSample.a >= 0.8) {
    baseSample = stillSample;
    basePosition = position;
  }
  vec3 background = baseSample.rgb;
  // Sky ribbons: stars stream along each one's flow (its direction comes
  // in the landscape's alpha).
  if (isSky && baseSample.a > 0.19 && baseSample.a < 0.75) {
    float flowAngle = ((baseSample.a - 0.2) / 0.5 - 0.5) * 6.2831853;
    vec2 along = vec2(cos(flowAngle), sin(flowAngle));
    vec2 world = basePosition + u_worldOffset;
    float ahead = dot(world, along);
    float across = dot(world, vec2(-along.y, along.x));
    // Stars streaming along the tunnel, each with a short trail behind it.
    vec2 lane = vec2(ahead / 16.0 - u_time * u_riverFlow, across / 8.0);
    vec2 cell = floor(lane);
    float star = getHash(cell + vec2(3.3, 7.1));
    if (star > 0.8) {
      vec2 spot = vec2(0.5, 0.2 + 0.6 * getHash(cell + vec2(8.2, 1.4)));
      vec2 offset = fract(lane) - spot;
      float trail = 0.0;
      if (offset.x < 0.0) {
        trail = smoothstep(-0.5, 0.0, offset.x);
      }
      float spark = smoothstep(0.12, 0.02, length(vec2(max(offset.x, 0.0) * 1.5, offset.y)));
      float glow = max(spark, trail * smoothstep(0.08, 0.0, abs(offset.y)) * 0.6);
      background = min(background + vec3(0.55, 0.7, 0.8) * glow, vec3(1.0));
    }
  }
  vec2 worldPosition = basePosition + u_worldOffset;
  if (isSky) {
    background = min(background * (1.0 + getAuroraGlow(worldPosition) * u_auroraLook.y), vec3(1.0));
    // Shimmer: fine vertical rays of light drift sideways over the sky.
    float shimmer = getNoise(vec2(worldPosition.x / 7.0 + u_time * 0.6, worldPosition.y / 180.0 - u_time * 0.15));
    background = min(background * (1.0 + (floor(shimmer * 3.0) / 2.0 - 0.4) * u_shimmer), vec3(1.0));
  }
  // The sun's height (the painting's own colours already follow the time of
  // day): a low sun glows redder.
  float sunHeight = u_sun.w;
  float daylight = smoothstep(-0.6, 0.35, sunHeight);
  float lowSun = (1.0 - smoothstep(0.0, 0.5, abs(sunHeight))) * daylight;
  float sunShown = smoothstep(-0.2, 0.02, sunHeight);
  float moonShown = u_moon.w;
  vec3 sunGold = vec3(1.0, 0.79, 0.3);
  vec3 sunWarm = mix(sunGold, vec3(0.95, 0.45, 0.17), lowSun);
  vec2 toMoon = position - u_moon.xy;
  float moonDistance = length(toMoon);
  vec2 toSun = position - u_sun.xy;
  float sunDistance = length(toSun);
  float sunRadius = u_sun.z;

  // Twilight: round sunrise and sunset the whole picture flushes with
  // colour (rosy pinks at sunrise, fiery reds at sunset), with a great glow
  // over the sky where the sun is going down or coming up; at night it all
  // sinks into a deep blue.
  float twilight = 1.0 - smoothstep(0.0, u_twilightSpan, abs(sunHeight + 0.04));
  float deepNight = smoothstep(0.1, -0.85, sunHeight);
  vec3 duskLow = mix(vec3(1.0, 0.32, 0.12), vec3(1.0, 0.26, 0.42), u_sunRising);
  vec3 duskHigh = mix(vec3(0.62, 0.16, 0.5), vec3(0.5, 0.22, 0.8), u_sunRising);
  float grey = dot(background, vec3(0.299, 0.587, 0.114));
  background = clamp(mix(vec3(grey), background, 1.0 + 0.7 * twilight * u_twilight.x), 0.0, 1.0);
  float upFromSun = max(u_sun.y - position.y, 0.0) / (sunRadius * 14.0);
  float glowReach = exp(-upFromSun * 1.1) * exp(-abs(toSun.x) / (sunRadius * 30.0));
  vec3 dusk = mix(duskLow, duskHigh, clamp(upFromSun, 0.0, 1.0));
  if (isSky) {
    // Screen blend, so the glow brightens without washing out the ink.
    float glow = twilight * u_twilight.y * (0.35 + 0.65 * glowReach);
    background = 1.0 - (1.0 - background) * (1.0 - dusk * glow);
  } else {
    // The land and water catch the light too (alpenglow), more gently.
    background = mix(background, background * (duskLow * 1.3 + 0.25), twilight * u_twilight.x * 0.45);
  }
  background = mix(background, background * vec3(0.5, 0.58, 0.95), deepNight * u_twilight.z);

  if (isWater) {
    // Glints: short flat streaks of light drifting across the water, and a
    // column of them under the sun.
    float glint = getNoise(vec2(worldPosition.x / 9.0 + u_time * 0.5, worldPosition.y / 1.5));
    glint *= getNoise(vec2(worldPosition.x / 40.0 - u_time * 0.2, worldPosition.y / 6.0));
    float sparkle = smoothstep(0.45, 0.6, glint);
    float column = exp(-abs(toSun.x) / (sunRadius * 0.9)) * step(u_sun.y, position.y) * sunShown;
    float moonColumn = exp(-abs(toMoon.x) / (u_moon.z * 0.9)) * step(u_moon.y, position.y) * moonShown;
    background = min(background + vec3(sparkle * u_waterGlints * max(daylight, 0.4)) + sunWarm * column * (0.12 + sparkle * 0.8) + vec3(0.75, 0.85, 1.0) * moonColumn * sparkle * 0.6, vec3(1.0));
  }

  // The sun: a sunburst of wavy rays and a warm glow, and its disc. It only
  // shows where there's sky in front of it (the land and water hide it), and
  // the sky ribbons pass in front of the disc.
  if (sunShown > 0.0) {
    background = min(background + sunWarm * exp(-sunDistance / (sunRadius * 4.0)) * 0.18 * sunShown, vec3(1.0));
    if (isSky) {
      float rayAngle = atan(toSun.y, toSun.x) + sin(sunDistance / (sunRadius * 1.8)) * 0.08 + u_time * 0.02;
      float ray = step(0.5, fract(rayAngle / 6.2831853 * 26.0));
      float reach = exp(-sunDistance / (sunRadius * 14.0)) * sunShown;
      background = mix(background, sunWarm, ray * reach * 0.35);
      background = mix(background, sunGold, exp(-sunDistance / (sunRadius * 2.7)) * 0.7 * sunShown);
      if (stillSample.a < 0.19) {
        if (sunDistance < sunRadius) {
          background = mix(background, mix(vec3(1.0, 0.97, 0.88), sunGold, smoothstep(0.0, sunRadius, sunDistance)), sunShown);
        }
        if (abs(sunDistance - sunRadius) < 1.3) {
          background = mix(background, vec3(0.04, 0.03, 0.08), 0.6 * sunShown);
        }
      }
    }
  }

  // The moon: a cool halo and a pale disc with a few craters, also only
  // where there's sky in front of it.
  if (moonShown > 0.0 && isSky) {
    // A softer halo by day, when the moon is a pale disc in a bright sky.
    background = mix(background, vec3(0.31, 0.75, 0.95), exp(-moonDistance / (u_moon.z * 3.7)) * (0.5 - 0.35 * daylight) * moonShown);
    if (stillSample.a < 0.19) {
      float crater = u_moon.z * 0.23;
      vec3 face = vec3(0.96, 0.95, 1.0);
      if (length(toMoon - vec2(-0.29, -0.19) * u_moon.z) < crater || length(toMoon - vec2(0.32, 0.26) * u_moon.z) < crater * 0.7) {
        face = vec3(0.95, 0.75, 0.9);
      }
      if (moonDistance < u_moon.z) {
        background = mix(background, face, moonShown);
      }
      if (abs(moonDistance - u_moon.z) < 1.3) {
        background = mix(background, vec3(0.04, 0.03, 0.08), 0.7 * moonShown);
      }
    }
  }
  gl_FragColor = vec4(rgb + background * (1.0 - alpha), 1.0);
}
`;

const TERRAIN_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_world;         // landscape px of the picture's top-left (x, y), landscape px per canvas px
uniform float u_seed;
uniform vec3 u_paint[17];
uniform vec4 u_land;          // ribbon size (px), ribbon half-width (px), ribbon ceiling (y px), ribbon fade (px)
uniform float u_riverSpacing; // field units between neighbouring ribbons
uniform vec4 u_layout;        // horizon (y px), shore (y px), scene width (px), valley width (px)
uniform vec4 u_ranges;        // far range height, near range height, hill height, tree spacing (px)
uniform vec3 u_probe;         // river map mode (getRiverProbe): landscape x, y of the corner, px per pixel (0 = off)
uniform vec3 u_day;           // landscape px per day, where x = 0 sits in the day, share of the day the sun is up
uniform float u_loop;         // the world repeats every this many landscape px sideways
uniform vec4 u_clearings[3];  // the places' clearings: middle x, floor y, half width, depth (px; half width 0 = none)
uniform vec4 u_clearingFronts[3]; // the patch in front of each that town.js paints the trees of: half width, depth (px)

#define SPACE u_paint[0]
#define INDIGO u_paint[1]
#define VIOLET u_paint[2]
#define MAGENTA u_paint[3]
#define ORANGE u_paint[4]
#define GOLD u_paint[5]
#define NIGHT_BLUE u_paint[6]
#define GLOW u_paint[7]
#define PASTEL_PINK u_paint[8]
#define PASTEL_MINT u_paint[9]
#define SNOW u_paint[10]
#define SNOW_PINK u_paint[11]
#define ROCK u_paint[12]
#define ROCK_DARK u_paint[13]
#define PINE u_paint[14]
#define PINE_LIGHT u_paint[15]
#define INK u_paint[16]

// Alpha tells the live layer what each pixel is: 0 = land, 0.12 = sky,
// 0.2-0.7 = sky ribbon (and which way it flows), 0.9 = water.
#define ALPHA_SKY 0.12
#define ALPHA_WATER 0.9

float getHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float getNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = getHash(cell);
  float b = getHash(cell + vec2(1.0, 0.0));
  float c = getHash(cell + vec2(0.0, 1.0));
  float d = getHash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float getFbm(vec2 p) {
  // Layered noise: big shapes plus smaller and smaller detail (0 to 1).
  float total = 0.0;
  float amount = 0.5;
  for (int i = 0; i < 4; i++) {
    total += getNoise(p) * amount;
    p = p * 2.03 + vec2(17.1, 9.3);
    amount *= 0.5;
  }
  return total / 0.9375;
}

// ---------- The loop ----------
// The world repeats every u_loop px sideways, seamlessly. Every pattern
// that changes along x is made to repeat with it: its size across is
// nudged so a whole number of its cells fit in one loop (getLoopUnit), and
// the cell numbers it hashes wrap round at that count. Positions themselves
// never wrap, so nothing jumps; the same cells just come round again.

float getLoopCells(float size) {
  // How many cells of about this size (px) fit in one loop.
  return max(1.0, floor(u_loop / size + 0.5));
}

float getWrapped(float cell, float cells) {
  // A whole cell number wrapped round to 0 .. cells-1. (Not mod(): a GPU's
  // rounded division can put an exact multiple on the wrong side.)
  return cell - cells * floor((cell + 0.5) / cells);
}

float getLoopUnit(float size) {
  // The nearest cell size to this that fits the loop exactly, px.
  return u_loop / getLoopCells(size);
}

vec2 getLoopPoint(vec2 w, float size) {
  // A landscape point in cells of about this size: x in looping cells, y as is.
  return vec2(w.x / getLoopUnit(size), w.y / size);
}

float getLoopNoise(vec2 p, float cells) {
  // getNoise that repeats every 'cells' along x.
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float left = getWrapped(cell.x, cells);
  float right = getWrapped(cell.x + 1.0, cells);
  float a = getHash(vec2(left, cell.y));
  float b = getHash(vec2(right, cell.y));
  float c = getHash(vec2(left, cell.y + 1.0));
  float d = getHash(vec2(right, cell.y + 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float getLoopFbm(vec2 p, float cells) {
  // getFbm that repeats every 'cells' along x (each layer is exactly twice
  // as fine across, so it repeats too).
  float total = 0.0;
  float amount = 0.5;
  for (int i = 0; i < 4; i++) {
    total += getLoopNoise(p, cells) * amount;
    p = vec2(p.x * 2.0, p.y * 2.03) + vec2(17.1, 9.3);
    cells *= 2.0;
    amount *= 0.5;
  }
  return total / 0.9375;
}

// ---------- Scenes along the panorama ----------
// Scene number n is centred on x = n * sceneWidth. Each has a valley notch
// and a river from it ("sunX" is the middle of the notch). The colours follow
// the time of day, which changes along x (u_day, matching the sun and moon
// the live layer draws).

float getSceneIndex(float x) {
  return floor(x / getLoopUnit(u_layout.z) + 0.5);
}

float getSceneNumber(float index) {
  // Which scene of the loop this is (scenes repeat each loop).
  return getWrapped(index, getLoopCells(u_layout.z));
}

float getSunX(float index) {
  float jitter = (getHash(vec2(getSceneNumber(index), 3.1 + u_seed)) - 0.5) * 0.24;
  if (getSceneNumber(index) == 0.0) {
    jitter = 0.08;   // the first scene's notch sits just right of where the orb starts
  }
  return (index + jitter) * getLoopUnit(u_layout.z);
}

vec3 getMood(float x) {
  // How much of each palette to use here: x = sunset, y = moonlit night,
  // z = pastel dawn. Dawn while the sun is rising, sunset while it's going
  // down (a mix of the two round midday), night while it's below the horizon.
  float day = fract(x / u_day.x + u_day.y);
  float up = u_day.z;
  float height = 0.0;
  if (day < up) {
    height = sin(3.14159265 * day / up);
  } else {
    height = -sin(3.14159265 * (day - up) / (1.0 - up));
  }
  float night = smoothstep(0.25, -0.55, height);
  // 0 at midnight, through sunrise, to 0.5 at midday, through sunset, to 1.
  float fromMidnight = fract(day - up - (1.0 - up) * 0.5);
  float morning = smoothstep(0.7, 0.3, fromMidnight);
  return vec3((1.0 - night) * (1.0 - morning), night, (1.0 - night) * morning);
}

vec3 getMoodColour(vec3 mood, vec3 sunset, vec3 night, vec3 dawn) {
  return sunset * mood.x + night * mood.y + dawn * mood.z;
}

vec3 getRamp(float t, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e) {
  // Five colours, evenly spaced from t = 0 to t = 1.
  float s = clamp(t, 0.0, 1.0) * 4.0;
  vec3 colour = mix(a, b, clamp(s, 0.0, 1.0));
  colour = mix(colour, c, clamp(s - 1.0, 0.0, 1.0));
  colour = mix(colour, d, clamp(s - 2.0, 0.0, 1.0));
  colour = mix(colour, e, clamp(s - 3.0, 0.0, 1.0));
  return colour;
}

// ---------- Sky ----------

vec3 getSkyBand(float up, vec3 mood) {
  // The sky's colour at a height above the horizon, for each mood, turning to
  // deep space high up.
  float t = pow(clamp(up / 4200.0, 0.0, 1.0), 0.75);
  vec3 sunset = getRamp(t, GOLD, ORANGE, MAGENTA, VIOLET, INDIGO);
  vec3 night = getRamp(t, GLOW, NIGHT_BLUE, mix(NIGHT_BLUE, INDIGO, 0.5), INDIGO, SPACE);
  vec3 dawn = getRamp(t, PASTEL_PINK, PASTEL_MINT, mix(GLOW, SNOW, 0.45), NIGHT_BLUE, INDIGO);
  vec3 colour = getMoodColour(mood, sunset, night, dawn);
  return mix(colour, SPACE, smoothstep(3200.0, 6500.0, up));
}

vec3 getSky(vec2 w, vec3 mood) {
  // Streaky bands of colour, stepped like brush strokes, with fine darker
  // strokes running through them.
  float up = u_layout.x - w.y;
  float wobble = (getLoopFbm(vec2(w.x / getLoopUnit(900.0), w.y / 160.0) + u_seed, getLoopCells(900.0)) - 0.5) * 320.0;
  float banded = up + wobble;
  float bandHeight = 140.0;
  float within = fract(banded / bandHeight);
  banded = (floor(banded / bandHeight) + smoothstep(0.7, 1.0, within)) * bandHeight;
  vec3 colour = getSkyBand(max(banded, 0.0), mood);
  float stroke = fract(getLoopFbm(vec2(w.x / getLoopUnit(700.0), w.y / 70.0) + u_seed + 4.0, getLoopCells(700.0)) * 7.0);
  colour *= 1.0 - 0.2 * smoothstep(0.08, 0.0, stroke) * smoothstep(-100.0, 400.0, up);
  return colour;
}

vec3 getSwirl(vec2 w, vec3 colour, float index, vec3 mood) {
  // A big spiral of sky in each scene, strongest at night, with ink lines.
  vec2 centre = vec2(
    getSunX(index) + (getHash(vec2(getSceneNumber(index), 5.5 + u_seed)) - 0.5) * 1800.0,
    u_layout.x - 1700.0 - getHash(vec2(getSceneNumber(index), 6.6 + u_seed)) * 700.0
  );
  vec2 rel = w - centre;
  float r = length(rel);
  float reach = exp(-r / 760.0) * (0.3 + 0.7 * mood.y);
  if (reach < 0.03) {
    return colour;
  }
  float angle = atan(rel.y, rel.x);
  float spiral = fract(angle / 6.2831853 * 2.0 - r / 240.0 + getLoopNoise(getLoopPoint(w, 320.0), getLoopCells(320.0)) * 0.35);
  vec3 light = getMoodColour(mood, mix(MAGENTA, GOLD, 0.35), GLOW, SNOW);
  if (spiral < 0.24) {
    colour = mix(colour, light, 0.5 * reach);
  }
  if (spiral < 0.025 || abs(spiral - 0.24) < 0.012) {
    colour = mix(colour, INK, 0.7 * reach);
  }
  return colour;
}

vec3 getStars(vec2 w, vec3 colour) {
  // Stars, more of them higher up and only where the sky is dark enough.
  float up = u_layout.x - w.y;
  float darkness = 1.0 - dot(colour, vec3(0.3, 0.55, 0.15));
  float amount = smoothstep(0.35, 0.85, darkness) * smoothstep(100.0, 900.0, up);
  if (amount <= 0.0) {
    return colour;
  }
  vec2 grid = getLoopPoint(w, 40.0);
  vec2 cell = floor(grid);
  cell.x = getWrapped(cell.x, getLoopCells(40.0));
  float star = getHash(cell + vec2(1.9, 7.3));
  float threshold = 0.95 - 0.05 * smoothstep(800.0, 3500.0, up);
  if (star < threshold) {
    return colour;
  }
  vec2 spot = 0.2 + 0.6 * vec2(getHash(cell + vec2(3.7, 0.4)), getHash(cell + vec2(8.1, 5.2)));
  vec2 offset = fract(grid) - spot;
  float size = 0.06 + 0.5 * (star - threshold);
  float glow = smoothstep(size, size * 0.3, length(offset));
  // The brightest ones get a four-pointed sparkle.
  if (star > 0.985) {
    float sparkle = smoothstep(0.03, 0.0, min(abs(offset.x), abs(offset.y))) * smoothstep(0.45, 0.0, length(offset));
    glow = max(glow, sparkle);
  }
  return mix(colour, mix(SNOW, GOLD, getHash(cell + vec2(2.2, 2.2)) * 0.4), glow * amount);
}

// ---------- Sky ribbons (the currents) ----------

vec2 getRiverField(vec2 w) {
  // The ribbon field: ribbons run along evenly spaced levels of one smooth
  // field (u_riverSpacing apart), so they wind everywhere and, being levels
  // of the same field, never cross. Returns the field value folded so the
  // nearest ribbon sits at 0.5, and the ribbon's half-width there (both in
  // field units). Ribbons taper away towards the ceiling, above the peaks.
  float v = getLoopFbm(getLoopPoint(w, u_land.x) + u_seed + 13.0, getLoopCells(u_land.x));
  float folded = 0.5 + (fract((v - 0.5) / u_riverSpacing + 0.5) - 0.5) * u_riverSpacing;
  float width = u_land.y * (0.7 + 0.6 * getLoopNoise(getLoopPoint(w, 2200.0) + 5.0, getLoopCells(2200.0)));
  width *= smoothstep(u_land.z, u_land.z - u_land.w, w.y);
  return vec2(folded, width);
}

float getRiverDistance(vec2 w) {
  // How far from the middle of the nearest ribbon, in ribbon half-widths
  // (below 1 = in the ribbon). The field's slope turns its value into px,
  // so every ribbon keeps a steady width wherever it goes.
  vec2 river = getRiverField(w);
  if (river.y < 0.001) {
    return 100.0;
  }
  float v = getLoopFbm(getLoopPoint(w, u_land.x) + u_seed + 13.0, getLoopCells(u_land.x));
  float right = getLoopFbm(getLoopPoint(w + vec2(6.0, 0.0), u_land.x) + u_seed + 13.0, getLoopCells(u_land.x));
  float down = getLoopFbm(getLoopPoint(w + vec2(0.0, 6.0), u_land.x) + u_seed + 13.0, getLoopCells(u_land.x));
  float slope = max(length(vec2(right - v, down - v)) / 6.0, 0.000001);
  return abs(river.x - 0.5) / slope / river.y;
}

float getFlowAngle(vec2 w) {
  // Which way the ribbon flows here, as 0-1 round the circle (along the
  // field's contour).
  float v = getLoopFbm(getLoopPoint(w, u_land.x) + u_seed + 13.0, getLoopCells(u_land.x));
  float right = getLoopFbm(getLoopPoint(w + vec2(8.0, 0.0), u_land.x) + u_seed + 13.0, getLoopCells(u_land.x));
  float down = getLoopFbm(getLoopPoint(w + vec2(0.0, 8.0), u_land.x) + u_seed + 13.0, getLoopCells(u_land.x));
  vec2 flow = vec2(-(down - v), right - v);
  return atan(flow.y, flow.x) / 6.2831853 + 0.5;
}

vec3 getRibbon(vec2 w, vec3 colour, float riverDistance, vec3 mood) {
  // A swirling band of colour like a painted brush stroke: stepped bands from
  // a dark middle out to bright edges, inked, with stars inside (the live
  // layer makes them stream along) and a soft halo round it.
  if (riverDistance > 1.6) {
    return colour;
  }
  vec3 body = getMoodColour(mood, MAGENTA, NIGHT_BLUE, mix(PASTEL_PINK, VIOLET, 0.25));
  vec3 bright = getMoodColour(mood, GOLD, GLOW, SNOW);
  if (riverDistance > 1.0) {
    float halo = 1.0 - (riverDistance - 1.0) / 0.6;
    return mix(colour, body, halo * halo * 0.4);
  }
  float band = floor(riverDistance * 4.0) / 3.0;
  vec3 ribbon = mix(mix(body, INDIGO, 0.45 - 0.3 * mood.z), bright, band * 0.75);
  vec2 cell = floor(getLoopPoint(w, 20.0));
  cell.x = getWrapped(cell.x, getLoopCells(20.0));
  float star = getHash(cell + vec2(6.6, 2.4));
  if (star > 0.82) {
    vec2 spot = 0.2 + 0.6 * vec2(getHash(cell + vec2(1.1, 9.9)), getHash(cell + vec2(7.7, 3.3)));
    float d = length(fract(getLoopPoint(w, 20.0)) - spot);
    ribbon = mix(ribbon, SNOW, smoothstep(0.16, 0.04, d) * (1.0 - band * 0.5));
  }
  if (fract(riverDistance * 4.0) < 0.07 && riverDistance > 0.2) {
    ribbon = mix(ribbon, INK, 0.45);
  }
  if (riverDistance > 0.9) {
    ribbon = INK;
  }
  return ribbon;
}

// ---------- Mountains ----------

float getRidge(float x, float scale, float seed) {
  // Sharp, ridged noise along a line (0 to 1): pointed peaks and craggy
  // shoulders.
  float total = 0.0;
  float amount = 0.5;
  float p = x / getLoopUnit(scale);
  float cells = getLoopCells(scale);
  for (int i = 0; i < 5; i++) {
    float n = getLoopNoise(vec2(p, seed + float(i) * 7.3), cells);
    float ridge = 1.0 - abs(n * 2.0 - 1.0);
    total += ridge * ridge * amount;
    p = p * 2.0 + 3.7;
    cells *= 2.0;
    amount *= 0.5;
  }
  return total / 0.97;
}

float getRangeTop(float x, float base, float height, float scale, float seed, float valleyDepth, float valleyWidth) {
  // The y of a range's skyline, dipping into a notch round each scene's sun.
  float sunX = getSunX(getSceneIndex(x));
  float valley = exp(-pow((x - sunX) / (u_layout.w * valleyWidth), 2.0));
  float ridge = getRidge(x, scale, seed + u_seed);
  return base - height * (0.2 + 0.8 * ridge) * (1.0 - valleyDepth * valley);
}

float getFarTop(float x) {
  return getRangeTop(x, u_layout.x + 20.0, u_ranges.x, 520.0, 11.0, 0.85, 0.6);
}

float getNearTop(float x) {
  return getRangeTop(x, u_layout.x + 170.0, u_ranges.y, 360.0, 23.0, 0.95, 0.9);
}

float getHillTop(float x) {
  return getRangeTop(x, u_layout.x + 370.0, u_ranges.z, 420.0, 57.0, 0.75, 1.3);
}

float getIsSnow(vec2 w, float top, float height) {
  // Snow down to a wavy snowline below the skyline, broken by dark rock
  // patches (1 = snow).
  float depth = w.y - top;
  float line = height * (0.28 + 0.3 * getLoopNoise(vec2(w.x / getLoopUnit(260.0), 1.5 + u_seed), getLoopCells(260.0)));
  // Rock streaks run down the slopes, slanting like the ridges.
  float rockPatch = getLoopFbm(vec2((w.x + depth * 0.6) / getLoopUnit(70.0), depth / 260.0) + u_seed + 21.0, getLoopCells(70.0));
  if (depth < line && rockPatch < 0.62) {
    return 1.0;
  }
  return 0.0;
}

float getIsLit(vec2 w, float top, float sunX, float rangeTopKind) {
  // Which faces catch the light (1) and which are in shade (0), flat like cut
  // paper. Each face takes the slope of the skyline up and to the left of it,
  // so the line between light and shade runs diagonally down from every
  // peak, like a ridge.
  float depth = w.y - top;
  float lean = 0.6 + 0.35 * (getLoopNoise(vec2(w.x / getLoopUnit(300.0), depth / 300.0) + u_seed, getLoopCells(300.0)) - 0.5);
  float x = w.x - depth * lean;
  float slope = 0.0;
  if (rangeTopKind < 0.5) {
    slope = getFarTop(x + 4.0) - getFarTop(x - 4.0);
  } else {
    slope = getNearTop(x + 4.0) - getNearTop(x - 4.0);
  }
  return step(0.0, sign(slope) * sign(sunX - x));
}

vec3 getMountain(vec2 w, float top, float slope, float height, vec3 mood, float sunX, float haze, float kind) {
  // One range: lit and shaded snow and rock in flat colours, inked along the
  // skyline and wherever snow meets rock or light meets shade, misty at its
  // foot and hazier the further away it is.
  float depth = w.y - top;
  float snow = getIsSnow(w, top, height);
  float lit = getIsLit(w, top, sunX, kind);
  vec3 snowLit = getMoodColour(mood, mix(SNOW, GOLD, 0.3), SNOW_PINK, SNOW);
  vec3 snowShade = getMoodColour(mood, mix(MAGENTA, VIOLET, 0.55), mix(ROCK, GLOW, 0.35), mix(SNOW, GLOW, 0.35));
  vec3 rockLit = getMoodColour(mood, mix(ORANGE, VIOLET, 0.45), ROCK, mix(ROCK, SNOW, 0.3));
  vec3 rockShade = getMoodColour(mood, mix(VIOLET, ROCK_DARK, 0.5), ROCK_DARK, ROCK * 0.8);
  vec3 colour = rockShade;
  if (snow > 0.5) {
    if (lit > 0.5) {
      colour = snowLit;
    } else {
      colour = snowShade;
    }
  } else if (lit > 0.5) {
    colour = rockLit;
  }
  vec3 mist = getSkyBand(150.0, mood);
  colour = mix(colour, mist, smoothstep(height * 0.5, height * 1.2, depth) * 0.55);

  float nextPixel = u_world.z * 1.5;
  float ink = 0.0;
  vec2 below = w + vec2(0.0, nextPixel);
  vec2 beside = w + vec2(nextPixel, 0.0);
  if (getIsSnow(below, top, height) != snow || getIsSnow(beside, top, height) != snow) {
    ink = 0.85;
  }
  if (getIsLit(below, top, sunX, kind) != lit || getIsLit(beside, top, sunX, kind) != lit) {
    ink = max(ink, 0.5);
  }
  if (depth < 1.3 * u_world.z * sqrt(1.0 + slope * slope)) {
    ink = 1.0;
  }
  colour = mix(colour, INK, ink);
  return mix(colour, getSkyBand(0.0, mood), haze);
}

// ---------- Forest, river and shore ----------

float getRiverX(float y, float sunX) {
  // Where the river is at a height: it winds out of the valley and swings
  // wider the nearer it comes.
  float along = max(y - (u_layout.x + 280.0), 0.0);
  float looped = mod(sunX, u_loop);   // the same river each time round the loop
  float swing = sin(along / 110.0 + looped * 0.001) * along * 0.45;
  float wander = (getNoise(vec2(along / 160.0, looped * 0.01)) - 0.5) * along * 0.5;
  return sunX + swing + wander;
}

float getRiverWidth(float y) {
  return 8.0 + max(y - (u_layout.x + 280.0), 0.0) * 0.11;
}

float getClearingAcross(float x, vec4 clearing) {
  // How far x is from the middle of a clearing, px (the nearest copy round
  // the loop).
  float dx = x - clearing.x;
  return abs(dx - u_loop * floor(dx / u_loop + 0.5));
}

float getIsInOneClearing(vec2 p, float ragged, vec4 clearing) {
  // 1 inside this clearing: within its half width (pulled in by up to
  // 'ragged' px, so the edge isn't a straight line) and between the floor
  // (and a little below it) and its depth up the hill.
  if (clearing.z <= 0.0) {
    return 0.0;
  }
  float across = getClearingAcross(p.x, clearing);
  if (across > clearing.z - ragged) {
    return 0.0;
  }
  // The top edge curves down towards the sides, like a dome cut into the trees.
  float top = clearing.y - clearing.w * sqrt(max(0.0, 1.0 - pow(across / clearing.z, 2.0)));
  if (p.y < top || p.y > clearing.y + 70.0) {
    return 0.0;
  }
  return 1.0;
}

float getIsInClearing(vec2 p, float ragged) {
  // 1 inside any of the places' clearings.
  for (int i = 0; i < 3; i++) {
    if (getIsInOneClearing(p, ragged, u_clearings[i]) > 0.5) {
      return 1.0;
    }
  }
  return 0.0;
}

float getIsInFrontOfPlace(float x, float base) {
  // 1 for a tree standing just in front of a place's building (town.js
  // paints those over the building).
  for (int i = 0; i < 3; i++) {
    vec4 clearing = u_clearings[i];
    vec4 front = u_clearingFronts[i];
    if (clearing.z > 0.0 && getClearingAcross(x, clearing) < front.x && base > clearing.y && base < clearing.y + front.y) {
      return 1.0;
    }
  }
  return 0.0;
}

vec4 getTrees(vec2 w, float hillTop, float sunX, vec3 mood) {
  // Rows of pines from the hilltops down to the shore, each row in front of
  // the one above it. A pine is a stack of three jagged tiers, dark, with a
  // lit edge on its sunny side and ink outlines; the back rows are a little
  // hazier. Trees keep out of the river. Returns the colour and 1 where a
  // tree covers the point.
  float spacing = getLoopUnit(u_ranges.w);
  float treeCells = getLoopCells(u_ranges.w);
  float rowStep = u_ranges.w * 1.3;
  float cellX = floor(w.x / spacing);
  // (Above the hilltops, start at the first rows: their tops reach up there.)
  float firstRow = max(-1.0, floor((w.y - hillTop) / rowStep) - 1.0);
  vec3 colour = vec3(0.0);
  float hit = 0.0;
  float frontBase = -1.0e9;
  vec3 lightTint = getMoodColour(mood, mix(PINE_LIGHT, ORANGE, 0.35), mix(PINE_LIGHT, GLOW, 0.4), mix(PINE_LIGHT, PASTEL_MINT, 0.4));
  vec3 haze = getSkyBand(200.0, mood);
  for (int r = 0; r < 5; r++) {
    float row = firstRow + float(r);
    if (row < 0.0) {
      continue;
    }
    for (int c = -1; c <= 1; c++) {
      vec2 id = vec2(cellX + float(c), row);
      vec2 tag = vec2(getWrapped(id.x, treeCells), row);   // repeats each loop
      float x = (id.x + 0.15 + 0.7 * getHash(tag + vec2(1.3, 0.0))) * spacing;
      float base = hillTop + (row + 0.3 + 0.5 * getHash(tag + vec2(7.7, 0.0))) * rowStep;
      if (base < w.y || base < frontBase) {
        continue;
      }
      float tall = spacing * (1.5 + 1.1 * getHash(tag + vec2(4.2, 0.0))) * (1.0 + row * 0.05);
      float up = base - w.y;
      if (up > tall) {
        continue;
      }
      float t = up / tall;
      float tier = fract(t * 3.0 + 0.15);
      float halfWidth = spacing * 0.62 * (1.0 - t) * (0.5 + 0.5 * (1.0 - tier));
      float dx = w.x - x;
      // A short trunk under the lowest tier.
      if (t < 0.08) {
        halfWidth = spacing * 0.07;
      }
      if (abs(dx) > halfWidth) {
        continue;
      }
      if (abs(x - getRiverX(base, sunX)) < getRiverWidth(base) + spacing * 0.3) {
        continue;
      }
      if (getIsInClearing(vec2(x, base), getHash(tag + vec2(9.1, 2.3)) * 90.0) > 0.5) {
        continue;   // the Work building's clearing
      }
      if (getIsInFrontOfPlace(x, base) > 0.5) {
        continue;   // in front of a building: town.js paints these, over it
      }
      frontBase = base;
      hit = 1.0;
      vec3 tree = mix(PINE, haze, 0.3 * exp(-row * 0.6));
      if (dx * sign(sunX - x) > halfWidth * 0.3) {
        tree = mix(tree, lightTint, 0.55);
      }
      if (halfWidth - abs(dx) < u_world.z * 1.1 || (tier < 0.05 && t > 0.08)) {
        tree = INK;
      }
      colour = tree;
    }
  }
  return vec4(colour, hit);
}

float getShoreY(float x) {
  return u_layout.y + (getLoopNoise(vec2(x / getLoopUnit(240.0), 9.1 + u_seed), getLoopCells(240.0)) - 0.5) * 60.0;
}

vec4 getBoulders(vec2 w, float sunX, vec3 mood) {
  // Rounded boulders along the shore: flat lit and shaded faces, inked.
  float spacing = getLoopUnit(170.0);
  float boulderCells = getLoopCells(170.0);
  float cellX = floor(w.x / spacing);
  vec3 colour = vec3(0.0);
  float hit = 0.0;
  float front = -1.0e9;
  vec3 lit = getMoodColour(mood, mix(ROCK, MAGENTA, 0.3), mix(ROCK, GLOW, 0.2), mix(ROCK, PASTEL_PINK, 0.35));
  for (int c = -1; c <= 1; c++) {
    float id = cellX + float(c);
    float tag = getWrapped(id, boulderCells);   // repeats each loop
    if (getHash(vec2(tag, 4.4)) > 0.75) {
      continue;
    }
    float x = (id + 0.2 + 0.6 * getHash(vec2(tag, 1.7))) * spacing;
    float radius = spacing * (0.25 + 0.4 * getHash(vec2(tag, 2.9)));
    float base = getShoreY(x) + 8.0;
    vec2 rel = (w - vec2(x, base)) / vec2(radius, radius * 0.8);
    if (rel.y > 0.0 || base < front) {
      continue;
    }
    float angle = atan(rel.y, rel.x);
    float d = length(rel) * (1.0 + 0.07 * sin(angle * 5.0 + tag));
    if (d > 1.0) {
      continue;
    }
    front = base;
    hit = 1.0;
    vec3 rock = ROCK_DARK;
    if (rel.x * sign(sunX - x) > -0.1 && rel.y < -0.25) {
      rock = lit;
    }
    if (d > 1.0 - 1.3 * u_world.z / radius) {
      rock = INK;
    }
    colour = rock;
  }
  return vec4(colour, hit);
}

vec4 getForest(vec2 w, float hillTop, float sunX, vec3 mood) {
  // Below the hilltops: forest floor, the river, trees, then shore boulders
  // and a few glinting reeds.
  vec3 colour = mix(PINE, ROCK_DARK, 0.45 + 0.25 * getLoopNoise(getLoopPoint(w, 60.0), getLoopCells(60.0)));
  // The places' clearings: a meadow a little lighter than the
  // forest floor, in two flat greens, with a ragged, painted edge that the
  // trees close in round.
  float wobble = (getLoopNoise(vec2(w.x / getLoopUnit(70.0), w.y / 60.0), getLoopCells(70.0)) - 0.5) * 110.0;
  vec2 meadowPoint = vec2(w.x, w.y - wobble * 0.4);
  if (getIsInClearing(meadowPoint, 50.0 - wobble) > 0.5) {
    vec3 grass = mix(colour, mix(PINE, PINE_LIGHT, 0.3), 0.75);
    vec3 grassLit = getMoodColour(mood, mix(PINE_LIGHT, ORANGE, 0.3), mix(PINE_LIGHT, GLOW, 0.35), mix(PINE_LIGHT, PASTEL_MINT, 0.4));
    float stripe = getLoopNoise(vec2(w.x / getLoopUnit(140.0), w.y / 30.0), getLoopCells(140.0));
    colour = stripe > 0.6 ? mix(grass, grassLit, 0.25) : grass;
  }
  float alpha = 0.0;
  float riverX = getRiverX(w.y, sunX);
  float riverWidth = getRiverWidth(w.y);
  float fromMiddle = abs(w.x - riverX);
  if (fromMiddle < riverWidth && w.y > hillTop + 20.0) {
    vec3 water = getMoodColour(mood, mix(GOLD, ORANGE, 0.3), GLOW, PASTEL_MINT);
    if (fromMiddle > riverWidth * 0.45) {
      water = mix(water, getMoodColour(mood, MAGENTA, NIGHT_BLUE, mix(GLOW, SNOW, 0.4)), 0.55);
    }
    if (fromMiddle > riverWidth - 1.2 * u_world.z) {
      water = INK;
    }
    colour = water;
    alpha = ALPHA_WATER;
  }
  if (abs(w.y - hillTop) < 1.3 * u_world.z) {
    colour = INK;
  }
  vec4 trees = getTrees(w, hillTop, sunX, mood);
  if (trees.a > 0.5) {
    colour = trees.rgb;
    alpha = 0.0;
  }
  float shore = getShoreY(w.x);
  if (w.y > shore - 34.0) {
    vec2 cell = floor(vec2(w.x / getLoopUnit(9.0), w.y / 30.0));
    cell.x = getWrapped(cell.x, getLoopCells(9.0));
    if (getHash(cell + vec2(3.3, 1.1)) > 0.86 && abs(fract(w.x / getLoopUnit(9.0)) - 0.5) < 0.12) {
      colour = mix(colour, getMoodColour(mood, GOLD, PINE_LIGHT, PINE_LIGHT), 0.7);
    }
  }
  vec4 boulders = getBoulders(w, sunX, mood);
  if (boulders.a > 0.5) {
    colour = boulders.rgb;
    alpha = 0.0;
  }
  return vec4(colour, alpha);
}

// ---------- Putting it together ----------

vec4 getLand(vec2 w) {
  // Everything above the lake: sky, mountains, hills and forest.
  float index = getSceneIndex(w.x);
  float sunX = getSunX(index);
  vec3 mood = getMood(w.x);
  // The front row of the forest stands up past the hilltops: their tops
  // are drawn over the mountains (or the sky) behind, not cut off by them.
  float hillTop = getHillTop(w.x);
  if (w.y < hillTop && w.y > hillTop - u_ranges.w * 3.5) {
    vec4 treeTops = getTrees(w, hillTop, sunX, mood);
    if (treeTops.a > 0.5) {
      return vec4(treeTops.rgb, 0.0);
    }
  }
  float farTop = getFarTop(w.x);
  if (w.y < farTop) {
    vec3 sky = getSky(w, mood);
    sky = getSwirl(w, sky, index, mood);
    sky = getStars(w, sky);
    float alpha = ALPHA_SKY;
    float riverDistance = getRiverDistance(w);
    if (riverDistance < 1.6) {
      sky = getRibbon(w, sky, riverDistance, mood);
      if (riverDistance < 1.0) {
        alpha = 0.2 + 0.5 * getFlowAngle(w);
      }
    }
    return vec4(sky, alpha);
  }
  float nearTop = getNearTop(w.x);
  if (w.y < nearTop) {
    float slope = (getFarTop(w.x + 4.0) - getFarTop(w.x - 4.0)) / 8.0;
    return vec4(getMountain(w, farTop, slope, u_ranges.x, mood, sunX, 0.3, 0.0), 0.0);
  }
  if (w.y < hillTop) {
    float slope = (getNearTop(w.x + 4.0) - getNearTop(w.x - 4.0)) / 8.0;
    return vec4(getMountain(w, nearTop, slope, u_ranges.y, mood, sunX, 0.1, 1.0), 0.0);
  }
  return getForest(w, hillTop, sunX, mood);
}

void main() {
  if (u_probe.z > 0.0) {
    // River map mode: each pixel reports the ribbon field's raw value (in
    // two bytes) and the ribbon's half-width, on a grid round the orb, so
    // extras.js can tell whether the orb is in a ribbon and which way it
    // flows without asking the GPU every frame (getRiverProbe).
    vec2 q = u_probe.xy + floor(gl_FragCoord.xy) * u_probe.z;
    float v = clamp(getLoopFbm(getLoopPoint(q, u_land.x) + u_seed + 13.0, getLoopCells(u_land.x)), 0.0, 0.99998);
    float width = getRiverField(q).y;
    gl_FragColor = vec4(floor(v * 255.0) / 255.0, fract(v * 255.0), width / 400.0, 1.0);
    return;
  }
  // Rows run top to bottom here, like the 2D canvas the main shader expects.
  vec2 w = u_world.xy + gl_FragCoord.xy * u_world.z;
  float shore = getShoreY(w.x);
  if (w.y <= shore) {
    gl_FragColor = getLand(w);
    return;
  }
  // The lake: a rippled, darker mirror of the mountains and sky (painted
  // reflections skip the forest), with light lines on the water and an
  // inked shoreline.
  float depth = w.y - shore;
  float ripple = sin(w.y / 9.0 + getLoopNoise(vec2(w.x / getLoopUnit(120.0), w.y / 40.0), getLoopCells(120.0)) * 6.0) * (2.0 + depth * 0.02);
  vec2 mirrored = vec2(w.x + ripple, u_layout.x + 150.0 - depth);
  vec3 colour = getLand(mirrored).rgb;
  colour = mix(colour * 0.8, INDIGO, 0.15 + smoothstep(0.0, 3000.0, depth) * 0.3);
  float line = fract(w.y / 16.0 + getLoopNoise(vec2(w.x / getLoopUnit(260.0), w.y / 50.0), getLoopCells(260.0)) * 1.5);
  if (line < 0.1) {
    colour = min(colour * 1.35, vec3(1.0));
  }
  if (depth < 1.3 * u_world.z) {
    colour = INK;
  }
  gl_FragColor = vec4(colour, ALPHA_WATER);
}
`;

const COPY_FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_old;
uniform vec2 u_size;
uniform vec2 u_offset;        // canvas px
void main() {
  gl_FragColor = texture2D(u_old, (gl_FragCoord.xy + u_offset) / u_size);
}
`;

function getCompiledShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Background shader failed:", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function setSwirlRenderer() {
  // Prepares WebGL once. Leaves swirlState.gl as null if it isn't available.
  const gl = swirlCanvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
  if (!gl) {
    return;
  }
  const vertexShader = getCompiledShader(gl, gl.VERTEX_SHADER, SWIRL_VERTEX_SHADER);
  const fragmentShader = getCompiledShader(gl, gl.FRAGMENT_SHADER, SWIRL_FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) {
    return;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.bindAttribLocation(program, 0, "a_position");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Background shader failed to link:", gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // One triangle that covers the whole canvas.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  const names = [
    "u_image", "u_size", "u_time", "u_seed", "u_swirl", "u_strength", "u_curl",
    "u_detail", "u_speed", "u_spin", "u_vortexSpeed", "u_vortex",
    "u_ripples", "u_rippleShape", "u_rippleStrength", "u_breathe", "u_hue", "u_split",
    "u_auroraShape", "u_auroraLook", "u_base", "u_auroraFlow", "u_worldOffset", "u_shimmer", "u_riverFlow",
    "u_waterGlints", "u_sun", "u_moon", "u_sunRising", "u_twilight", "u_twilightSpan",
  ];
  for (const name of names) {
    swirlState.uniforms[name] = gl.getUniformLocation(program, name);
  }

  swirlState.program = program;
  if (!setTerrainRenderer(gl)) {
    return;
  }
  gl.useProgram(program);
  swirlState.gl = gl;
  swirlState.texture = texture;
  // The live layer now paints the background too, so the still copy is hidden.
  document.body.classList.add("has-live-background");
}

// ---------- The landscape (WebGL) ----------
// Drawn once into a texture (u_base), then only the strip that scrolls into
// view is drawn when the world shifts: the rest is copied across.

function getLinkedProgram(gl, fragmentSource) {
  const vertexShader = getCompiledShader(gl, gl.VERTEX_SHADER, SWIRL_VERTEX_SHADER);
  const fragmentShader = getCompiledShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    return null;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.bindAttribLocation(program, 0, "a_position");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Background shader failed to link:", gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function getTerrainTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function setTerrainRenderer(gl) {
  // The landscape program, the copy program, two textures to swap between
  // and a framebuffer to draw into them.
  const terrain = getLinkedProgram(gl, TERRAIN_FRAGMENT_SHADER);
  const copy = getLinkedProgram(gl, COPY_FRAGMENT_SHADER);
  if (!terrain || !copy) {
    return false;
  }
  swirlState.terrainProgram = terrain;
  swirlState.copyProgram = copy;
  swirlState.terrainTextures = [getTerrainTexture(gl), getTerrainTexture(gl)];
  swirlState.framebuffer = gl.createFramebuffer();
  // A small target for the river map round the orb (getRiverProbe).
  swirlState.probeTexture = getTerrainTexture(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, RIVER_MAP.size, RIVER_MAP.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return true;
}

// The river field is read back from the GPU as a small map round the orb,
// only when the orb nears the edge of the last one. Reading from the GPU
// makes the page wait for everything the GPU is still drawing, which on
// phones took long enough to make the view jump, so it shouldn't happen
// every few frames.
const RIVER_MAP = {
  size: 160,               // pixels each way
  spacing: 32,             // landscape px between pixels (so ~5000 px across; wider spacing blurs the ribbons' edges)
  margin: 0.25,            // redraw once the orb is this share of the map from its edge
};

const riverMap = {
  ready: false,
  x: 0,                    // landscape px of pixel (0, 0)
  y: 0,
  values: new Float32Array(RIVER_MAP.size * RIVER_MAP.size),
  widths: new Float32Array(RIVER_MAP.size * RIVER_MAP.size),
};

function setRiverMap(x, y) {
  // Reads the ribbon field on a grid centred on landscape point (x, y).
  const gl = swirlState.gl;
  const size = RIVER_MAP.size;
  const half = (size - 1) / 2 * RIVER_MAP.spacing;
  riverMap.x = Math.round(x - half);
  riverMap.y = Math.round(y - half);
  gl.useProgram(swirlState.terrainProgram);
  const probeLocation = gl.getUniformLocation(swirlState.terrainProgram, "u_probe");
  gl.uniform3f(probeLocation, riverMap.x, riverMap.y, RIVER_MAP.spacing);
  gl.bindFramebuffer(gl.FRAMEBUFFER, swirlState.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, swirlState.probeTexture, 0);
  gl.viewport(0, 0, size, size);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const pixels = new Uint8Array(size * size * 4);
  gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.uniform3f(probeLocation, 0, 0, 0);
  setTerrainDone();
  for (let i = 0; i < size * size; i++) {
    riverMap.values[i] = (pixels[i * 4] + pixels[i * 4 + 1] / 255) / 255;
    riverMap.widths[i] = pixels[i * 4 + 2] / 255 * 400;
  }
  riverMap.ready = true;
}

function getRiverMapSample(list, x, y) {
  // A value from the map at landscape point (x, y), blended between pixels.
  const size = RIVER_MAP.size;
  const fx = Math.min(size - 1.001, Math.max(0, (x - riverMap.x) / RIVER_MAP.spacing));
  const fy = Math.min(size - 1.001, Math.max(0, (y - riverMap.y) / RIVER_MAP.spacing));
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const u = fx - i;
  const v = fy - j;
  const a = list[j * size + i];
  const b = list[j * size + i + 1];
  const c = list[(j + 1) * size + i];
  const d = list[(j + 1) * size + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function getRiverFolded(value) {
  // The field folded so the nearest ribbon sits at 0.5 (as in the shader).
  const spacing = BG.riverSpacing;
  const t = (value - 0.5) / spacing + 0.5;
  return 0.5 + (t - Math.floor(t) - 0.5) * spacing;
}

function getRiverProbe(pageX, pageY) {
  // The river field at a page point, from the landscape shader itself (via
  // the river map), so it matches what's drawn. Returns null without WebGL,
  // otherwise { inRiver, strength (0-1, strongest mid-stream), flowX, flowY
  // (unit), acrossX, acrossY (unit), offset (page px from the middle) }.
  const gl = swirlState.gl;
  if (!gl || !swirlState.ready) {
    return null;
  }
  const step = 30;
  const x = (swirlState.origin.x + pageX) / BG.zoom;
  const y = (swirlState.origin.y + pageY) / BG.zoom;
  const extent = (RIVER_MAP.size - 1) * RIVER_MAP.spacing;
  const edge = extent * RIVER_MAP.margin;
  if (!riverMap.ready || x < riverMap.x + edge || y < riverMap.y + edge || x > riverMap.x + extent - edge || y > riverMap.y + extent - edge) {
    setRiverMap(x, y);
  }
  const values = [
    getRiverFolded(getRiverMapSample(riverMap.values, x, y)),
    getRiverFolded(getRiverMapSample(riverMap.values, x + step, y)),
    getRiverFolded(getRiverMapSample(riverMap.values, x, y + step)),
  ];
  // Distances in landscape px: the field's value over its slope.
  const width = getRiverMapSample(riverMap.widths, x, y);
  const slopeX = values[1] - values[0];
  const slopeY = values[2] - values[0];
  const slope = Math.hypot(slopeX, slopeY);
  const result = { inRiver: false, strength: 0, flowX: 0, flowY: 0 };
  if (slope === 0) {
    return result;
  }
  const distance = Math.abs(values[0] - 0.5) / (slope / step);
  if (distance > width) {
    return result;
  }
  // The river runs along the field's contour: across its slope.
  result.inRiver = true;
  result.strength = 1 - distance / width;
  result.flowX = -slopeY / slope;
  result.flowY = slopeX / slope;
  // Which way is across the stream, and how far (page px, signed) the
  // point is from its middle along that direction.
  result.acrossX = slopeX / slope;
  result.acrossY = slopeY / slope;
  result.offset = (values[0] - 0.5) / (slope / step) * BG.zoom;
  return result;
}

function getWorldOrigin() {
  // World px of the page's top-left corner. The world is endless: as the orb
  // travels, the page is shifted along it (setBackgroundShift).
  setWorldOriginStart();
  return { x: swirlState.origin.x, y: swirlState.origin.y };
}

function setWorldOriginStart() {
  // The page's middle starts at world (0, 0).
  if (swirlState.origin === null) {
    const pageBox = backgroundPage.getBoundingClientRect();
    swirlState.origin = { x: -pageBox.width / 2, y: -pageBox.height / 2 };
  }
}

function setTerrainUniforms() {
  const gl = swirlState.gl;
  const program = swirlState.terrainProgram;
  gl.useProgram(program);
  const colours = [];
  for (const hex of BG.paintColours) {
    for (const value of getHexColour(hex)) {
      colours.push(value / 255);
    }
  }
  gl.uniform3fv(gl.getUniformLocation(program, "u_paint"), new Float32Array(colours));
  gl.uniform1f(gl.getUniformLocation(program, "u_seed"), (swirlSeed % 89) * 1.37);
  gl.uniform4f(gl.getUniformLocation(program, "u_land"), BG.riverSize, BG.riverWidth, BG.ribbonCeiling, BG.ribbonFade);
  gl.uniform1f(gl.getUniformLocation(program, "u_riverSpacing"), BG.riverSpacing);
  gl.uniform3f(gl.getUniformLocation(program, "u_day"), BG.dayWidth, BG.dayStart + swirlState.paintedDrift, BG.dayShare);
  gl.uniform1f(gl.getUniformLocation(program, "u_loop"), BG.dayWidth);
  const clearings = [];
  const fronts = [];
  for (let i = 0; i < 3; i++) {
    const clearing = BG.clearings[i];
    if (clearing) {
      clearings.push(clearing.x, BG.clearingFloor, clearing.halfWidth, clearing.depth);
      fronts.push(clearing.frontHalfWidth, BG.clearingFrontDepth, 0, 0);
    } else {
      clearings.push(0, 0, 0, 0);
      fronts.push(0, 0, 0, 0);
    }
  }
  gl.uniform4fv(gl.getUniformLocation(program, "u_clearings"), new Float32Array(clearings));
  gl.uniform4fv(gl.getUniformLocation(program, "u_clearingFronts"), new Float32Array(fronts));
  gl.uniform4f(gl.getUniformLocation(program, "u_layout"), BG.horizon, BG.shoreLevel, BG.sceneWidth, BG.valleyWidth);
  gl.uniform4f(gl.getUniformLocation(program, "u_ranges"), BG.farHeight, BG.midHeight, BG.hillHeight, BG.treeSpacing);
  // The landscape is measured in its own px: world px divided by the zoom,
  // so zooming out shows more of it.
  gl.uniform3f(
    gl.getUniformLocation(program, "u_world"),
    (swirlState.origin.x - BG.margin) / BG.zoom,
    (swirlState.origin.y - BG.margin) / BG.zoom,
    1 / (BG.swirlResolution * BG.zoom)
  );
  gl.useProgram(swirlState.program);
}

function setTerrainTarget(texture) {
  const gl = swirlState.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, swirlState.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.viewport(0, 0, swirlState.canvasWidth, swirlState.canvasHeight);
}

function setTerrainDone() {
  // Back to drawing on screen, with the landscape as u_base.
  const gl = swirlState.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.disable(gl.SCISSOR_TEST);
  gl.viewport(0, 0, swirlState.canvasWidth, swirlState.canvasHeight);
  gl.useProgram(swirlState.program);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, swirlState.terrainTextures[0]);
  gl.activeTexture(gl.TEXTURE0);
}

function setTerrain() {
  // Draws the whole landscape (on layout).
  const gl = swirlState.gl;
  for (const texture of swirlState.terrainTextures) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, swirlState.canvasWidth, swirlState.canvasHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  setTerrainUniforms();
  setTerrainTarget(swirlState.terrainTextures[0]);
  gl.useProgram(swirlState.terrainProgram);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  setTerrainDone();
}

function setTerrainShifted(shiftX, shiftY) {
  // The world moved by (shiftX, shiftY) canvas px: copy what's still in the
  // picture across, and draw only the strips that are new.
  const gl = swirlState.gl;
  const width = swirlState.canvasWidth;
  const height = swirlState.canvasHeight;
  const oldTexture = swirlState.terrainTextures[0];
  const newTexture = swirlState.terrainTextures[1];
  setTerrainTarget(newTexture);

  gl.useProgram(swirlState.copyProgram);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, oldTexture);
  gl.uniform1i(gl.getUniformLocation(swirlState.copyProgram, "u_old"), 1);
  gl.uniform2f(gl.getUniformLocation(swirlState.copyProgram, "u_size"), width, height);
  gl.uniform2f(gl.getUniformLocation(swirlState.copyProgram, "u_offset"), shiftX, shiftY);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  setTerrainUniforms();
  gl.useProgram(swirlState.terrainProgram);
  gl.enable(gl.SCISSOR_TEST);
  // A shift bigger than the picture just redraws all of it.
  shiftX = Math.max(-width, Math.min(width, shiftX));
  shiftY = Math.max(-height, Math.min(height, shiftY));
  const strips = [];
  if (shiftX > 0) {
    strips.push([width - shiftX, 0, shiftX, height]);
  } else if (shiftX < 0) {
    strips.push([0, 0, -shiftX, height]);
  }
  if (shiftY > 0) {
    strips.push([0, height - shiftY, width, shiftY]);
  } else if (shiftY < 0) {
    strips.push([0, 0, width, -shiftY]);
  }
  for (const strip of strips) {
    gl.scissor(strip[0], strip[1], strip[2], strip[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  swirlState.terrainTextures = [newTexture, oldTexture];
  setTerrainDone();
}

function getShiftStep() {
  // Shifts are whole multiples of this many page px, so they're whole canvas
  // pixels too and the copied landscape stays sharp (25 for 0.36).
  for (let step = 1; step <= 100; step++) {
    const pixels = step * BG.swirlResolution;
    if (Math.abs(pixels - Math.round(pixels)) < 0.000001) {
      return step;
    }
  }
  return 100;
}

function setBackgroundShift(dx, dy) {
  // Slides the world under the page by (dx, dy) page px (flight.js keeps the
  // orb near the middle of the page this way, so the world never ends).
  // Everything on the page moves back by the same amount, and flight.js
  // scrolls the view to match, so nothing visibly jumps.
  const centre = getCentrePagePoint();
  setWorldOriginStart();
  swirlState.origin.x += dx;
  swirlState.origin.y += dy;
  swirlState.centrePage = { x: centre.x - dx, y: centre.y - dy };
  swirlState.centre = { x: swirlState.centre.x - dx, y: swirlState.centre.y - dy };
  for (const ring of swirlState.rings) {
    ring.x -= dx;
    ring.y -= dy;
  }
  for (const group of swirlState.rayGroups) {
    group.x -= dx;
    group.y -= dy;
  }
  for (let slot = 0; slot < MAX_RIPPLES * 4; slot += 4) {
    swirlState.ripples[slot] -= dx * BG.swirlResolution;
    swirlState.ripples[slot + 1] -= dy * BG.swirlResolution;
  }
  if (!swirlState.ready) {
    return;
  }
  if (swirlState.gl) {
    setTerrainShifted(Math.round(dx * BG.swirlResolution), Math.round(dy * BG.swirlResolution));
    swirlState.gl.uniform4fv(swirlState.uniforms.u_ripples, swirlState.ripples);
    setVortexUniform();
    setWorldUniform();
  }
  // This frame is drawn before flight.js scrolls the view to match the
  // shift, so the page is still where it was on screen: the sun allows for
  // where it's about to be (setSunUniform).
  swirlState.pendingShift = { x: dx, y: dy };
  setSwirlFrame(getSeconds());
  swirlState.pendingShift = null;
}

function setBackgroundZoom(zoom) {
  // Changes BG.zoom while the page is running (zoom.js). The whole world
  // scales around the orb: the landscape under it stays put, everything else
  // in world px moves in or out by the same factor. Returns that factor, so
  // sun.js, hunt.js and extras.js can scale their own world px to match.
  const factor = zoom / BG.zoom;
  if (!isFinite(factor) || Math.abs(factor - 1) < 0.000001) {
    return 1;
  }
  for (const name of ZOOMED_SETTINGS) {
    BG[name] = BG[name] * factor;
  }
  BG.zoom = zoom;
  setWorldOriginStart();
  const orb = getCentrePagePoint();
  swirlState.origin.x = (swirlState.origin.x + orb.x) * factor - orb.x;
  swirlState.origin.y = (swirlState.origin.y + orb.y) * factor - orb.y;
  const centre = swirlState.centre;
  for (const ring of swirlState.rings) {
    ring.x = centre.x + (ring.x - centre.x) * factor;
    ring.y = centre.y + (ring.y - centre.y) * factor;
  }
  if (!swirlState.ready) {
    return factor;
  }
  if (swirlState.gl) {
    setTerrain();
    setSwirlUniforms();
  }
  setSwirlFrame(getSeconds());
  return factor;
}

function setWorldUniform() {
  // Where the picture sits in the world, so the live warp and the aurora
  // stay put in the world when it shifts.
  swirlState.gl.uniform2f(
    swirlState.uniforms.u_worldOffset,
    (swirlState.origin.x - BG.margin) * BG.swirlResolution,
    (swirlState.origin.y - BG.margin) * BG.swirlResolution
  );
}

function setVortexUniform() {
  // The vortex sits on the centre point.
  swirlState.gl.uniform4f(
    swirlState.uniforms.u_vortex,
    swirlState.centre.x * BG.swirlResolution,
    swirlState.centre.y * BG.swirlResolution,
    BG.vortexRadius * BG.swirlResolution,
    swirlState.vortexPhase
  );
}

function setSwirlUniforms() {
  // Settings that only change when the page is laid out again.
  const gl = swirlState.gl;
  const u = swirlState.uniforms;

  gl.viewport(0, 0, swirlState.canvasWidth, swirlState.canvasHeight);
  gl.uniform1i(u.u_image, 0);
  gl.uniform2f(u.u_size, swirlState.canvasWidth, swirlState.canvasHeight);
  gl.uniform1f(u.u_seed, (swirlSeed % 97) * 3.17);
  gl.uniform1f(u.u_swirl, BG.warpSwirlSize * BG.swirlResolution);
  gl.uniform1f(u.u_strength, BG.liveStrength * BG.swirlResolution);
  gl.uniform1f(u.u_curl, BG.warpCurl);
  gl.uniform1f(u.u_detail, BG.warpDetail);
  gl.uniform1f(u.u_speed, BG.liveSpeed);
  gl.uniform1f(u.u_spin, BG.vortexSpin);
  gl.uniform1f(u.u_vortexSpeed, BG.vortexSpeed);
  setVortexUniform();
  gl.uniform4f(
    u.u_rippleShape,
    BG.rippleSpeed * BG.swirlResolution,
    BG.rippleWavelength * BG.swirlResolution,
    BG.rippleWidth * BG.swirlResolution,
    BG.rippleLifetime
  );
  gl.uniform1f(u.u_rippleStrength, BG.rippleStrength * BG.swirlResolution);
  gl.uniform3f(
    u.u_breathe,
    BG.breatheWavelength * BG.swirlResolution,
    BG.breatheSpeed,
    BG.breatheStrength * BG.swirlResolution
  );
  gl.uniform3f(u.u_hue, BG.hueSwing, BG.hueWavelength * BG.swirlResolution, BG.hueSpeed);
  gl.uniform1f(u.u_split, BG.colourSplit * BG.swirlResolution);
  gl.uniform4f(
    u.u_auroraShape,
    Math.PI * 2 / (BG.auroraWave * BG.swirlResolution),
    BG.auroraSpeed,
    BG.auroraSway * BG.swirlResolution,
    BG.auroraPeriod * BG.swirlResolution
  );
  gl.uniform3f(u.u_auroraLook, BG.auroraEdge * BG.swirlResolution, BG.auroraStrength, BG.auroraSteps);
  gl.uniform1i(u.u_base, 1);
  gl.uniform1f(u.u_auroraFlow, BG.auroraFlow);
  gl.uniform1f(u.u_shimmer, BG.shimmer);
  gl.uniform1f(u.u_riverFlow, BG.riverFlow);
  gl.uniform1f(u.u_waterGlints, BG.waterGlints);
  setWorldUniform();
}

function getDayAt(pageX) {
  // Where in the day one spot of the landscape is (0 = sunrise, BG.dayShare =
  // sunset, back to 1 = the next sunrise).
  const x = (getWorldOrigin().x + pageX) / BG.zoom;
  const day = x / BG.dayWidth + BG.dayStart + swirlState.dayDrift;
  return day - Math.floor(day);
}

function getHeightInDay(day, upShare) {
  // 0 at rise, 1 at the highest, 0 at set, down to -1 and back (day 0-1),
  // up for upShare of the day.
  day = day - Math.floor(day);
  if (day < upShare) {
    return Math.sin(Math.PI * day / upShare);
  }
  return -Math.sin(Math.PI * (day - upShare) / (1 - upShare));
}

function setDayDrift(seconds) {
  // The day also turns slowly by itself, so the sun and moon keep creeping
  // up or down even when nothing moves. The sun follows it smoothly; the
  // landscape's colours catch up with a repaint now and then (a step too
  // small to see).
  if (reducedMotion.matches) {
    return;
  }
  swirlState.dayDrift = seconds / BG.dayDrift;
  if (Math.abs(swirlState.dayDrift - swirlState.paintedDrift) > BG.dayRepaint) {
    swirlState.paintedDrift = swirlState.dayDrift;
    setTerrain();
  }
}

function getLoopWorldWidth() {
  // The world repeats every this many world px sideways (BG.dayWidth in
  // landscape px). Used by hunt.js and extras.js too.
  return BG.dayWidth * BG.zoom;
}

function getNearestLoopX(worldX, nearX) {
  // The copy of a world x (one per trip round the loop) nearest to nearX.
  const loop = getLoopWorldWidth();
  return worldX + Math.round((nearX - worldX) / loop) * loop;
}

function getMorningAmount(pageX) {
  // 1 from midnight through sunrise, 0 from midday through sunset, easing
  // between (matches the terrain shader's getMood).
  const day = getDayAt(pageX);
  let fromMidnight = day - BG.dayShare - (1 - BG.dayShare) / 2;
  fromMidnight = fromMidnight - Math.floor(fromMidnight);
  const t = Math.min(1, Math.max(0, (0.7 - fromMidnight) / 0.4));
  return t * t * (3 - 2 * t);
}

function getSkyPlace(day, peakDay, upLength) {
  // Where something that's highest at peakDay and up for upLength of the
  // day appears from a spot whose time of day is 'day': its height (1 =
  // overhead, 0 = on the horizon, below 0 = set) and how far across the
  // screen it sits (0 = middle, +-1 = at the horizon, + = to the right,
  // the way the day side lies when it's still morning here).
  let towards = peakDay - day;
  towards = towards - Math.round(towards);
  const across = towards / (upLength / 2);
  return { height: getHeightInDay(day - (peakDay - upLength / 2), upLength), across: across };
}

function setSunUniform() {
  // The sun over the day side and the moon over the night side, as seen
  // from the middle of the screen (getSkyPlace). Their height is a real
  // height in the landscape, so flying up or down moves them on the screen
  // like the mountains (off it, if the orb goes far enough).
  const box = backgroundPage.getBoundingClientRect();
  const pageBox = { left: box.left, top: box.top };
  if (swirlState.pendingShift) {
    pageBox.left += swirlState.pendingShift.x;
    pageBox.top += swirlState.pendingShift.y;
  }
  const width = window.innerWidth;
  const viewX = width / 2 - pageBox.left;   // the middle of the screen, page px
  const day = getDayAt(viewX);
  const sun = getSkyPlace(day, BG.dayShare / 2, BG.dayShare);
  const height = sun.height;
  const screenX = width / 2 + sun.across * BG.sunSwing * width;
  swirlState.gl.uniform1f(swirlState.uniforms.u_sunRising, getMorningAmount(viewX));
  swirlState.gl.uniform3f(swirlState.uniforms.u_twilight, BG.twilightFlush, BG.twilightGlow, BG.nightDeepness);
  swirlState.gl.uniform1f(swirlState.uniforms.u_twilightSpan, BG.twilightSpan);
  const canvasX = (screenX - pageBox.left + BG.margin) * BG.swirlResolution;
  const originY = getWorldOrigin().y;
  const getCanvasY = function (rise) {
    const landscapeY = BG.sunLow + (BG.sunHigh - BG.sunLow) * rise;
    return (landscapeY * BG.zoom - originY + BG.margin) * BG.swirlResolution;
  };
  swirlState.gl.uniform4f(
    swirlState.uniforms.u_sun,
    canvasX, getCanvasY(height), BG.sunRadius * BG.zoom * BG.swirlResolution, height
  );
  // The moon: over the middle of the night side, up all night and a little
  // either side of it (BG.moonOverlap).
  const night = 1 - BG.dayShare;
  const moon = getSkyPlace(day, BG.dayShare + night / 2, night + 2 * BG.moonOverlap);
  const moonHeight = moon.height;
  const moonScreenX = width / 2 + moon.across * BG.sunSwing * width;
  const moonUp = Math.min(1, Math.max(0, (moonHeight + 0.2) / 0.22));
  swirlState.gl.uniform4f(
    swirlState.uniforms.u_moon,
    (moonScreenX - pageBox.left + BG.margin) * BG.swirlResolution,
    getCanvasY(moonHeight),
    BG.moonRadius * BG.zoom * BG.swirlResolution,
    moonUp * moonUp * (3 - 2 * moonUp)
  );
}

function setSwirlFrame(seconds) {
  // Draws the swirl layer for one moment in time.
  setSwirlSource(seconds);
  const gl = swirlState.gl;

  if (!gl) {
    // No WebGL: show a still, CPU-warped version instead.
    const context = swirlCanvas.getContext("2d");
    context.clearRect(0, 0, swirlCanvas.width, swirlCanvas.height);
    context.drawImage(swirlState.sourceCanvas, 0, 0);
    setWarp(context, getWarpMap(swirlCanvas.width, swirlCanvas.height, BG.swirlResolution), false);
    return;
  }

  setDayDrift(seconds);   // first: a repaint of the landscape rebinds textures
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, swirlState.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, swirlState.sourceCanvas);
  gl.uniform1f(swirlState.uniforms.u_time, seconds);
  setSunUniform();
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function getIsSwirlAnimating() {
  // True while the swirl layer is moving (WebGL available, no reduced motion).
  return swirlState.gl !== null && swirlState.ready && !reducedMotion.matches;
}

function setBackgroundRipple(clientX, clientY) {
  // Starts a wave in the swirl layer at a point on the screen. Called by
  // pointer-effects.js when the visitor clicks.
  if (!getIsSwirlAnimating()) {
    return;
  }
  const gl = swirlState.gl;
  const pageBox = backgroundPage.getBoundingClientRect();
  const slot = swirlState.nextRipple * 4;
  swirlState.ripples[slot] = (clientX - pageBox.left + BG.margin) * BG.swirlResolution;
  swirlState.ripples[slot + 1] = (clientY - pageBox.top + BG.margin) * BG.swirlResolution;
  swirlState.ripples[slot + 2] = getSeconds();
  swirlState.ripples[slot + 3] = 1;
  swirlState.nextRipple = (swirlState.nextRipple + 1) % MAX_RIPPLES;
  gl.uniform4fv(swirlState.uniforms.u_ripples, swirlState.ripples);
}

function setBackgroundCelebration(duration) {
  // Makes the colour waves flare for a while (hunt.js, when all are found).
  swirlState.celebrateUntil = getSeconds() + duration;
}

function setCelebrationColours(seconds) {
  // Swaps the colour-wave strength when a celebration starts or ends.
  const celebrating = seconds < swirlState.celebrateUntil;
  if (celebrating === swirlState.celebrating || !swirlState.gl) {
    return;
  }
  swirlState.celebrating = celebrating;
  let swing = BG.hueSwing;
  if (celebrating) {
    swing = BG.celebrateHueSwing;
  }
  swirlState.gl.uniform3f(swirlState.uniforms.u_hue, swing, BG.hueWavelength * BG.swirlResolution, BG.hueSpeed);
}

function getIsInsideBuilding() {
  // True while the visitor is inside the Work building (office.js), which
  // covers the whole screen: the world outside needn't be drawn then.
  return typeof getIsInOffice === "function" && getIsInOffice();
}

function getIsPlainView() {
  // True while the plain one-page view is showing (plain-view.js); the game
  // and its animations pause.
  return document.documentElement.classList.contains("is-plain");
}

// ---------- Lite mode ----------
// If the first couple of seconds of animation show the device can't keep up,
// the background switches to a lighter setting: fewer pixels, fewer frames,
// no shimmer. ?lite=1 in the address forces it (handy for testing).

function setLiteSettings() {
  BG.swirlResolution = BG.liteResolution;
  BG.fps = BG.liteFps;
  BG.shimmer = 0;
  swirlState.lite = true;
}

function setLiteMode() {
  setLiteSettings();
  console.info("Background: switched to lite mode for this device.");
  setPageBackground();
}

function setLiteModeCheck(now) {
  // Averages the gaps between drawn frames over the first 60 frames (ignoring
  // hidden-tab pauses); if they're much slower than BG.fps, goes lite.
  if (swirlState.lite || swirlState.liteChecked || document.visibilityState !== "visible") {
    return;
  }
  const gap = now - swirlState.lastFrameTime;
  if (swirlState.lastFrameTime === 0 || gap > 250) {
    return;
  }
  swirlState.liteSamples.push(gap);
  if (swirlState.liteSamples.length < 60) {
    return;
  }
  swirlState.liteChecked = true;
  let total = 0;
  for (const sample of swirlState.liteSamples) {
    total += sample;
  }
  if (total / swirlState.liteSamples.length > 1000 / BG.fps * BG.liteSlowness) {
    setLiteMode();
  }
}

function setSwirlAnimation(now) {
  // Runs every animation frame, drawing at most BG.fps times per second.
  swirlState.frame = requestAnimationFrame(setSwirlAnimation);
  if (now - swirlState.lastFrameTime < 1000 / BG.fps || getIsPlainView() || getIsInsideBuilding()) {
    return;
  }
  setLiteModeCheck(now);
  swirlState.lastFrameTime = now;
  const seconds = (now - swirlState.startTime) / 1000;
  setRingFlow(seconds);
  setCelebrationColours(seconds);
  setSwirlFrame(seconds);
}

function setSwirlMotion() {
  // Starts or stops the animation depending on the reduced-motion setting.
  cancelAnimationFrame(swirlState.frame);
  if (!swirlState.ready) {
    return;
  }
  if (!getIsSwirlAnimating()) {
    setSwirlFrame(getSeconds());
    return;
  }
  swirlState.frame = requestAnimationFrame(setSwirlAnimation);
}

// ---------- Putting it together ----------

function setPageBackground() {
  const pageBox = backgroundPage.getBoundingClientRect();
  const width = pageBox.width + 2 * BG.margin;
  const height = pageBox.height + 2 * BG.margin;
  const canvasWidth = Math.ceil(width * BG.resolution);
  const canvasHeight = Math.ceil(height * BG.resolution);
  const sections = [];
  for (const element of backgroundSections) {
    sections.push(getSectionInfo(element, pageBox.top));
  }

  setWorldOriginStart();

  // Without WebGL there's no landscape: the base canvas shows a still
  // tie-dye picture instead (gradient and blobs, warped once).
  if (!swirlState.gl) {
    const blobRandom = getSeededRandom(BG.seed);
    setCanvasSize(baseCanvas, canvasWidth, canvasHeight);
    setCanvasPlacement(baseCanvas);
    const base = getDrawingContext(baseCanvas, BG.resolution);
    setBaseGradient(base, sections, width, height);
    for (const section of sections) {
      setSectionBlobs(base, section, pageBox.width, blobRandom);
    }
    base.setTransform(1, 0, 0, 1, 0, 0);
    if (BG.warpStrength > 0) {
      setWarp(base, getWarpMap(canvasWidth, canvasHeight, BG.resolution), true);
    }
  }

  // Swirl canvas: the centre point, its rings and rays. The animation adds
  // rings, streams the rays and redraws the warp every frame.
  const swirlRandom = getSeededRandom(swirlSeed + 3000);
  const swirlWidth = Math.ceil(width * BG.swirlResolution);
  const swirlHeight = Math.ceil(height * BG.swirlResolution);
  setCanvasSize(swirlCanvas, swirlWidth, swirlHeight);
  setCanvasPlacement(swirlCanvas);
  setCanvasSize(swirlState.sourceCanvas, swirlWidth, swirlHeight);
  swirlState.canvasWidth = swirlWidth;
  swirlState.canvasHeight = swirlHeight;
  swirlState.pictureWidth = width;
  swirlState.pictureHeight = height;
  setCentreFromPage(pageBox.width, pageBox.height);

  const seconds = getSeconds();
  swirlState.rayLayout = getRayLayout(swirlRandom);
  swirlState.vortexPhase = swirlRandom() * Math.PI * 2;
  swirlState.rayGroups = [];
  setNewRayGroup(seconds - BG.rayFade);  // already fully faded in
  setPrefilledRings(seconds);

  if (swirlState.gl) {
    setSwirlUniforms();
    setTerrain();
  }
  swirlState.ready = true;
  setSwirlMotion();
}

// Redraw at most once per frame, and only when the page size really changed
// (for example on resize, or when the project filters change the page height).
let lastBackgroundSize = "";
let backgroundFrame = 0;

function setPageBackgroundSoon() {
  const box = backgroundPage.getBoundingClientRect();
  const size = Math.round(box.width) + "x" + Math.round(box.height);
  if (size === lastBackgroundSize) {
    return;
  }
  lastBackgroundSize = size;
  cancelAnimationFrame(backgroundFrame);
  backgroundFrame = requestAnimationFrame(setPageBackground);
}

if (new URLSearchParams(window.location.search).get("lite") === "1") {
  setLiteSettings();
}
setSwirlRenderer();
setPageBackgroundSoon();
window.addEventListener("load", setPageBackgroundSoon);
reducedMotion.addEventListener("change", setSwirlMotion);
if ("ResizeObserver" in window) {
  new ResizeObserver(setPageBackgroundSoon).observe(backgroundPage);
} else {
  window.addEventListener("resize", setPageBackgroundSoon);
}
