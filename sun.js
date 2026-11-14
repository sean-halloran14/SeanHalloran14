// =============================================================================
// The orb and its planets
// =============================================================================
// The background's centre point (background.js) is drawn as a glowing
// cartoon of me: a big ink-outlined head with curly hair and a wide grin, on
// small shoulders in a blue tee with backpack straps, bobbing gently and
// blinking now and then, with a warm glow and wavy aura rings round it (it's
// still called the orb in the code). The rays streaming from it come from
// background.js.
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
  coreRadius: 72,          // size of the cartoon (its head is about this wide), px
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
    eyes: "#3a2a20",
    mouth: "#7a1f2b",
    teeth: "#fff8ee",
    shirt: "#5e7ca6",
    shirtShade: "#47628c",
    strap: "#23262f",
    buckle: "#9aa3ad",
    bob: 2,                // how far it bobs, in the cartoon's own units
    blinkEvery: 4.3,       // seconds between blinks
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
  const textElement = item.querySelector(".planet-text");
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
  let text = "";
  if (textElement) {
    text = textElement.textContent.trim();
  }
  return { tag: item.dataset.tag || "", title: title, text: text, tools: tools, links: links };
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
// Drawn in its own units: the head is about 70 across, a little above the
// middle, with the shoulders below.

function setAvatarBody() {
  const look = SUN.avatar;
  // Shoulders in a blue tee.
  drawContext.beginPath();
  drawContext.moveTo(-13, 27);
  drawContext.quadraticCurveTo(-40, 31, -46, 58);
  drawContext.quadraticCurveTo(0, 74, 46, 58);
  drawContext.quadraticCurveTo(40, 31, 13, 27);
  drawContext.closePath();
  drawContext.fillStyle = look.shirt;
  drawContext.fill();
  setInk(3);
  // Shade down the far side.
  drawContext.save();
  drawContext.clip();
  drawContext.beginPath();
  drawContext.ellipse(34, 52, 16, 26, -0.3, 0, Math.PI * 2);
  drawContext.fillStyle = look.shirtShade;
  drawContext.fill();
  drawContext.restore();
  // Neck and collar.
  drawContext.beginPath();
  drawContext.moveTo(-9, 16);
  drawContext.lineTo(-10, 30);
  drawContext.quadraticCurveTo(0, 36, 10, 30);
  drawContext.lineTo(9, 16);
  drawContext.closePath();
  drawContext.fillStyle = look.skinShade;
  drawContext.fill();
  setInk(2.5);
  drawContext.beginPath();
  drawContext.moveTo(-12, 29);
  drawContext.quadraticCurveTo(0, 38, 12, 29);
  drawContext.strokeStyle = look.shirtShade;
  drawContext.lineWidth = 3.5;
  drawContext.stroke();
  // Backpack straps with buckles.
  for (const side of [-1, 1]) {
    drawContext.beginPath();
    drawContext.moveTo(side * 21, 30);
    drawContext.quadraticCurveTo(side * 31, 44, side * 27, 66);
    drawContext.lineWidth = 10;
    drawContext.strokeStyle = getSunColour(SUN.outline, 0.9);
    drawContext.stroke();
    drawContext.lineWidth = 7;
    drawContext.strokeStyle = look.strap;
    drawContext.stroke();
    setRoundedBox(side * 29 - 4.5, 44, 9, 6, 1.5);
    drawContext.fillStyle = look.buckle;
    drawContext.fill();
    setInk(1.5);
  }
}

