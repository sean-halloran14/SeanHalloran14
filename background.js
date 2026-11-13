// =============================================================================
// Tie-dye page background
// =============================================================================
// Two canvases sit behind the page content, both drawn at low resolution
// (BG.resolution and BG.swirlResolution) and scaled up by the browser.
//
// The background is a landscape (WebGL): a starry void with star streams
// winding through it, crystal gardens along their banks and asteroid belts
// further out, all kept apart. It's made from the world position, so the world never
// ends: flight.js keeps the orb near the middle of the page by sliding the
// world underneath (setBackgroundShift). The aurora flow and glow (7) move
// over it.
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
  auroraStrength: 0.45,    // how much the background brightens where curtains pass (0 = none)
  auroraFlow: 1,           // how far the background's bands sway (multiplies auroraSway)
  auroraPeriod: 950,       // height of one repeat of the curtains, px (they tile the world)
  auroraSway: 120,         // how far the curtains sway up and down, px
  auroraWave: 750,         // length of their waves across the page, px
  auroraSpeed: 0.35,       // how fast they sway
  auroraEdge: 70,          // softness of their bright lower edge, px
  auroraSteps: 4,          // flat brightness steps (0 = smooth glow)
  shimmer: 0.22,           // drifting vertical light rays over the landscape (0 = off)
  riverFlow: 1.6,          // how fast the stars stream along the star streams
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

  // Landscape: everything floats in a starry void (nebulae, light curtains,
  // stars). Star streams (glowing tunnels, their stars streaming along)
  // wind through it all; gardens of glowing green crystals line their
  // banks; belts of brown asteroids drift further out. Each keeps a buffer from the others, so
  // they never overlap. It's generated from the world position, so it goes
  // on forever.
  riverSize: 1700,         // how far apart the rivers wind, px (bigger = longer, lazier bends)
  riverWidth: 80,          // half the width of a river, px (it varies a little)
  riverSpacing: 0.27,      // how far apart neighbouring rivers are (in the river field's units)
  beltSize: 1500,          // size of the asteroid belts' shapes, px
  gardenSize: 900,         // size of the crystal gardens' shapes, px
  beltLevel: 0.5,          // higher = fewer, smaller asteroid belts (0-1)
  gardenShare: 0.5,        // how much crystal garden there is (0-1)
  asteroidSpacing: 90,     // distance between asteroids, px
  crystalSpacing: 120,     // distance between crystal clusters, px
  cloudSize: 650,          // distance between the void's light curtains, px
  cloudShare: 0.4,         // share of the void with light curtains (0-1)
  landColours: [           // order matters (the shader's NAVY, SKY_DEEP, ...)
    "--navy", "--sky-deep", "--sky", "--sky-light",
    "--forest-deep", "--forest", "--olive",
    "--brown-deep", "--brown", "--earth", "--tan-dark", "--ink",
  ],

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
    setExtrasDrawn(context, seconds);   // black holes and stardust (extras.js)
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
uniform float u_riverFlow;    // how fast the streaks run along the rivers

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

  // The background: its own bands flow like curtains and brighten where the
  // curtains pass, then the rings and rays sit on top.
  vec2 basePosition = position + getAuroraFlow(position + u_worldOffset);
  vec4 baseSample = texture2D(u_base, clamp(basePosition / u_size, 0.0, 1.0));
  vec3 background = baseSample.rgb;
  // Star streams: stars stream along each one's flow (its direction comes
  // in the landscape's alpha).
  if (baseSample.a > 0.06) {
    float flowAngle = ((baseSample.a - 0.04) / 0.96 - 0.5) * 6.2831853;
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
  background = min(background * (1.0 + getAuroraGlow(basePosition + u_worldOffset) * u_auroraLook.y), vec3(1.0));
  // Shimmer: fine vertical rays of light drift sideways over everything.
  vec2 worldPosition = basePosition + u_worldOffset;
  float shimmer = getNoise(vec2(worldPosition.x / 7.0 + u_time * 0.6, worldPosition.y / 180.0 - u_time * 0.15));
  background = min(background * (1.0 + (floor(shimmer * 3.0) / 2.0 - 0.4) * u_shimmer), vec3(1.0));
  gl_FragColor = vec4(rgb + background * (1.0 - alpha), 1.0);
}
`;

const TERRAIN_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_world;         // world px of the picture's top-left (x, y), world px per canvas px
uniform float u_seed;
uniform vec3 u_colours[12];
uniform vec4 u_land;          // stream size (px), stream half-width (px), belt size (px), garden size (px)
uniform float u_riverSpacing; // field units between neighbouring rivers
uniform vec4 u_features;      // belt level, garden share, asteroid spacing (px), crystal spacing (px)
uniform vec2 u_sky;           // curtain spacing (px), curtain share
uniform vec3 u_probe;         // probe mode (extras.js): landscape x, y, step (0 = off)

#define NAVY u_colours[0]
#define SKY_DEEP u_colours[1]
#define SKY u_colours[2]
#define SKY_LIGHT u_colours[3]
#define FOREST_DEEP u_colours[4]
#define FOREST u_colours[5]
#define OLIVE u_colours[6]
#define BROWN_DEEP u_colours[7]
#define BROWN u_colours[8]
#define EARTH u_colours[9]
#define TAN_DARK u_colours[10]
#define INK u_colours[11]

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

vec2 getRiverField(vec2 w) {
  // The river field: rivers run along evenly spaced levels of one smooth
  // field (u_riverSpacing apart), so they wind everywhere and, being levels
  // of the same field, never cross. Returns the field value folded so the
  // nearest river sits at 0.5, and the river's half-width there (both in
  // field units).
  float v = getFbm(w / u_land.x + u_seed + 13.0);
  float folded = 0.5 + (fract((v - 0.5) / u_riverSpacing + 0.5) - 0.5) * u_riverSpacing;
  float width = u_land.y * (0.7 + 0.6 * getNoise(w / 2200.0 + 5.0));
  return vec2(folded, width);
}

float getRiverDistance(vec2 w) {
  // How far from the middle of the nearest river, in river half-widths
  // (below 1 = in the river). The field's slope turns its value into px,
  // so every river keeps a steady width wherever it goes.
  vec2 river = getRiverField(w);
  float v = getFbm(w / u_land.x + u_seed + 13.0);
  float right = getFbm((w + vec2(6.0, 0.0)) / u_land.x + u_seed + 13.0);
  float down = getFbm((w + vec2(0.0, 6.0)) / u_land.x + u_seed + 13.0);
  float slope = max(length(vec2(right - v, down - v)) / 6.0, 0.000001);
  return abs(river.x - 0.5) / slope / river.y;
}

float getBeltShare(vec2 w, float riverDistance) {
  // How much this spot belongs to an asteroid belt (0 to 1). Belts run
  // along the spines between star streams, well clear of them, with crystal
  // gardens in between.
  float field = getFbm(w / u_land.z + u_seed + 91.0);
  float range = smoothstep(u_features.x - 0.03, u_features.x + 0.03, field);
  return range * smoothstep(2.1, 2.6, riverDistance);
}

float getGardenShare(vec2 w, float riverDistance) {
  // How much this spot belongs to a crystal garden (0 to 1). Gardens like
  // to line the star streams (but never sit in them) and stop short of the
  // asteroid belts, leaving open space between.
  float field = getFbm(w / u_land.w + u_seed + 71.0);
  float nearRiver = 0.25 * exp(-max(0.0, riverDistance - 1.6) / 0.8);
  float wood = smoothstep(0.45, 0.6, field + nearRiver + u_features.y - 0.5);
  float mountainField = getFbm(w / u_land.z + u_seed + 91.0);
  float clearOfMountains = 1.0 - smoothstep(u_features.x - 0.1, u_features.x - 0.05, mountainField);
  return wood * smoothstep(1.35, 1.9, riverDistance) * clearOfMountains;
}

float getRays(vec2 w, float seed) {
  // Fine vertical light rays, like the streaks in a northern-lights curtain (0 to 1).
  return getNoise(vec2(w.x / 16.0 + seed, w.y / 520.0));
}

float getCurtains(vec2 w, float spacing, float seed) {
  // Wavy curtains of light (0 to 1): each has a bright lower edge, fades
  // upward and is streaked with rays.
  float wave = w.y / spacing + (getFbm(vec2(w.x / (spacing * 2.4) + seed, seed * 1.7)) - 0.5) * 3.5;
  float f = fract(wave);
  float curtain = pow(f, 2.5) * (1.0 - smoothstep(0.92, 1.0, f));
  return curtain * (0.4 + 0.6 * getRays(w, seed * 9.0));
}

vec3 getSpace(vec2 w) {
  // The open void everything floats in: near-black blue with faint nebulae,
  // drifting blue curtains of light, and scattered stars.
  float nebula = getFbm(w / 1800.0 + u_seed + 31.0);
  vec3 colour = mix(NAVY * 0.3, NAVY * 0.85, smoothstep(0.35, 0.75, nebula));
  colour = mix(colour, SKY_DEEP * 0.7, smoothstep(0.58, 0.8, getFbm(w / 900.0 + u_seed + 44.0)) * 0.5);
  float reach = smoothstep(1.0 - u_sky.y - 0.2, 1.0 - u_sky.y + 0.15, getFbm(w / 2400.0 + u_seed + 11.0));
  float glow = getCurtains(w, u_sky.x, 1.0) * reach;
  colour = mix(colour, mix(SKY_DEEP, FOREST, 0.3), glow * 0.55);
  vec2 grid = w / 46.0;
  vec2 cell = floor(grid);
  float star = getHash(cell + vec2(1.9, 7.3));
  if (star > 0.9) {
    vec2 spot = 0.2 + 0.6 * vec2(getHash(cell + vec2(3.7, 0.4)), getHash(cell + vec2(8.1, 5.2)));
    float d = length(fract(grid) - spot);
    float radius = 0.08 + 0.8 * (star - 0.9);
    colour = mix(colour, mix(SKY_LIGHT, vec3(1.0), 0.5), smoothstep(radius, radius * 0.2, d));
  }
  return colour;
}

vec3 getDust(vec2 w) {
  // The haze of an asteroid belt: warm brown dust, grainy, with fine
  // pebbles glinting in it.
  float grain = getFbm(w / 260.0 + u_seed + 91.0);
  vec3 colour = mix(BROWN_DEEP * 0.75, BROWN, grain * 0.7);
  vec2 cell = floor(w / 14.0);
  if (getHash(cell + vec2(5.3, 1.7)) > 0.93) {
    colour = mix(colour, TAN_DARK, 0.6);
  }
  return colour;
}

vec3 getGardenGlow(vec2 w) {
  // The light around a crystal garden: a soft green haze with tiny glints.
  float haze = getFbm(w / 500.0 + u_seed + 71.0);
  vec3 colour = mix(FOREST_DEEP * 0.7, FOREST, haze * 0.6);
  vec2 cell = floor(w / 18.0);
  if (getHash(cell + vec2(2.9, 8.3)) > 0.95) {
    colour = mix(colour, OLIVE, 0.7);
  }
  return colour;
}

vec2 getScatterPoint(vec2 id, float spacing) {
  // One scattered spot per grid square, in landscape px.
  return (id + 0.2 + 0.6 * vec2(getHash(id), getHash(id + vec2(4.1, 2.3)))) * spacing;
}

vec3 getAsteroids(vec2 w, vec3 ground) {
  // Lumpy rocks drifting in the belts: lit from the top left in three flat
  // brown-to-tan bands, with a crater or two, a glowing tan rim and a soft
  // halo. Thickest in the middle of a belt. Lower ones sit in front.
  float spacing = u_features.z;
  vec2 cell = floor(w / spacing);
  float front = -1.0e9;
  vec3 colour = ground;
  float glowWidth = 3.0 * u_world.z;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 id = cell + vec2(float(x), float(y));
      vec2 centre = getScatterPoint(id, spacing);
      float roll = getHash(id + vec2(9.7, 6.1));
      if (getBeltShare(centre, getRiverDistance(centre)) < 0.5 + roll * 0.7) {
        continue;
      }
      float size = spacing * (0.08 + 0.36 * pow(getHash(id + vec2(2.2, 8.8)), 1.6));
      vec2 rel = w - centre;
      float angle = atan(rel.y, rel.x);
      float radius = size * (1.0 + 0.18 * sin(angle * 3.0 + roll * 20.0) + 0.1 * sin(angle * 5.0 + roll * 7.0));
      float d = length(rel);
      float edge = radius - d;
      if (edge < -glowWidth * 2.0) {
        continue;
      }
      vec3 rock = TAN_DARK;
      float cover = 0.0;
      if (edge >= 0.0) {
        float light = dot(rel / max(d, 0.001), vec2(-0.7071)) * (d / radius);
        rock = mix(BROWN_DEEP, BROWN, 0.6);
        if (light > -0.1) {
          rock = mix(BROWN, EARTH, 0.6);
        }
        if (light > 0.45) {
          rock = mix(EARTH, TAN_DARK, 0.5);
        }
        // A crater.
        vec2 crater = rel - size * 0.35 * vec2(cos(roll * 30.0), sin(roll * 30.0));
        if (length(crater) < size * 0.28) {
          rock = mix(rock, BROWN_DEEP, 0.55);
        }
        cover = 0.92;
        if (edge < glowWidth * 0.7) {
          rock = mix(rock, TAN_DARK, 0.5);
        }
      } else {
        cover = 0.18 * (1.0 + edge / (glowWidth * 2.0));
      }
      if (centre.y > front) {
        front = centre.y;
      } else {
        cover = cover * 0.7;
      }
      colour = mix(colour, rock, cover);
    }
  }
  return colour;
}

vec3 getCrystalShard(vec2 rel, float tilt, float width, float tall, vec3 colour, float glowWidth) {
  // One glowing crystal shard standing on its base, leaning by tilt: a
  // pointed column with a light left face, a darker right face, a bright
  // centre line and a glowing edge, brightest towards the tip.
  float c = cos(tilt);
  float s = sin(tilt);
  vec2 local = vec2(c * rel.x + s * rel.y, -s * rel.x + c * rel.y);
  float up = -local.y / tall;
  if (up < 0.0 || up > 1.0) {
    return colour;
  }
  float halfWidth = width * 0.5 * min(1.0, (1.0 - up) * tall / (width * 0.9));
  float edge = halfWidth - abs(local.x);
  if (edge < -glowWidth * 1.5) {
    return colour;
  }
  if (edge < 0.0) {
    return mix(colour, OLIVE, 0.4 * (1.0 + edge / (glowWidth * 1.5)));
  }
  vec3 shard = mix(FOREST, OLIVE, 0.25 + 0.5 * up);
  if (local.x > 0.0) {
    shard = mix(shard, FOREST_DEEP, 0.45);
  }
  if (abs(local.x) < glowWidth * 0.5) {
    shard = mix(shard, SKY_LIGHT, 0.35);
  }
  if (edge < glowWidth || up > 0.88) {
    shard = mix(shard, mix(OLIVE, SKY_LIGHT, 0.3), 0.75);
  }
  return mix(colour, shard, 0.82);
}

vec3 getCrystals(vec2 w, vec3 ground) {
  // Crystal gardens: clusters of three glowing green shards fanning out
  // from one spot. Lower clusters sit in front.
  float spacing = u_features.w;
  vec2 cell = floor(w / spacing);
  vec3 colour = ground;
  float glowWidth = 2.5 * u_world.z;
  for (int y = -1; y <= 2; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 id = cell + vec2(float(x), float(y));
      vec2 base = getScatterPoint(id, spacing);
      if (getGardenShare(base, getRiverDistance(base)) < 0.5 || getHash(id + vec2(4.4, 0.7)) > 0.7) {
        continue;
      }
      float roll = getHash(id + vec2(9.7, 6.1));
      float width = spacing * (0.16 + 0.08 * roll);
      float tall = spacing * (0.7 + 0.5 * getHash(id + vec2(1.3, 5.5)));
      vec2 rel = w - base;
      colour = getCrystalShard(rel + vec2(width * 0.6, 0.0), -0.45, width * 0.8, tall * 0.65, colour, glowWidth);
      colour = getCrystalShard(rel - vec2(width * 0.6, 0.0), 0.4, width * 0.8, tall * 0.7, colour, glowWidth);
      colour = getCrystalShard(rel, -0.05 + roll * 0.1, width, tall, colour, glowWidth);
    }
  }
  return colour;
}

vec3 getRiver(vec2 w, vec3 ground, float riverDistance) {
  // A star stream: a tunnel through space with bright glowing walls that
  // fall away into a deep, dark middle, faint rings of light round its
  // walls, and dense stars inside (the live layer makes them stream along).
  if (riverDistance > 1.7) {
    return ground;
  }
  if (riverDistance > 1.0) {
    float halo = 1.0 - (riverDistance - 1.0) / 0.7;
    return mix(ground, mix(SKY_DEEP, SKY, 0.4), halo * halo * 0.55);
  }
  float wall = pow(riverDistance, 2.2);
  vec3 tunnel = mix(NAVY * 0.25, SKY_DEEP, wall);
  tunnel = mix(tunnel, SKY, max(0.0, wall - 0.45) * 1.1);
  float rings = fract(riverDistance * 5.0);
  tunnel = mix(tunnel, mix(SKY, SKY_LIGHT, 0.3), smoothstep(0.9, 1.0, rings) * wall * 0.5);
  vec2 cell = floor(w / 20.0);
  float star = getHash(cell + vec2(6.6, 2.4));
  if (star > 0.8) {
    vec2 spot = 0.2 + 0.6 * vec2(getHash(cell + vec2(1.1, 9.9)), getHash(cell + vec2(7.7, 3.3)));
    float d = length(fract(w / 20.0) - spot);
    tunnel = mix(tunnel, mix(SKY_LIGHT, vec3(1.0), 0.5), smoothstep(0.16, 0.04, d) * (1.0 - wall * 0.5));
  }
  if (riverDistance > 0.86) {
    tunnel = mix(tunnel, SKY_LIGHT, 0.6);
  }
  return tunnel;
}

float getFlowAngle(vec2 w) {
  // Which way the river flows here, as 0-1 round the circle (along the
  // field's contour).
  float v = getFbm(w / u_land.x + u_seed + 13.0);
  float right = getFbm((w + vec2(8.0, 0.0)) / u_land.x + u_seed + 13.0);
  float down = getFbm((w + vec2(0.0, 8.0)) / u_land.x + u_seed + 13.0);
  vec2 flow = vec2(-(down - v), right - v);
  return atan(flow.y, flow.x) / 6.2831853 + 0.5;
}

void main() {
  if (u_probe.z > 0.0) {
    // Probe mode: three pixels report the river field at a point and a step
    // to its right and below, so extras.js can tell whether the orb is in a
    // river and which way it flows.
    vec2 q = u_probe.xy;
    if (gl_FragCoord.x > 1.0) {
      q.x += u_probe.z;
    }
    if (gl_FragCoord.x > 2.0) {
      q = u_probe.xy + vec2(0.0, u_probe.z);
    }
    vec2 river = getRiverField(q);
    gl_FragColor = vec4(floor(river.x * 255.0) / 255.0, fract(river.x * 255.0), river.y / 400.0, 1.0);
    return;
  }
  // Rows run top to bottom here, like the 2D canvas the main shader expects.
  // Everything floats in open space. Star streams wind through it all;
  // crystal gardens line their banks; asteroid belts keep further away.
  // None overlap: each has a buffer from the others.
  vec2 w = u_world.xy + gl_FragCoord.xy * u_world.z;
  float riverDistance = getRiverDistance(w);
  float beltShare = getBeltShare(w, riverDistance);
  float gardenShare = getGardenShare(w, riverDistance);

  vec3 colour = getSpace(w);
  if (gardenShare > 0.0) {
    colour = mix(colour, getGardenGlow(w), gardenShare * 0.55);
  }
  if (beltShare > 0.0) {
    colour = mix(colour, getDust(w), beltShare * 0.6);
  }
  if (riverDistance > 1.2) {
    colour = getCrystals(w, colour);
    colour = getAsteroids(w, colour);
  }
  colour = getRiver(w, colour, riverDistance);

  // Alpha carries the river's flow direction to the live layer (0 = no river).
  float flowAlpha = 0.0;
  if (riverDistance < 1.0) {
    flowAlpha = 0.04 + 0.96 * getFlowAngle(w);
  }
  gl_FragColor = vec4(colour, flowAlpha);
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
  // A 3 x 1 target for probing the river field (getRiverProbe).
  swirlState.probeTexture = getTerrainTexture(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 3, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return true;
}

function getRiverProbe(pageX, pageY) {
  // Reads the river field at a page point from the landscape shader itself,
  // so it matches what's drawn. Returns null without WebGL, otherwise
  // { inRiver, strength (0-1, strongest mid-stream), flowX, flowY (unit),
  //   acrossX, acrossY (unit), offset (page px from the middle) }.
  const gl = swirlState.gl;
  if (!gl || !swirlState.ready) {
    return null;
  }
  const step = 30;
  const x = (swirlState.origin.x + pageX) / BG.zoom;
  const y = (swirlState.origin.y + pageY) / BG.zoom;
  gl.useProgram(swirlState.terrainProgram);
  const probeLocation = gl.getUniformLocation(swirlState.terrainProgram, "u_probe");
  gl.uniform3f(probeLocation, x, y, step);
  gl.bindFramebuffer(gl.FRAMEBUFFER, swirlState.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, swirlState.probeTexture, 0);
  gl.viewport(0, 0, 3, 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const pixels = new Uint8Array(12);
  gl.readPixels(0, 0, 3, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.uniform3f(probeLocation, 0, 0, 0);
  setTerrainDone();

  const values = [];
  for (let i = 0; i < 3; i++) {
    values.push((pixels[i * 4] + pixels[i * 4 + 1] / 255) / 255);
  }
  // Distances in landscape px: the field's value over its slope.
  const width = pixels[2] / 255 * 400;
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
  for (const name of BG.landColours) {
    for (const value of getColourValue(name)) {
      colours.push(value / 255);
    }
  }
  gl.uniform3fv(gl.getUniformLocation(program, "u_colours"), new Float32Array(colours));
  gl.uniform1f(gl.getUniformLocation(program, "u_seed"), (swirlSeed % 89) * 1.37);
  gl.uniform4f(gl.getUniformLocation(program, "u_land"), BG.riverSize, BG.riverWidth, BG.beltSize, BG.gardenSize);
  gl.uniform1f(gl.getUniformLocation(program, "u_riverSpacing"), BG.riverSpacing);
  gl.uniform4f(gl.getUniformLocation(program, "u_features"), BG.beltLevel, BG.gardenShare, BG.asteroidSpacing, BG.crystalSpacing);
  gl.uniform2f(gl.getUniformLocation(program, "u_sky"), BG.cloudSize, BG.cloudShare);
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
  setSwirlFrame(getSeconds());
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
  setWorldUniform();
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

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, swirlState.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, swirlState.sourceCanvas);
  gl.uniform1f(swirlState.uniforms.u_time, seconds);
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
  if (now - swirlState.lastFrameTime < 1000 / BG.fps || getIsPlainView()) {
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
