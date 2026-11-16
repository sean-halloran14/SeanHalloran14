// =============================================================================
// The orb and its planets
// =============================================================================
// The background's centre point (background.js) is drawn as a glowing
// cartoon of me, full body: a big ink-outlined head with curly hair,
// sunglasses and a wide grin, a green flannel, brown trousers and green
// sandals, with a warm glow and wavy aura rings round it (it's still called
// the orb in the code). It strikes a pose for the way it's flying: hovering
// and waving, superhero-style sideways, arms up going up, flailing coming
// down. The rays streaming from it come from background.js.
//
// Planets circle it, each drawn as an ink-outlined icon for what it holds
// (data-icon on its item: a database for the pipeline, a migration, a
// diagnostics monitor, a book, a little me, an envelope), on its own randomly
// shaped orbit (a tilted oval that slowly turns, with little loops in it),
// leaving its own fading cartoon trail behind it. Each
// planet is one item from the hidden .planet-list in index.html (projects,
// About, Contact), in order from the innermost orbit out:
//
//   Hover (or Tab to it) - the planets pause, that planet bounces, the orb
//                          swells a little, and a label shows its title.
//   Click (or Enter)     - opens a panel with the item's tag, title, text,
//                          tools and links. Close it with the x, Escape, or a
//                          click anywhere else.
//   Touch                - tap a planet to open its panel.
//
// The page is a big world; the visitor flies the orb around it and the view
// follows (flight.js). The SH. mark flies the orb home.
// When a click moves the centre point, the orb glides there with its planets.
// Visitors who ask for reduced motion see a still scene (hover and panels
// still work).
// =============================================================================

const SUN = {
  coreRadius: 58,          // size of the cartoon (its head is about this wide), px
  outline: "--brown-deep", // outline colour
  outlineWidth: 3,         // px
  // The cartoon of me (the orb). Colours from a photo, warmed a little to
  // suit the paintings.
  avatar: {
    skin: "#f2b48e",
    skinShade: "#d98c6a",
    blush: "rgba(236, 120, 110, 0.45)",
    stubble: "rgba(95, 62, 45, 0.2)",
    hair: "#5a3923",
    hairLight: "#8f5d38",
    lens: "#1b1d2b",
    lensShine: "rgba(255, 196, 120, 0.75)",
    mouth: "#7a1f2b",
    teeth: "#fff8ee",
    flannel: "#3f7d4b",    // green flannel shirt
    flannelDark: "#24502f",
    flannelLine: "rgba(170, 214, 150, 0.6)",
    pants: "#7a5232",      // brown trousers
    pantsShade: "#5a3a22",
    strap: "#3f9a52",      // green sandal straps
    sole: "#2b2420",
    stick: "#a0703f",      // hiking stick
    bob: 2,                // how far it bobs when still, in the cartoon's own units
    // Poses (see AVATAR_POSES): px per second of travel.
    moveFrom: 40,          // slower than this it's still
    moveFull: 260,         // faster than this it's fully in a flying pose
    linesFrom: 500,        // speed lines start here
    turnFrom: 60,          // it turns round once going sideways faster than this
    maxSpeed: 3000,        // jumps faster than this are layout changes, not flight
    motionEase: 8,         // how quickly its sense of speed catches up (per s)
    turnEase: 10,          // how quickly it turns round (per s)
  },
  glowRadius: 4.5,         // warm halo size, as a multiple of coreRadius
  glowStrength: 0.26,      // halo opacity (0-1)
  glide: 1.1,              // seconds for the orb to glide to a clicked spot
  followDistance: 90,      // moves smaller than this (flying) are followed at once, px
  auraRings: 3,            // wavy rings pulsing out from the orb
  auraSpeed: 0.35,         // how fast they pulse out
  planetWobble: 0.09,      // how blobby planets without an icon are (share of their size)
  iconRock: 0.12,          // how far the icons rock back and forth, radians
  stripeSpeed: 0.8,        // how fast the planets' stripes turn, radians per second
  // Random orbits: each planet gets its own (from the swirl seed, so
  // ?swirls=12345 repeats a layout). Ranges are [smallest, largest].
  ovalRange: [0.7, 1.15],  // stretch of the orbit across and down (share of its distance)
  precessRange: [-0.08, 0.08],  // how fast the oval itself turns, radians per second
  loopRange: [0.04, 0.13], // size of the little loops (share of the orbit's distance)
  loopsRange: [3, 7],      // loops per trip round
  speedRange: [0.7, 1.35], // speed compared with a plain orbit at that distance
  backwardsChance: 0.25,   // chance a planet goes round the other way
  // Trails
  trailLife: 2.4,          // seconds a planet's trail lasts
  trailWidth: 1.0,         // trail width at the planet, as a multiple of its size
  // Planet looks, innermost first. Each planet's content is the item in the
  // same position in .planet-list, and its icon is that item's data-icon.
  // Orbit distance (px), size (px), main and accent colours from styles.css.
  // Rings and moons only show on planets without an icon. Speeds follow the
  // orbit.
  planets: [
    { orbit: 160, size: 25, colour: "--sky-light", stripe: "--sky", ring: false, moon: false },
    { orbit: 215, size: 25, colour: "--sage", stripe: "--sunset", ring: false, moon: true },
    { orbit: 270, size: 25, colour: "--tan", stripe: "--sun-glow", ring: true, moon: false },
    { orbit: 325, size: 25, colour: "--sky", stripe: "--sunset", ring: false, moon: false },
    { orbit: 380, size: 25, colour: "--olive", stripe: "--sage", ring: false, moon: false },
    { orbit: 435, size: 25, colour: "--horizon", stripe: "--ember", ring: false, moon: true },
    { orbit: 490, size: 22, colour: "--cream", stripe: "--horizon", ring: true, moon: false },
    { orbit: 545, size: 22, colour: "--earth", stripe: "--tan-dark", ring: false, moon: true },
  ],
  innerSpeed: 0.45,        // radians per second for the innermost orbit
  hoverReach: 14,          // how close the pointer must be to a planet's edge, px
  hintTime: 12,            // seconds before the hint fades by itself
  fps: 60,
};

const sunCanvas = document.querySelector(".sun-layer");
const sunContext = sunCanvas.getContext("2d");
// Where the drawing functions draw. Usually the orb canvas; hunt.js points it
// at a hidden planet's own little canvas while drawing that planet.
let drawContext = sunContext;
const sunMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const planetItems = document.querySelectorAll(".planet-list > li");
const planetLabel = document.querySelector(".planet-label");
const planetPanel = document.querySelector(".planet-panel");
const pageHint = document.querySelector(".hint");

const sunState = {
  x: 0, y: 0,              // where the orb is drawn now, page px (relative to .page)
  fromX: 0, fromY: 0,      // where a glide started
  toX: 0, toY: 0,          // where it is heading
  glideStart: -1000,
  hasPosition: false,
  motionX: null,           // where it was last frame, for measuring its speed
  motionY: null,
  motionTime: 0,
  vx: 0,                   // smoothed speed, page px per second
  vy: 0,
  facing: 1,               // which way the cartoon faces: 1 right, -1 left
  scale: 1,                // shrinks everything to fit the screen
  boxSize: 0,              // canvas size, px
  planetCount: 0,
  planetOrbits: [],        // each planet's random orbit shape
  planetTrails: [],        // each planet's recent positions (offsets from the orb)
  planetSpots: [],         // each planet's offset from the orb this frame, and size
  orbitTime: 0,            // planets' own clock; it stops while one is in focus
  lastSeconds: 0,
  hovered: null,           // planet under the pointer
  focused: null,           // planet reached with the keyboard
  labelPlanet: null,       // planet whose label is showing
  panelPlanet: null,       // planet whose panel is open
  panelClosedAt: -1000,    // when a panel last closed (ms)
  celebrateUntil: -1,      // the orb celebrates until this time (seconds)
  viewMoved: false,        // has the visitor scrolled or panned yet?
  lastPointerType: "mouse",
  startTime: performance.now(),
  lastFrame: 0,
  frame: 0,
};

// ---------- Helpers ----------

function getSunColour(name, alpha) {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace("#", "");
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
}

function getSunSeconds() {
  return (performance.now() - sunState.startTime) / 1000;
}

function getEaseInOut(progress) {
  return progress * progress * (3 - 2 * progress);
}

function setOutline(width) {
  drawContext.lineWidth = width * sunState.scale;
  drawContext.strokeStyle = getSunColour(SUN.outline, 0.7);
  drawContext.lineJoin = "round";
  drawContext.lineCap = "round";
  drawContext.stroke();
}

function getActivePlanet() {
  // The planet currently in focus: an open panel wins, then hover, then keyboard.
  if (sunState.panelPlanet !== null) {
    return sunState.panelPlanet;
  }
  if (sunState.hovered !== null) {
    return sunState.hovered;
  }
  return sunState.focused;
}

// ---------- Content ----------