function setHairCurls(curls, seconds, inkWidth) {
  // A mop of curls: every curl in ink first (a little bigger), then all of
  // them in colour, so the outline only shows round the outside. Each curl
  // bounces a little and gets a highlight swirl.
  const look = SUN.avatar;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < curls.length; i++) {
      const curl = curls[i];
      const bounce = Math.sin(seconds * 2.6 + i * 1.3) * 0.5;
      drawContext.beginPath();
      if (pass === 0) {
        drawContext.arc(curl[0], curl[1], curl[2] + bounce + inkWidth, 0, Math.PI * 2);
        drawContext.fillStyle = getSunColour(SUN.outline, 0.95);
      } else {
        drawContext.arc(curl[0], curl[1], curl[2] + bounce, 0, Math.PI * 2);
        drawContext.fillStyle = look.hair;
      }
      drawContext.fill();
    }
  }
  drawContext.lineCap = "round";
  for (let i = 0; i < curls.length; i++) {
    const curl = curls[i];
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

function setAvatarFace(seconds) {
  const look = SUN.avatar;
  // Ears, then the hair behind the head, then the face.
  setFilledEllipse(-33, 0, 6, 9, look.skin, 2.5);
  setFilledEllipse(33, 0, 6, 9, look.skin, 2.5);
  setHairCurls([
    [-30, -16, 13], [-20, -31, 15], [-2, -37, 17], [17, -33, 15], [31, -19, 13],
    [-36, -4, 8], [36, -5, 8],
  ], seconds, 2.8);
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
  setFilledEllipse(-19, 9, 6, 3.5, look.blush, 0);
  setFilledEllipse(19, 9, 6, 3.5, look.blush, 0);

  // Eyebrows.
  drawContext.lineCap = "round";
  for (const side of [-1, 1]) {
    drawContext.beginPath();
    drawContext.moveTo(side * 19, -12);
    drawContext.quadraticCurveTo(side * 12, -17, side * 5, -13);
    drawContext.lineWidth = 3.2;
    drawContext.strokeStyle = look.hair;
    drawContext.stroke();
  }
  // Smiling eyes that blink now and then.
  const blinking = (seconds % look.blinkEvery) < 0.14;
  for (const side of [-1, 1]) {
    const x = side * 12;
    if (blinking) {
      drawContext.beginPath();
      drawContext.moveTo(x - 6, -4);
      drawContext.quadraticCurveTo(x, -1, x + 6, -4);
      setInk(2);
    } else {
      setFilledEllipse(x, -4, 6.5, 4.6, look.teeth, 1.8);
      setFilledEllipse(x + 0.6, -3.6, 3.1, 3.3, look.eyes, 0);
      setFilledEllipse(x + 1.7, -5, 1.1, 1.1, look.teeth, 0);
    }
    // Smile creases under the eyes.
    drawContext.beginPath();
    drawContext.moveTo(x - 5, 2);
    drawContext.quadraticCurveTo(x, 4.5, x + 5, 2);
    drawContext.lineWidth = 1.2;
    drawContext.strokeStyle = getSunColour(SUN.outline, 0.45);
    drawContext.stroke();
  }
  // Nose.
  drawContext.beginPath();
  drawContext.moveTo(1, -3);
  drawContext.quadraticCurveTo(6, 7, 0, 9);
  setInk(2);
  // A big grin with a row of teeth.
  drawContext.beginPath();
  drawContext.moveTo(-15, 13);
  drawContext.quadraticCurveTo(0, 17, 15, 13);
  drawContext.quadraticCurveTo(0, 33, -15, 13);
  drawContext.closePath();
  drawContext.fillStyle = look.mouth;
  drawContext.fill();
  drawContext.save();
  drawContext.clip();
  drawContext.fillStyle = look.teeth;
  drawContext.fillRect(-16, 10, 32, 9);
  drawContext.restore();
  drawContext.beginPath();
  drawContext.moveTo(-15, 13);
  drawContext.quadraticCurveTo(0, 17, 15, 13);
  drawContext.quadraticCurveTo(0, 33, -15, 13);
  drawContext.closePath();
  setInk(2.5);
  for (const side of [-1, 1]) {
    drawContext.beginPath();
    drawContext.arc(side * 17, 12, 3, side * 0.2 - 1.2, side * 0.2 + 1.2);
    drawContext.lineWidth = 1.5;
    drawContext.strokeStyle = getSunColour(SUN.outline, 0.6);
    drawContext.stroke();
  }
  // The fringe of curls over the forehead.
  setHairCurls([
    [-25, -21, 9], [-13, -28, 10], [1, -30, 10.5], [14, -27, 10], [25, -19, 8.5],
  ], seconds + 0.7, 2.2);
}

function setOrb(centre, radius, seconds) {
  // The cartoon, bobbing gently (and bouncing while it celebrates).
  setOrbAura(centre, radius, seconds);
  const look = SUN.avatar;
  let bob = 0;
  if (!sunMotion.matches) {
    bob = Math.sin(seconds * 2) * look.bob;
    if (seconds < sunState.celebrateUntil) {
      bob = -Math.abs(Math.sin(seconds * 9)) * look.bob * 4;
    }
  }
  drawContext.save();
  drawContext.translate(centre, centre);
  drawContext.scale(radius / 40, radius / 40);
  drawContext.translate(0, bob);
  setAvatarBody();
  drawContext.translate(0, -12);
  drawContext.rotate(Math.sin(seconds * 0.9) * 0.04);
  setAvatarFace(seconds);
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
  drawContext.fillStyle = look.shirt;
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
  setFilledEllipse(-2.8, -5, 1, 1.2, look.eyes, 0);
  setFilledEllipse(2.8, -5, 1, 1.2, look.eyes, 0);
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
  planetPanel.querySelector(".planet-panel-text").textContent = item.text;

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