function getPlanetItem(index) {
  // The content for this planet from .planet-list in index.html.
  const item = planetItems[index];
  if (!item) {
    return null;
  }
  const titleElement = item.querySelector(".planet-title");
  // Each .planet-text is one paragraph in the panel.
  const paragraphs = [];
  for (const textElement of item.querySelectorAll(".planet-text")) {
    const paragraph = textElement.textContent.trim();
    if (paragraph) {
      paragraphs.push(paragraph);
    }
  }
  const tools = [];
  for (const tool of item.querySelectorAll(".planet-tools li")) {
    tools.push(tool.textContent.trim());
  }
  const links = [];
  for (const link of item.querySelectorAll(".planet-links a")) {
    links.push({ label: link.textContent.trim(), href: link.getAttribute("href") });
  }
  let title = "";
  if (titleElement) {
    title = titleElement.textContent.trim();
  }
  return { tag: item.dataset.tag || "", title: title, paragraphs: paragraphs, tools: tools, links: links };
}

// ---------- Position and size ----------

function getOuterReach() {
  // The furthest any planet gets from the orb, before scaling.
  let reach = 0;
  for (let i = 0; i < sunState.planetCount; i++) {
    const orbit = sunState.planetOrbits[i];
    const stretch = Math.max(orbit.ovalX, orbit.ovalY) + orbit.loopSize;
    reach = Math.max(reach, SUN.planets[i].orbit * stretch);
  }
  return reach;
}

function setSunScale() {
  // Shrinks the whole system so its outer orbit fits on the screen (the
  // world is bigger than the screen, but the system should fit in one view).
  const outer = getOuterReach() + 30;
  const room = Math.min(window.innerWidth, window.innerHeight) / 2 - 24;
  sunState.scale = Math.min(1, Math.max(0.4, room / outer));
  if (typeof BG !== "undefined") {
    sunState.scale = sunState.scale * BG.zoom;   // the page's zoom (background.js)
  }
  const reach = Math.max(outer + 30, SUN.coreRadius * SUN.glowRadius);
  sunState.boxSize = Math.ceil(2 * reach * sunState.scale);

  const ratio = window.devicePixelRatio || 1;
  sunCanvas.width = Math.round(sunState.boxSize * ratio);
  sunCanvas.height = Math.round(sunState.boxSize * ratio);
  sunCanvas.style.width = sunState.boxSize + "px";
  sunCanvas.style.height = sunState.boxSize + "px";
  sunContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setSunCelebration(duration) {
  // Makes the orb throb and spin faster for a while (hunt.js, when all are found).
  sunState.celebrateUntil = getSunSeconds() + duration;
}

function setDrawContext(context) {
  // Points the drawing functions at another canvas (null = the orb canvas).
  if (context === null) {
    drawContext = sunContext;
  } else {
    drawContext = context;
  }
}

function setSunTarget(seconds) {
  // Follows the background's centre point; starts a glide when it moves.
  if (typeof getCentrePagePoint !== "function") {
    return;
  }
  const point = getCentrePagePoint();
  if (!sunState.hasPosition) {
    sunState.x = point.x;
    sunState.y = point.y;
    sunState.toX = point.x;
    sunState.toY = point.y;
    sunState.hasPosition = true;
    return;
  }
  if (point.x === sunState.toX && point.y === sunState.toY) {
    return;
  }
  const targetJump = Math.hypot(point.x - sunState.toX, point.y - sunState.toY);
  const gliding = seconds - sunState.glideStart < SUN.glide;
  if (targetJump >= SUN.followDistance) {
    // A big jump (a click or the SH. mark): glide there from where it is now.
    sunState.fromX = sunState.x;
    sunState.fromY = sunState.y;
    sunState.glideStart = seconds;
  } else if (!gliding) {
    // Small steps (flying) are followed straight away.
    sunState.x = point.x;
    sunState.y = point.y;
  }
  // Otherwise a glide is under way: it carries on, now ending at the new spot.
  sunState.toX = point.x;
  sunState.toY = point.y;
}

function setSunShift(dx, dy) {
  // The world slid under the page (flight.js): move the orb back with it.
  sunState.x -= dx;
  sunState.y -= dy;
  sunState.fromX -= dx;
  sunState.fromY -= dy;
  sunState.toX -= dx;
  sunState.toY -= dy;
  if (sunState.motionX !== null) {
    sunState.motionX -= dx;
    sunState.motionY -= dy;
  }
  const half = sunState.boxSize / 2;
  sunCanvas.style.transform = "translate(" + (sunState.x - half) + "px, " + (sunState.y - half) + "px)";
}

function setSunPosition(seconds) {
  const progress = Math.min(1, (seconds - sunState.glideStart) / SUN.glide);
  if (progress >= 1 || sunMotion.matches) {
    sunState.x = sunState.toX;
    sunState.y = sunState.toY;
  } else {
    const eased = getEaseInOut(progress);
    sunState.x = sunState.fromX + (sunState.toX - sunState.fromX) * eased;
    sunState.y = sunState.fromY + (sunState.toY - sunState.fromY) * eased;
  }
  // The canvas is a square box centred on the orb.
  const half = sunState.boxSize / 2;
  sunCanvas.style.transform = "translate(" + (sunState.x - half) + "px, " + (sunState.y - half) + "px)";
}

// ---------- The orb ----------

function setOrbGlow(centre, radius) {
  const glow = drawContext.createRadialGradient(centre, centre, radius * 0.8, centre, centre, radius * SUN.glowRadius);
  glow.addColorStop(0, getSunColour("--sun-glow", SUN.glowStrength));
  glow.addColorStop(1, getSunColour("--sunset", 0));
  drawContext.fillStyle = glow;
  drawContext.fillRect(0, 0, sunState.boxSize, sunState.boxSize);
}

function setBlobPath(cx, cy, radius, lumps, drift, seconds, seed, steps) {
  // A soft blob: a circle whose edge rises and falls in a few slow waves.
  const turn = seconds * drift;
  drawContext.beginPath();
  for (let i = 0; i <= steps; i++) {
    const angle = i / steps * Math.PI * 2;
    const wave = 0.6 * Math.sin(3 * angle + turn + seed)
      + 0.4 * Math.sin(5 * angle - turn * 1.3 + seed * 2.1);
    const r = radius * (1 + lumps * wave);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) {
      drawContext.moveTo(x, y);
    } else {
      drawContext.lineTo(x, y);
    }
  }
  drawContext.closePath();
}

function setOrbAura(centre, radius, seconds) {
  // Wavy outlines that keep pulsing out from round the cartoon and fading.
  for (let k = 0; k < SUN.auraRings; k++) {
    const phase = (seconds * SUN.auraSpeed + k / SUN.auraRings) % 1;
    const r = radius * (1.7 + phase * 1.6);
    setBlobPath(centre, centre, r, 0.06, 0.6, seconds, k * 1.7, 64);
    drawContext.lineWidth = 3 * sunState.scale * (1 - phase * 0.5);
    drawContext.strokeStyle = getSunColour("--sun-glow", 0.55 * (1 - phase));
    drawContext.stroke();
  }
}

function setInk(width) {
  // Strokes the current path in ink. The width is in the current units, so
  // inside the cartoon or an icon it scales with them.
  drawContext.lineWidth = width;
  drawContext.strokeStyle = getSunColour(SUN.outline, 0.9);
  drawContext.lineJoin = "round";
  drawContext.lineCap = "round";
  drawContext.stroke();
}

function setFilledEllipse(x, y, rx, ry, colour, ink) {
  drawContext.beginPath();
  drawContext.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  drawContext.fillStyle = colour;
  drawContext.fill();
  if (ink > 0) {
    setInk(ink);
  }
}

function setRoundedBox(x, y, width, height, radius) {
  drawContext.beginPath();
  drawContext.moveTo(x + radius, y);
  drawContext.arcTo(x + width, y, x + width, y + height, radius);
  drawContext.arcTo(x + width, y + height, x, y + height, radius);
  drawContext.arcTo(x, y + height, x, y, radius);
  drawContext.arcTo(x, y, x + width, y, radius);
  drawContext.closePath();
}

// ---------- The orb: a cartoon of me ----------
// Drawn in its own units (coreRadius / 40 px each), full body, with the
// origin at the belly: a big head with curly hair and sunglasses, a green
// flannel, brown trousers and green sandals. Its pose follows how it's
// moving (setAvatarMotion measures that from frame to frame, whatever moved
// it: flying, keys, currents, a boost or a black hole):
//   still     - hovering and waving, legs dangling
//   sideways  - leaning into the flight like a superhero, fist first
//   up        - both arms up, legs together, kicking
//   down      - falling: arms flailing, knees tucked, mouth open
// The poses blend into each other, it turns to face the way it's going, its
// hair blows in the wind, and speed lines trail behind it when it's fast.

// Each pose: lean (radians, towards the way it faces); arm and leg angles
// (0 = straight down, positive = towards the way it faces) and the extra bend
// at the elbow or knee; how open the mouth is (0-1); and how far the hair
// blows (positive = towards the feet).
const AVATAR_POSES = {
  still: {
    lean: 0, armFront: 2.5, elbowFront: 0.3, armBack: -0.35, elbowBack: 0.9,
    legFront: 0.14, kneeFront: -0.2, legBack: -0.14, kneeBack: 0.2, mouth: 0, wind: 0,
  },
  sideways: {
    lean: 1.1, armFront: 2.2, elbowFront: 0.15, armBack: -0.15, elbowBack: 0.1,
    legFront: 0.06, kneeFront: 0, legBack: -0.06, kneeBack: 0, mouth: 0.15, wind: 3,
  },
  up: {
    lean: 0, armFront: 2.85, elbowFront: 0.1, armBack: -2.85, elbowBack: -0.1,
    legFront: 0.05, kneeFront: 0, legBack: -0.05, kneeBack: 0, mouth: 0.2, wind: 3,
  },
  down: {
    lean: 0, armFront: 2.3, elbowFront: 0.6, armBack: -2.3, elbowBack: -0.6,
    legFront: 0.75, kneeFront: -1.9, legBack: -0.75, kneeBack: 1.9, mouth: 1, wind: -4,
  },
};

function getSmoothStep(from, to, value) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

function setAvatarMotion(seconds) {
  // How fast and which way the cartoon is moving (page px per second),
  // smoothed, and which way it faces (eases between 1 = right and -1 = left).
  const look = SUN.avatar;
  if (sunState.motionX === null) {
    sunState.motionX = sunState.x;
    sunState.motionY = sunState.y;
    sunState.motionTime = seconds;
    return;
  }
  const step = Math.min(0.1, seconds - sunState.motionTime);
  if (step <= 0) {
    return;
  }
  let rawX = (sunState.x - sunState.motionX) / step;
  let rawY = (sunState.y - sunState.motionY) / step;
  const rawSpeed = Math.hypot(rawX, rawY);
  if (rawSpeed > look.maxSpeed) {
    // A layout jump, not a flight.
    rawX = rawX / rawSpeed * look.maxSpeed;
    rawY = rawY / rawSpeed * look.maxSpeed;
  }
  const ease = 1 - Math.exp(-look.motionEase * step);
  sunState.vx += (rawX - sunState.vx) * ease;
  sunState.vy += (rawY - sunState.vy) * ease;
  if (Math.abs(sunState.vx) > look.turnFrom) {
    const target = Math.sign(sunState.vx);
    sunState.facing += (target - sunState.facing) * (1 - Math.exp(-look.turnEase * step));
  }
  sunState.motionX = sunState.x;
  sunState.motionY = sunState.y;
  sunState.motionTime = seconds;
}

function getPoseWeights() {
  // How much of each pose to use: still when slow, otherwise shared between
  // sideways, up and down by the direction of travel.
  const look = SUN.avatar;
  const speed = Math.hypot(sunState.vx, sunState.vy);
  let moving = 0;
  if (!sunMotion.matches) {
    moving = getSmoothStep(look.moveFrom, look.moveFull, speed);
  }
  const across = Math.abs(sunState.vx);
  const rising = Math.max(0, -sunState.vy);
  const falling = Math.max(0, sunState.vy);
  let total = across * across + rising * rising + falling * falling;
  if (total === 0) {
    total = 1;
  }
  return {
    still: 1 - moving,
    sideways: moving * across * across / total,
    up: moving * rising * rising / total,
    down: moving * falling * falling / total,
  };
}

function getAvatarPose(seconds) {
  // The blended pose for this moment, with each pose's own wiggle (a wave,
  // fluttering legs, kicks, flailing arms) mixed in by its weight.
  const weights = getPoseWeights();
  const pose = {};
  for (const key of Object.keys(AVATAR_POSES.still)) {
    let value = 0;
    for (const name of Object.keys(weights)) {
      value += AVATAR_POSES[name][key] * weights[name];
    }
    pose[key] = value;
  }
  let wiggle = 1;
  if (sunMotion.matches) {
    wiggle = 0;
  }
  pose.elbowFront += weights.still * 0.45 * Math.sin(seconds * 7) * wiggle;
  pose.kneeFront += weights.still * 0.15 * Math.sin(seconds * 2) * wiggle;
  pose.kneeBack += weights.still * 0.15 * Math.sin(seconds * 2 + 1.5) * wiggle;
  pose.kneeFront += weights.sideways * 0.3 * Math.sin(seconds * 11) * wiggle;
  pose.kneeBack -= weights.sideways * 0.3 * Math.sin(seconds * 11) * wiggle;
  pose.kneeFront += weights.up * 0.35 * Math.sin(seconds * 9) * wiggle;
  pose.kneeBack -= weights.up * 0.35 * Math.sin(seconds * 9) * wiggle;
  pose.armFront += weights.down * 0.4 * Math.sin(seconds * 11) * wiggle;
  pose.armBack -= weights.down * 0.4 * Math.sin(seconds * 11 + 1) * wiggle;
  pose.weights = weights;
  return pose;
}

function getJoint(x, y, angle, length) {
  // The far end of a limb segment (angle 0 = straight down).
  return { x: x + Math.sin(angle) * length, y: y + Math.cos(angle) * length };
}

function setLimbStroke(points, width, colour) {
  // A limb: an ink stroke through its joints, then its colour on top.
  drawContext.beginPath();
  drawContext.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    drawContext.lineTo(points[i].x, points[i].y);
  }
  drawContext.lineJoin = "round";
  drawContext.lineCap = "round";
  drawContext.lineWidth = width + 3.6;
  drawContext.strokeStyle = getSunColour(SUN.outline, 0.9);
  drawContext.stroke();
  drawContext.lineWidth = width;
  drawContext.strokeStyle = colour;
  drawContext.stroke();
}

function setBandAcross(from, to, share, width, colour) {
  // A short band across a limb segment, part way along it (flannel checks,
  // cuffs).
  const x = from.x + (to.x - from.x) * share;
  const y = from.y + (to.y - from.y) * share;
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const acrossX = -(to.y - from.y) / length * width / 2;
  const acrossY = (to.x - from.x) / length * width / 2;
  drawContext.beginPath();
  drawContext.moveTo(x - acrossX, y - acrossY);
  drawContext.lineTo(x + acrossX, y + acrossY);
  drawContext.lineWidth = 2.6;
  drawContext.lineCap = "butt";
  drawContext.strokeStyle = colour;
  drawContext.stroke();
}

function setAvatarArm(x, y, angle, bend) {
  // A flannel sleeve with dark checks and a cuff, and a hand. Returns the hand.
  const look = SUN.avatar;
  const shoulder = { x: x, y: y };
  const elbow = getJoint(x, y, angle, 15);
  const hand = getJoint(elbow.x, elbow.y, angle + bend, 14);
  setLimbStroke([shoulder, elbow, hand], 9.5, look.flannel);
  setBandAcross(shoulder, elbow, 0.45, 9.5, look.flannelDark);
  setBandAcross(elbow, hand, 0.35, 9.5, look.flannelDark);
  setBandAcross(elbow, hand, 0.82, 9.5, look.flannelDark);
  setFilledEllipse(hand.x, hand.y, 4.6, 4.6, look.skin, 2);
  return hand;
}

function setAvatarSandal(x, y, angle) {
  // A foot in a green strappy sandal, square to the leg: dark sole, bare
  // foot, crossed straps and a toe loop.
  const look = SUN.avatar;
  drawContext.save();
  drawContext.translate(x, y);
  drawContext.rotate(-angle);
  setFilledEllipse(1.5, 4.6, 7.6, 3.6, look.sole, 1.8);
  setFilledEllipse(1.5, 2.6, 6.4, 3.2, look.skin, 1.5);
  drawContext.beginPath();
  drawContext.moveTo(-4.5, 0.6);
  drawContext.lineTo(4.5, 4.4);
  drawContext.moveTo(-4.5, 4.4);
  drawContext.lineTo(2, 0.8);
  drawContext.lineCap = "round";
  drawContext.lineWidth = 3.8;
  drawContext.strokeStyle = getSunColour(SUN.outline, 0.9);
  drawContext.stroke();
  drawContext.lineWidth = 2.2;
  drawContext.strokeStyle = look.strap;
  drawContext.stroke();
  drawContext.beginPath();
  drawContext.arc(6, 2.6, 1.6, 0, Math.PI * 2);
  drawContext.lineWidth = 1.5;
  drawContext.stroke();
  drawContext.restore();
}

function setAvatarLeg(x, y, angle, bend) {
  // A brown trouser leg with a darker hem, then the sandal.
  const look = SUN.avatar;
  const hip = { x: x, y: y };
  const knee = getJoint(x, y, angle, 19);
  const ankle = getJoint(knee.x, knee.y, angle + bend, 18);
  setLimbStroke([hip, knee, ankle], 11, look.pants);
  setBandAcross(knee, ankle, 0.88, 11, look.pantsShade);
  setAvatarSandal(ankle.x, ankle.y, angle + bend);
}

function setTorsoPath() {
  drawContext.beginPath();
  drawContext.moveTo(-21, -2);
  drawContext.quadraticCurveTo(-20, -9, -8, -9);
  drawContext.lineTo(8, -9);
  drawContext.quadraticCurveTo(20, -9, 21, -2);
  drawContext.lineTo(18, 34);
  drawContext.quadraticCurveTo(0, 38, -18, 34);
  drawContext.closePath();
}

function setAvatarTorso() {
  // Trousers at the hips, then an untucked green flannel over them: dark
  // checks both ways with fine light lines, an open collar, buttons and a
  // chest pocket.
  const look = SUN.avatar;
  setRoundedBox(-17, 26, 34, 14, 4);
  drawContext.fillStyle = look.pants;
  drawContext.fill();
  setInk(2.2);
  setRoundedBox(-7, -16, 14, 13, 3);
  drawContext.fillStyle = look.skinShade;
  drawContext.fill();
  setInk(2);

  setTorsoPath();
  drawContext.fillStyle = look.flannel;
  drawContext.fill();
  drawContext.save();
  drawContext.clip();
  drawContext.fillStyle = look.flannelDark;
  for (let x = -24; x < 26; x += 12) {
    drawContext.fillRect(x, -12, 5, 52);
  }
  for (let y = -10; y < 40; y += 12) {
    drawContext.fillRect(-24, y, 50, 5);
  }
  drawContext.strokeStyle = look.flannelLine;
  drawContext.lineWidth = 0.9;
  for (let x = -16; x < 26; x += 12) {
    drawContext.beginPath();
    drawContext.moveTo(x, -12);
    drawContext.lineTo(x, 40);
    drawContext.stroke();
  }
  drawContext.restore();
  setTorsoPath();
  setInk(2.6);

  // Open collar: a V of skin with the collar points either side.
  drawContext.beginPath();
  drawContext.moveTo(-8, -9);
  drawContext.lineTo(0, 3);
  drawContext.lineTo(8, -9);
  drawContext.closePath();
  drawContext.fillStyle = look.skinShade;
  drawContext.fill();
  for (const side of [-1, 1]) {
    drawContext.beginPath();
    drawContext.moveTo(side * 8, -10);
    drawContext.lineTo(side * 1.5, 1);
    drawContext.lineTo(side * 12, -3);
    drawContext.closePath();
    drawContext.fillStyle = look.flannelDark;
    drawContext.fill();
    setInk(1.6);
  }
  // Button line, buttons and a chest pocket.
  drawContext.beginPath();
  drawContext.moveTo(0, 3);
  drawContext.lineTo(0, 35);
  setInk(1.2);
  for (const y of [10, 18, 26]) {
    setFilledEllipse(1.8, y, 1.3, 1.3, look.teeth, 0.8);
  }
  setRoundedBox(-16, 3, 9, 8, 1.5);
  setInk(1.2);
}

function setAvatarStick(hand, amount) {
  // The hiking stick, held while hovering (it fades away in flight).
  if (amount < 0.05) {
    return;
  }
  drawContext.save();
  drawContext.globalAlpha = amount;
  drawContext.beginPath();
  drawContext.moveTo(hand.x + 1, hand.y - 16);
  drawContext.lineTo(hand.x - 1, hand.y + 50);
  drawContext.lineCap = "round";
  drawContext.lineWidth = 6.4;
  drawContext.strokeStyle = getSunColour(SUN.outline, 0.9);
  drawContext.stroke();
  drawContext.lineWidth = 3.6;
  drawContext.strokeStyle = SUN.avatar.stick;
  drawContext.stroke();
  drawContext.restore();
}

function setHairCurls(curls, seconds, inkWidth, wind) {
  // A mop of curls: every curl in ink first (a little bigger), then all of
  // them in colour, so the outline only shows round the outside. Each curl
  // bounces a little, the wind pushes them (towards the feet when positive),
  // and each gets a highlight swirl.
  const look = SUN.avatar;
  const placed = [];
  for (let i = 0; i < curls.length; i++) {
    const curl = curls[i];
    const bounce = Math.sin(seconds * 2.6 + i * 1.3) * 0.5;
    const push = wind * (0.6 + 0.4 * Math.sin(seconds * 8 + i));
    placed.push([curl[0], curl[1] + push, curl[2] + bounce]);
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const curl of placed) {
      drawContext.beginPath();
      if (pass === 0) {
        drawContext.arc(curl[0], curl[1], curl[2] + inkWidth, 0, Math.PI * 2);
        drawContext.fillStyle = getSunColour(SUN.outline, 0.95);
      } else {
        drawContext.arc(curl[0], curl[1], curl[2], 0, Math.PI * 2);
        drawContext.fillStyle = look.hair;
      }
      drawContext.fill();
    }
  }
  drawContext.lineCap = "round";
  for (let i = 0; i < placed.length; i++) {
    const curl = placed[i];
    const start = i * 1.9;
    drawContext.beginPath();
    drawContext.arc(curl[0], curl[1], curl[2] * 0.55, start, start + 3.6);
    drawContext.lineWidth = 2.2;
    drawContext.strokeStyle = look.hairLight;
    drawContext.stroke();
    drawContext.beginPath();
    drawContext.arc(curl[0] + 1, curl[1] + 1, curl[2] * 0.85, start + 3.4, start + 4.6);
    drawContext.lineWidth = 1.4;
    drawContext.strokeStyle = getSunColour(SUN.outline, 0.6);
    drawContext.stroke();
  }
}

function setMouthPath(open) {
  // A wide grin that turns into a round "whoa" as it opens.
  const half = 15 - 6 * open;
  drawContext.beginPath();
  drawContext.moveTo(-half, 13);
  drawContext.quadraticCurveTo(0, 17 - 9 * open, half, 13);
  drawContext.quadraticCurveTo(0, 33 + 2 * open, -half, 13);
  drawContext.closePath();
}

function setAvatarFace(seconds, pose) {
  const look = SUN.avatar;
  // Ears, then the hair behind the head, then the face.
  setFilledEllipse(-33, 0, 6, 9, look.skin, 2.5);
  setFilledEllipse(33, 0, 6, 9, look.skin, 2.5);
  setHairCurls([
    [-30, -16, 13], [-20, -31, 15], [-2, -37, 17], [17, -33, 15], [31, -19, 13],
    [-36, -4, 8], [36, -5, 8],
  ], seconds, 2.8, pose.wind);
  drawContext.beginPath();
  drawContext.ellipse(0, 0, 31, 36, 0, 0, Math.PI * 2);
  drawContext.fillStyle = look.skin;
  drawContext.fill();
  setInk(3);
  // Stubble round the jaw, and rosy cheeks.
  drawContext.save();
  drawContext.beginPath();
  drawContext.ellipse(0, 0, 31, 36, 0, 0, Math.PI * 2);
  drawContext.clip();
  setFilledEllipse(0, 30, 27, 17, look.stubble, 0);
  drawContext.restore();
  setFilledEllipse(-20, 8, 6, 3.5, look.blush, 0);
  setFilledEllipse(20, 8, 6, 3.5, look.blush, 0);

  // Eyebrows, raised over the shades.
  drawContext.lineCap = "round";
  for (const side of [-1, 1]) {
    drawContext.beginPath();
    drawContext.moveTo(side * 20, -15);
    drawContext.quadraticCurveTo(side * 13, -20 - pose.mouth * 2, side * 5, -16);
    drawContext.lineWidth = 3.2;
    drawContext.strokeStyle = look.hair;
    drawContext.stroke();
  }
  // Sunglasses: two dark lenses with a warm shine, on an ink frame.
  drawContext.beginPath();
  drawContext.moveTo(-21, -7);
  drawContext.lineTo(-32, -4);
  drawContext.moveTo(21, -7);
  drawContext.lineTo(32, -4);
  drawContext.moveTo(-4, -6);
  drawContext.quadraticCurveTo(0, -8.5, 4, -6);
  setInk(2.4);
  for (const side of [-1, 1]) {
    const left = side * 12.5 - 8.5;
    setRoundedBox(left, -11, 17, 12, 4.5);
    drawContext.fillStyle = look.lens;
    drawContext.fill();
    setInk(2.4);
    drawContext.beginPath();
    drawContext.moveTo(left + 4, -8.5);
    drawContext.lineTo(left + 8, -3);
    drawContext.moveTo(left + 8, -8.8);
    drawContext.lineTo(left + 10, -6.2);
    drawContext.lineWidth = 1.6;
    drawContext.strokeStyle = look.lensShine;
    drawContext.stroke();
  }
  // Nose.
  drawContext.beginPath();
  drawContext.moveTo(1, 1);
  drawContext.quadraticCurveTo(6, 8, 0, 10);
  setInk(2);
  // The mouth: a big grin with a row of teeth, opening when falling.
  setMouthPath(pose.mouth);
  drawContext.fillStyle = look.mouth;
  drawContext.fill();
  drawContext.save();
  drawContext.clip();
  drawContext.fillStyle = look.teeth;
  drawContext.fillRect(-16, 4, 32, 15 - pose.mouth * 3);
  drawContext.restore();
  setMouthPath(pose.mouth);
  setInk(2.5);
  // The fringe of curls over the forehead.
  setHairCurls([
    [-25, -21, 9], [-13, -28, 10], [1, -30, 10.5], [14, -27, 10], [25, -19, 8.5],
  ], seconds + 0.7, 2.2, pose.wind);
}

function setSpeedLines(centre, radius, seconds) {
  // Cartoon speed lines streaming out behind it when it's going fast.
  const look = SUN.avatar;
  const speed = Math.hypot(sunState.vx, sunState.vy);
  const strength = getSmoothStep(look.linesFrom, look.linesFrom * 2.5, speed);
  if (strength <= 0 || sunMotion.matches) {
    return;
  }
  const backX = -sunState.vx / speed;
  const backY = -sunState.vy / speed;
  drawContext.lineCap = "round";
  for (let k = 0; k < 5; k++) {
    const offset = (k - 2) * radius * 0.4;
    const start = radius * (1.1 + 0.5 * ((seconds * 2.5 + k * 0.37) % 1));
    const length = radius * (0.7 + 0.35 * (k % 2));
    const x = centre - backY * offset + backX * start;
    const y = centre + backX * offset + backY * start;
    drawContext.beginPath();
    drawContext.moveTo(x, y);
    drawContext.lineTo(x + backX * length, y + backY * length);
    drawContext.lineWidth = Math.max(2.5, radius * 0.11);
    drawContext.strokeStyle = getSunColour(SUN.outline, 0.5 * strength);
    drawContext.stroke();
    drawContext.lineWidth = Math.max(1.5, radius * 0.06);
    drawContext.strokeStyle = getSunColour("--cream", 0.9 * strength);
    drawContext.stroke();
  }
}

function setOrb(centre, radius, seconds) {
  // The cartoon in its current pose, facing the way it's going, bobbing
  // gently (and bouncing while it celebrates).
  setOrbAura(centre, radius, seconds);
  setSpeedLines(centre, radius, seconds);
  const look = SUN.avatar;
  const pose = getAvatarPose(seconds);
  let bob = 0;
  if (!sunMotion.matches) {
    bob = Math.sin(seconds * 2) * look.bob * pose.weights.still;
    if (seconds < sunState.celebrateUntil) {
      bob = -Math.abs(Math.sin(seconds * 9)) * look.bob * 4;
    }
  }
  const unit = radius / 40;
  drawContext.save();
  drawContext.translate(centre, centre);
  drawContext.scale(unit * sunState.facing, unit);
  drawContext.translate(0, bob);
  drawContext.rotate(pose.lean);
  setAvatarLeg(-9, 33, pose.legBack, pose.kneeBack);
  setAvatarLeg(9, 33, pose.legFront, pose.kneeFront);
  setAvatarTorso();
  drawContext.save();
  drawContext.translate(0, -46);
  drawContext.rotate(Math.sin(seconds * 0.9) * 0.04 * pose.weights.still);
  setAvatarFace(seconds, pose);
  drawContext.restore();
  const backHand = setAvatarArm(-20, -2, pose.armBack, pose.elbowBack);
  setAvatarStick(backHand, pose.weights.still);
  setAvatarArm(20, -2, pose.armFront, pose.elbowFront);
  drawContext.restore();
}

// ---------- Planets ----------

function getRandomInRange(random, range) {
  return range[0] + random() * (range[1] - range[0]);
}

function setPlanetOrbits() {
  // Gives every planet its own orbit shape, speed and direction.
  let random = Math.random;
  if (typeof getSeededRandom === "function" && typeof swirlSeed === "number") {
    random = getSeededRandom(swirlSeed + 6000);
  }
  sunState.planetOrbits = [];
  sunState.planetTrails = [];
  for (let i = 0; i < sunState.planetCount; i++) {
    // Closer planets go round faster (speed falls with orbit^1.5, like a
    // real solar system), then each gets its own nudge.
    const plainSpeed = SUN.innerSpeed * Math.pow(SUN.planets[0].orbit / SUN.planets[i].orbit, 1.5);
    let direction = getOrbitDirection();
    if (random() < SUN.backwardsChance) {
      direction = -direction;
    }
    sunState.planetOrbits.push({
      phase: random() * Math.PI * 2,
      ovalX: getRandomInRange(random, SUN.ovalRange),
      ovalY: getRandomInRange(random, SUN.ovalRange),
      tilt: random() * Math.PI,
      precess: getRandomInRange(random, SUN.precessRange),
      loopSize: getRandomInRange(random, SUN.loopRange),
      loops: Math.floor(getRandomInRange(random, SUN.loopsRange)),
      loopPhase: random() * Math.PI * 2,
      speed: plainSpeed * getRandomInRange(random, SUN.speedRange),
      direction: direction,
    });
    sunState.planetTrails.push([]);
  }
}

function getIsInOrbit(index) {
  // A planet orbits once it has been found (hunt.js), or always if there's no hunt.
  if (typeof getIsPlanetFound === "function") {
    return getIsPlanetFound(index);
  }
  return true;
}

function getPlanetOffset(index) {
  // Where a planet is, relative to the orb: round a tilted oval, plus small
  // loops, with the whole oval slowly turning.
  const orbit = sunState.planetOrbits[index];
  const distance = SUN.planets[index].orbit * sunState.scale;
  const time = sunState.orbitTime;
  const angle = orbit.phase + orbit.direction * orbit.speed * time;
  const loopAngle = angle * orbit.loops + orbit.loopPhase;
  const x = Math.cos(angle) * distance * orbit.ovalX + Math.cos(loopAngle) * distance * orbit.loopSize;
  const y = Math.sin(angle) * distance * orbit.ovalY + Math.sin(loopAngle) * distance * orbit.loopSize;
  const turn = orbit.tilt + orbit.precess * time;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  return { dx: x * c - y * sn, dy: x * sn + y * c };
}

function getOrbitDirection() {
  if (typeof BG !== "undefined") {
    return BG.revolveDirection;
  }
  return 1;
}

function setPlanetBody(px, py, size, planet, orbX, orbY, seconds, seed) {
  // A planet with an icon is drawn as that icon (setPlanetIcon). Otherwise:
  // a wobbly blob of flat colour with a swirling stripe band, a soft shadow
  // crescent away from the orb, a shine dot facing it, and an ink outline.
  if (planet.icon) {
    setPlanetIcon(px, py, size, planet, seconds, seed);
    return;
  }
  const towardX = orbX - px;
  const towardY = orbY - py;
  const distance = Math.hypot(towardX, towardY) || 1;
  const ux = towardX / distance;
  const uy = towardY / distance;

  setBlobPath(px, py, size, SUN.planetWobble, 1.4, seconds, seed, 28);
  drawContext.fillStyle = getSunColour(planet.colour, 1);
  drawContext.fill();

  drawContext.save();
  setBlobPath(px, py, size, SUN.planetWobble, 1.4, seconds, seed, 28);
  drawContext.clip();

  // Stripe band: a wavy stripe that keeps turning across the planet.
  if (planet.stripe) {
    drawContext.save();
    drawContext.translate(px, py);
    drawContext.rotate(seconds * SUN.stripeSpeed + seed);
    drawContext.beginPath();
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const x = -size * 1.3 + i / steps * size * 2.6;
      const y = Math.sin(i / steps * Math.PI * 2 + seconds * 3) * size * 0.18 - size * 0.12;
      if (i === 0) {
        drawContext.moveTo(x, y);
      } else {
        drawContext.lineTo(x, y);
      }
    }
    drawContext.lineWidth = size * 0.42;
    drawContext.strokeStyle = getSunColour(planet.stripe, 0.75);
    drawContext.stroke();
    drawContext.restore();
  }

  drawContext.beginPath();
  drawContext.arc(px - ux * size * 0.75, py - uy * size * 0.75, size, 0, Math.PI * 2);
  drawContext.fillStyle = getSunColour("--brown-deep", 0.3);
  drawContext.fill();
  drawContext.restore();

  drawContext.beginPath();
  drawContext.arc(px + ux * size * 0.38, py + uy * size * 0.38 - size * 0.12, Math.max(1, size * 0.22), 0, Math.PI * 2);
  drawContext.fillStyle = getSunColour("--cream", 0.85);
  drawContext.fill();

  setBlobPath(px, py, size, SUN.planetWobble, 1.4, seconds, seed, 28);
  setOutline(Math.max(1.4, SUN.outlineWidth * 0.7));
}

// ---------- Planet icons ----------
// Each drawn in its own units, about 30 across, with ink outlines like the
// rest of the art: main = the planet's colour, accent = its stripe colour.

function setCylinder(x, top, bottom, rx, ry, side, lid) {
  // A database cylinder: its body, a ring round its middle, and a lid.
  drawContext.beginPath();
  drawContext.moveTo(x - rx, top);
  drawContext.lineTo(x - rx, bottom);
  drawContext.ellipse(x, bottom, rx, ry, 0, Math.PI, 0, true);
  drawContext.lineTo(x + rx, top);
  drawContext.closePath();
  drawContext.fillStyle = side;
  drawContext.fill();
  setInk(2.2);
  drawContext.beginPath();
  drawContext.ellipse(x, (top + bottom) / 2, rx, ry, 0, 0, Math.PI, false);
  setInk(1.5);
  setFilledEllipse(x, top, rx, ry, lid, 2.2);
}

function setSparkle(x, y, r, colour) {
  // A four-pointed star.
  drawContext.beginPath();
  drawContext.moveTo(x, y - r);
  drawContext.quadraticCurveTo(x, y, x + r, y);
  drawContext.quadraticCurveTo(x, y, x, y + r);
  drawContext.quadraticCurveTo(x, y, x - r, y);
  drawContext.quadraticCurveTo(x, y, x, y - r);
  drawContext.fillStyle = colour;
  drawContext.fill();
  setInk(1.2);
}

function setPipelineIcon(main, accent, cream, seconds) {
  // The nightly pipeline: a database with a twinkling star over it.
  setCylinder(0, -8, 9, 11, 4.5, main, cream);
  drawContext.beginPath();
  drawContext.ellipse(0, 4.5, 11, 4.5, 0, 0, Math.PI, false);
  setInk(1.5);
  setSparkle(12, -14, 4.5 + Math.sin(seconds * 4) * 1.2, getSunColour("--sun-glow", 1));
}

function setMigrateIcon(main, accent, cream, seconds) {
  // The migration: an arrow carrying data from an old database to a new one.
  setCylinder(-9, 0, 10, 6, 2.6, getSunColour("--tan", 1), cream);
  setCylinder(9, 0, 10, 6, 2.6, main, cream);
  drawContext.beginPath();
  drawContext.moveTo(-9, -5);
  drawContext.quadraticCurveTo(-1, -20, 7, -7);
  drawContext.lineCap = "round";
  drawContext.lineWidth = 5.4;
  drawContext.strokeStyle = getSunColour(SUN.outline, 0.9);
  drawContext.stroke();
  drawContext.lineWidth = 3;
  drawContext.strokeStyle = accent;
  drawContext.stroke();
  drawContext.beginPath();
  drawContext.moveTo(9.6, -2.6);
  drawContext.lineTo(4.2, -5.4);
  drawContext.lineTo(10.2, -9.2);
  drawContext.closePath();
  drawContext.fillStyle = accent;
  drawContext.fill();
  setInk(1.5);
  // A data dot travelling along the arrow (a point on its curve).
  const t = (seconds * 0.7) % 1;
  const dotX = (1 - t) * (1 - t) * -9 + 2 * (1 - t) * t * -1 + t * t * 7;
  const dotY = (1 - t) * (1 - t) * -5 + 2 * (1 - t) * t * -20 + t * t * -7;
  setFilledEllipse(dotX, dotY, 1.6, 1.6, cream, 0);
}

function setDiagnosticsIcon(main, accent, cream, seconds) {
  // A pipeline that reports on itself: a monitor with a heartbeat line.
  setRoundedBox(-6, 7, 12, 4, 1);
  drawContext.fillStyle = main;
  drawContext.fill();
  setInk(1.8);
  setRoundedBox(-14, -12, 28, 20, 4);
  drawContext.fillStyle = main;
  drawContext.fill();
  setInk(2.2);
  setRoundedBox(-11, -9, 22, 14, 2.5);
  drawContext.fillStyle = getSunColour("--navy", 1);
  drawContext.fill();
  setInk(1.4);
  const points = [[-9, -2], [-5, -2], [-3, -7], [0, 3], [3, -4], [5, -2], [9, -2]];
  drawContext.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      drawContext.moveTo(points[i][0], points[i][1]);
    } else {
      drawContext.lineTo(points[i][0], points[i][1]);
    }
  }
  drawContext.lineWidth = 1.8;
  drawContext.lineJoin = "round";
  drawContext.strokeStyle = getSunColour("--sage", 1);
  drawContext.stroke();
  // A bright blip runs along the line.
  const x = -9 + ((seconds * 0.8) % 1) * 18;
  let y = -2;
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const share = (x - points[i - 1][0]) / (points[i][0] - points[i - 1][0]);
      y = points[i - 1][1] + (points[i][1] - points[i - 1][1]) * share;
      break;
    }
  }
  setFilledEllipse(x, y, 1.7, 1.7, accent, 0);
}

function setDocsIcon(main, accent, cream, seconds) {
  // Writing it down: an open book with lines of text and a ribbon.
  drawContext.beginPath();
  drawContext.moveTo(-16, -7);
  drawContext.lineTo(-16, 12);
  drawContext.quadraticCurveTo(-7, 9, 0, 13);
  drawContext.quadraticCurveTo(7, 9, 16, 12);
  drawContext.lineTo(16, -7);
  drawContext.closePath();
  drawContext.fillStyle = main;
  drawContext.fill();
  setInk(2.2);
  for (const side of [-1, 1]) {
    drawContext.beginPath();
    drawContext.moveTo(0, -9);
    drawContext.quadraticCurveTo(side * 7, -12, side * 14, -10);
    drawContext.lineTo(side * 14, 9);
    drawContext.quadraticCurveTo(side * 7, 7, 0, 10);
    drawContext.closePath();
    drawContext.fillStyle = cream;
    drawContext.fill();
    setInk(1.8);
    for (let k = 0; k < 3; k++) {
      drawContext.beginPath();
      drawContext.moveTo(side * 3, -5 + k * 4);
      drawContext.lineTo(side * 11, -5.8 + k * 4);
      drawContext.lineWidth = 1.1;
      drawContext.strokeStyle = getSunColour(SUN.outline, 0.55);
      drawContext.stroke();
    }
  }
  drawContext.beginPath();
  drawContext.moveTo(5, 9);
  drawContext.lineTo(5 + Math.sin(seconds * 2) * 1.5, 16);
  drawContext.lineCap = "round";
  drawContext.lineWidth = 2.4;
  drawContext.strokeStyle = accent;
  drawContext.stroke();
}

function setAboutIcon(main, accent, cream, seconds) {
  // About me: a little bust with curly hair, like the big one.
  const look = SUN.avatar;
  drawContext.beginPath();
  drawContext.moveTo(-13, 15);
  drawContext.quadraticCurveTo(-13, 3, 0, 3);
  drawContext.quadraticCurveTo(13, 3, 13, 15);
  drawContext.closePath();
  drawContext.fillStyle = look.flannel;
  drawContext.fill();
  setInk(2.2);
  setFilledEllipse(0, -5, 7.5, 8.5, look.skin, 2);
  const curls = [[-6, -11, 3.6], [-1, -13.5, 4], [5, -12, 3.6], [-8, -6, 2.4], [8, -7, 2.4]];
  for (const curl of curls) {
    setFilledEllipse(curl[0], curl[1], curl[2], curl[2], look.hair, 1.4);
  }
  drawContext.beginPath();
  drawContext.moveTo(-3.5, -1);
  drawContext.quadraticCurveTo(0, 2.5, 3.5, -1);
  setInk(1.4);
  setRoundedBox(-5.6, -7, 4.6, 3.2, 1.2);
  drawContext.fillStyle = look.lens;
  drawContext.fill();
  setRoundedBox(1, -7, 4.6, 3.2, 1.2);
  drawContext.fill();
}

function setContactIcon(main, accent, cream, seconds) {
  // Get in touch: an envelope, its flap in the planet's colour.
  setRoundedBox(-15, -10, 30, 21, 3);
  drawContext.fillStyle = cream;
  drawContext.fill();
  setInk(2.2);
  drawContext.beginPath();
  drawContext.moveTo(-15, 11);
  drawContext.lineTo(-3, 1);
  drawContext.moveTo(15, 11);
  drawContext.lineTo(3, 1);
  setInk(1.3);
  drawContext.beginPath();
  drawContext.moveTo(-14, -9);
  drawContext.lineTo(0, 3);
  drawContext.lineTo(14, -9);
  drawContext.closePath();
  drawContext.fillStyle = main;
  drawContext.fill();
  setInk(2);
  setFilledEllipse(0, 1.5, 2.6, 2.6, accent, 1.2);
}

function setPlanetIcon(px, py, size, planet, seconds, seed) {
  // A planet drawn as its icon, rocking gently, with a soft glow behind it in
  // its own colour so it stands out against the painting.
  const glow = drawContext.createRadialGradient(px, py, size * 0.3, px, py, size * 2.2);
  glow.addColorStop(0, getSunColour(planet.colour, 0.5));
  glow.addColorStop(1, getSunColour(planet.colour, 0));
  drawContext.fillStyle = glow;
  drawContext.beginPath();
  drawContext.arc(px, py, size * 2.2, 0, Math.PI * 2);
  drawContext.fill();

  const main = getSunColour(planet.colour, 1);
  const accent = getSunColour(planet.stripe, 1);
  const cream = getSunColour("--cream", 1);
  drawContext.save();
  drawContext.translate(px, py);
  drawContext.rotate(Math.sin(seconds * 1.3 + seed) * SUN.iconRock);
  drawContext.scale(size / 13, size / 13);
  if (planet.icon === "pipeline") {
    setPipelineIcon(main, accent, cream, seconds);
  } else if (planet.icon === "migrate") {
    setMigrateIcon(main, accent, cream, seconds);
  } else if (planet.icon === "diagnostics") {
    setDiagnosticsIcon(main, accent, cream, seconds);
  } else if (planet.icon === "docs") {
    setDocsIcon(main, accent, cream, seconds);
  } else if (planet.icon === "about") {
    setAboutIcon(main, accent, cream, seconds);
  } else if (planet.icon === "contact") {
    setContactIcon(main, accent, cream, seconds);
  } else {
    // An icon name with no drawing yet: a plain sparkle, so nothing goes missing.
    setSparkle(0, 0, 12, main);
  }
  drawContext.restore();
}

function setPlanetTrailPoint(index, dx, dy, seconds) {
  // Remembers where the planet has been (skipping tiny moves), and forgets
  // anything older than trailLife.
  const trail = sunState.planetTrails[index];
  const last = trail[trail.length - 1];
  if (!last || Math.hypot(dx - last.dx, dy - last.dy) > 1.5) {
    trail.push({ dx: dx, dy: dy, time: seconds });
  }
  while (trail.length > 0 && seconds - trail[0].time > SUN.trailLife) {
    trail.shift();
  }
}

function setPlanetTrail(centre, index, size, colour, seconds) {
  // Cartoon trail: an ink outline, then the planet's colour inside it,
  // thinning and fading towards the tail.
  const trail = sunState.planetTrails[index];
  if (trail.length < 2) {
    return;
  }
  drawContext.lineCap = "round";
  drawContext.lineJoin = "round";
  const passes = [
    { ink: true, width: 1.0 },
    { ink: false, width: 0.6 },
  ];
  for (const pass of passes) {
    for (let i = 1; i < trail.length; i++) {
      const from = trail[i - 1];
      const to = trail[i];
      const life = Math.max(0, 1 - (seconds - to.time) / SUN.trailLife);
      drawContext.beginPath();
      drawContext.moveTo(centre + from.dx, centre + from.dy);
      drawContext.lineTo(centre + to.dx, centre + to.dy);
      drawContext.lineWidth = size * SUN.trailWidth * pass.width * (0.25 + 0.75 * life);
      if (pass.ink) {
        drawContext.strokeStyle = getSunColour(SUN.outline, 0.55 * life);
      } else {
        drawContext.strokeStyle = getSunColour(colour, 0.8 * life);
      }
      drawContext.stroke();
    }
  }
}

function setPlanetRing(px, py, size, front, seconds) {
  // A tilted ring that slowly rocks; drawn in two halves so the planet sits inside it.
  const tilt = -0.35 + 0.25 * Math.sin(seconds * 0.9);
  drawContext.beginPath();
  if (front) {
    drawContext.ellipse(px, py, size * 1.9, size * 0.6, tilt, 0, Math.PI);
  } else {
    drawContext.ellipse(px, py, size * 1.9, size * 0.6, tilt, Math.PI, Math.PI * 2);
  }
  drawContext.lineWidth = Math.max(2, size * 0.32);
  drawContext.strokeStyle = getSunColour("--horizon", 1);
  drawContext.lineCap = "round";
  drawContext.stroke();
}

function setPlanets(centre, seconds) {
  sunState.planetSpots = [];
  const active = getActivePlanet();

  // Where everyone is, and their trails (all trails first, so planets sit on top).
  // Planets still hidden out in the world (hunt.js) don't orbit yet.
  for (let i = 0; i < sunState.planetCount; i++) {
    if (!getIsInOrbit(i)) {
      sunState.planetSpots.push(null);
      sunState.planetTrails[i] = [];
      continue;
    }
    const offset = getPlanetOffset(i);
    const size = Math.max(4, SUN.planets[i].size * sunState.scale);
    sunState.planetSpots.push({ dx: offset.dx, dy: offset.dy, size: size });
    if (active === null) {
      setPlanetTrailPoint(i, offset.dx, offset.dy, seconds);
    }
    setPlanetTrail(centre, i, size, SUN.planets[i].colour, seconds);
  }

  for (let i = 0; i < sunState.planetCount; i++) {
    const planet = SUN.planets[i];
    const spot = sunState.planetSpots[i];
    if (spot === null) {
      continue;
    }
    let size = spot.size;
    const px = centre + spot.dx;
    const py = centre + spot.dy;

    if (active === i) {
      // A happy little bounce and a soft halo while it's the one in focus.
      size = size * (1.3 + 0.06 * Math.sin(seconds * 9));
      drawContext.beginPath();
      drawContext.arc(px, py, size * 1.8, 0, Math.PI * 2);
      drawContext.fillStyle = getSunColour("--cream", 0.2);
      drawContext.fill();
    }

    const hasRing = planet.ring && !planet.icon;
    if (hasRing) {
      setPlanetRing(px, py, size, false, seconds);
    }
    setPlanetBody(px, py, size, planet, centre, centre, seconds, i);
    if (hasRing) {
      setPlanetRing(px, py, size, true, seconds);
    }
    if (planet.moon && !planet.icon) {
      const moonAngle = seconds * 1.8 + i;
      const moonDistance = size * 2.4;
      setPlanetBody(
        px + Math.cos(moonAngle) * moonDistance,
        py + Math.sin(moonAngle) * moonDistance,
        Math.max(2.5, size * 0.38), { colour: "--cream", stripe: null }, centre, centre, seconds, i + 10
      );
    }
  }
}

// ---------- Label and panel ----------

function getPlanetScreenPoint(index) {
  const spot = sunState.planetSpots[index];
  if (!spot) {
    return null;
  }
  const pageBox = backgroundPage.getBoundingClientRect();
  return {
    x: pageBox.left + sunState.x + spot.dx,
    y: pageBox.top + sunState.y + spot.dy,
    size: spot.size,
  };
}

function getPlanetAt(clientX, clientY) {
  // Which planet (if any) is under this point on the screen.
  if (!sunState.hasPosition) {
    return null;
  }
  for (let i = 0; i < sunState.planetSpots.length; i++) {
    const point = getPlanetScreenPoint(i);
    if (point === null) {
      continue;
    }
    if (Math.hypot(clientX - point.x, clientY - point.y) <= point.size + SUN.hoverReach) {
      return i;
    }
  }
  return null;
}

function getIsOverPlanet(clientX, clientY) {
  // Used by pointer-effects.js so clicking a planet (orbiting or still hidden
  // out in the world) doesn't move the orb.
  if (getPlanetAt(clientX, clientY) !== null) {
    return true;
  }
  if (typeof getWildPlanetAt === "function") {
    return getWildPlanetAt(clientX, clientY, true) !== null;
  }
  return false;
}

function getIsPanelOpen() {
  // Used by pointer-effects.js: a click while a panel is open just closes it
  // (that click may arrive just after this file has closed the panel).
  return sunState.panelPlanet !== null || performance.now() - sunState.panelClosedAt < 150;
}

// ---------- The view ----------

function setViewOnOrb(smooth) {
  // Scrolls the world so the orb sits in the middle of the screen. Once
  // flight.js is running its camera follows the orb anyway.
  if (typeof setCameraOnOrb === "function") {
    setCameraOnOrb(smooth);
    return;
  }
  let point = getCentrePagePoint();
  if (sunState.hasPosition) {
    point = { x: sunState.toX, y: sunState.toY };
  }
  const pageBox = backgroundPage.getBoundingClientRect();
  let behavior = "auto";
  if (smooth && !sunMotion.matches) {
    behavior = "smooth";
  }
  window.scrollTo({
    left: window.scrollX + pageBox.left + point.x - window.innerWidth / 2,
    top: window.scrollY + pageBox.top + point.y - window.innerHeight / 2,
    behavior: behavior,
  });
}

function getIsPlanetOnScreen(index) {
  const point = getPlanetScreenPoint(index);
  if (!point) {
    return true;
  }
  return point.x > 0 && point.y > 0 && point.x < window.innerWidth && point.y < window.innerHeight;
}

function getIsOnInterface(target) {
  // Links, buttons, the label and the panel handle their own pointer events.
  if (!target || !target.closest) {
    return false;
  }
  return target.closest("a, button, input, .planet-panel, .planet-label, .contents") !== null;
}

function setLabelShown(index) {
  const item = getPlanetItem(index);
  if (!item || sunState.panelPlanet !== null) {
    return;
  }
  if (sunState.labelPlanet !== index || planetLabel.dataset.wild === "true") {
    planetLabel.dataset.wild = "false";
    planetLabel.querySelector(".planet-label-tag").textContent = item.tag;
    planetLabel.querySelector(".planet-label-title").textContent = item.title;
    planetLabel.style.setProperty("--planet-colour", "var(" + SUN.planets[index].colour + ")");
    planetLabel.hidden = false;
    planetLabel.classList.remove("is-popping");
    void planetLabel.offsetWidth;
    planetLabel.classList.add("is-popping");
  }
  sunState.labelPlanet = index;
  setLabelPosition();
}

function setLabelHidden() {
  planetLabel.hidden = true;
  sunState.labelPlanet = null;
}

function setLabelPosition() {
  // Keeps the label just above its planet, inside the screen.
  if (sunState.labelPlanet === null) {
    return;
  }
  const point = getPlanetScreenPoint(sunState.labelPlanet);
  if (!point) {
    return;
  }
  planetLabel.style.left = Math.min(window.innerWidth - 120, Math.max(120, point.x)) + "px";
  planetLabel.style.top = Math.max(70, point.y - point.size * 1.6) + "px";
}

function setPanelShown(index) {
  const item = getPlanetItem(index);
  if (!item) {
    return;
  }
  setLabelHidden();
  planetPanel.querySelector(".planet-panel-tag").textContent = item.tag;
  planetPanel.querySelector(".planet-panel-title").textContent = item.title;
  const text = planetPanel.querySelector(".planet-panel-text");
  text.textContent = "";
  for (const paragraph of item.paragraphs) {
    const line = document.createElement("p");
    line.textContent = paragraph;
    text.appendChild(line);
  }

  const tools = planetPanel.querySelector(".planet-panel-tools");
  tools.textContent = "";
  for (const tool of item.tools) {
    const chip = document.createElement("li");
    chip.textContent = tool;
    tools.appendChild(chip);
  }
  const links = planetPanel.querySelector(".planet-panel-links");
  links.textContent = "";
  for (const link of item.links) {
    const button = document.createElement("a");
    button.textContent = link.label;
    button.href = link.href;
    if (link.href.indexOf("http") === 0) {
      button.target = "_blank";
      button.rel = "noopener";
    }
    links.appendChild(button);
  }

  planetPanel.style.setProperty("--planet-colour", "var(" + SUN.planets[index].colour + ")");
  planetPanel.hidden = false;
  planetPanel.classList.remove("is-popping");
  void planetPanel.offsetWidth;
  planetPanel.classList.add("is-popping");
  sunState.panelPlanet = index;
  planetPanel.querySelector(".planet-panel-close").focus({ preventScroll: true });
}

function setPanelHidden() {
  if (sunState.panelPlanet === null) {
    return;
  }
  planetPanel.hidden = true;
  sunState.panelPlanet = null;
  sunState.panelClosedAt = performance.now();
}

// ---------- Pointer and keyboard ----------

function setHoverFromPointer(event) {
  sunState.lastPointerType = event.pointerType || "mouse";
  let index = null;
  if (!getIsOnInterface(event.target)) {
    index = getPlanetAt(event.clientX, event.clientY);
  }
  const changed = index !== sunState.hovered;
  sunState.hovered = index;
  let wild = null;
  if (index === null && !getIsOnInterface(event.target) && typeof getWildPlanetAt === "function") {
    wild = getWildPlanetAt(event.clientX, event.clientY);
  }
  if (typeof setWildHover === "function") {
    setWildHover(wild);
  }
  document.body.classList.toggle("is-over-planet", index !== null || wild !== null);

  if (wild !== null) {
    setLabelHidden();
  } else if (index !== null) {
    setLabelShown(index);
  } else if (sunState.focused !== null) {
    setLabelShown(sunState.focused);
  } else {
    setLabelHidden();
  }
  if (changed && sunMotion.matches) {
    setSunFrame(getSunSeconds());
  }
}

function setPlanetPointerDown(event) {
  sunState.lastPointerType = event.pointerType || "mouse";
  pageHint.classList.add("is-gone");
  if (getIsOnInterface(event.target)) {
    return;
  }
  // Touch has no hover, so a tap on a planet opens it straight away.
  if (sunState.lastPointerType === "touch") {
    const index = getPlanetAt(event.clientX, event.clientY);
    if (index !== null) {
      setPanelShown(index);
    }
  }
}

function setPlanetClick(event) {
  if (getIsOnInterface(event.target)) {
    return;
  }
  if (typeof getWildPlanetAt === "function") {
    const wild = getWildPlanetAt(event.clientX, event.clientY);
    if (wild !== null) {
      setCatchPlanet(wild);
      return;
    }
  }
  const index = getPlanetAt(event.clientX, event.clientY);
  if (index !== null) {
    if (sunState.lastPointerType !== "touch") {
      setPanelShown(index);
    }
    return;
  }
  // A click anywhere else closes an open panel.
  setPanelHidden();
}

function setKeyboardFocus(index) {
  // Tabbing through the hidden list highlights each planet in turn.
  sunState.focused = index;
  if (index === null) {
    if (sunState.hovered === null) {
      setLabelHidden();
    }
    return;
  }
  if (!getIsInOrbit(index)) {
    // Still hidden: nothing to point at yet (Enter catches it).
    return;
  }
  if (!getIsPlanetOnScreen(index)) {
    setViewOnOrb(true);
  }
  setLabelShown(index);
}

function setKeyboardHandlers() {
  // Only the titles are Tab stops: the list is invisible, so its other links
  // would be invisible stops too. (They still show as buttons in the panel,
  // and screen readers can still read them.)
  for (const link of document.querySelectorAll(".planet-list a:not(.planet-title)")) {
    link.tabIndex = -1;
  }
  for (let i = 0; i < planetItems.length; i++) {
    const title = planetItems[i].querySelector(".planet-title");
    if (!title) {
      continue;
    }
    title.addEventListener("focus", function () {
      setKeyboardFocus(i);
    });
    title.addEventListener("blur", function () {
      setKeyboardFocus(null);
    });
    title.addEventListener("click", function (event) {
      event.preventDefault();
      if (!getIsInOrbit(i) && typeof setCatchPlanet === "function") {
        setCatchPlanet(i);
        return;
      }
      setPanelShown(i);
    });
  }
  planetPanel.querySelector(".planet-panel-close").addEventListener("click", function () {
    const index = sunState.panelPlanet;
    setPanelHidden();
    // Return keyboard focus to that planet's entry in the list.
    if (index !== null && planetItems[index]) {
      const title = planetItems[index].querySelector(".planet-title");
      if (title) {
        title.focus({ preventScroll: true });
      }
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setPanelHidden();
    }
  });
}

// ---------- Frame ----------

function setSunFrame(seconds) {
  setSunTarget(seconds);
  setSunPosition(seconds);
  setAvatarMotion(seconds);

  // The planets' clock stops while one is in focus, so labels stay put.
  const step = Math.max(0, Math.min(0.1, seconds - sunState.lastSeconds));
  sunState.lastSeconds = seconds;
  if (getActivePlanet() === null && !sunMotion.matches) {
    sunState.orbitTime += step;
  }

  setDrawContext(null);
  sunContext.clearRect(0, 0, sunState.boxSize, sunState.boxSize);
  const centre = sunState.boxSize / 2;
  let breathing = 1;
  if (!sunMotion.matches) {
    breathing = 1 + 0.03 * Math.sin(seconds * 1.1);
  }
  if (getActivePlanet() !== null) {
    breathing = breathing * 1.06;
  }
  const radius = SUN.coreRadius * sunState.scale * breathing;

  setOrbGlow(centre, radius);
  setPlanets(centre, seconds);
  setOrb(centre, radius, seconds);
  setLabelPosition();

  if (seconds > SUN.hintTime) {
    pageHint.classList.add("is-gone");
  }
}

function setSunAnimation(now) {
  sunState.frame = requestAnimationFrame(setSunAnimation);
  if (now - sunState.lastFrame < 1000 / SUN.fps) {
    return;
  }
  sunState.lastFrame = now;
  setSunFrame(getSunSeconds());
}

function setSunMotion() {
  // Animates normally; with reduced motion, draws one still frame (and redraws
  // when the orb moves, the screen changes size, or a planet is in focus).
  cancelAnimationFrame(sunState.frame);
  if (sunMotion.matches) {
    setSunFrame(0);
    return;
  }
  sunState.frame = requestAnimationFrame(setSunAnimation);
}

function setSunLayout() {
  setSunScale();
  sunState.hasPosition = false;
  setSunFrame(getSunSeconds());
}

sunState.planetCount = Math.min(SUN.planets.length, planetItems.length);
for (let i = 0; i < sunState.planetCount; i++) {
  SUN.planets[i].icon = planetItems[i].dataset.icon || null;
}
setPlanetOrbits();
setSunScale();
setKeyboardHandlers();
setSunMotion();

// Open centred on the orb (again once everything has loaded, unless the
// visitor has already started exploring).
setViewOnOrb(false);
window.addEventListener("load", function () {
  if (!sunState.viewMoved) {
    setViewOnOrb(false);
  }
});
for (const name of ["wheel", "touchmove", "keydown", "pointerdown"]) {
  window.addEventListener(name, function () {
    sunState.viewMoved = true;
  }, { passive: true });
}
window.addEventListener("scroll", setLabelPosition, { passive: true });
document.querySelector(".mark").addEventListener("click", function (event) {
  event.preventDefault();
  if (typeof setOrbHome === "function") {
    setOrbHome();
  } else {
    setViewOnOrb(true);
  }
});
sunMotion.addEventListener("change", setSunMotion);
window.addEventListener("resize", setSunLayout);
window.addEventListener("pointermove", setHoverFromPointer, { passive: true });
window.addEventListener("pointerdown", setPlanetPointerDown, { passive: true });
window.addEventListener("click", setPlanetClick);
window.addEventListener("pointerdown", function () {
  // With reduced motion there's no animation loop, so redraw after a click
  // moves the centre point.
  if (sunMotion.matches) {
    requestAnimationFrame(function () {
      setSunFrame(0);
    });
  }
});
