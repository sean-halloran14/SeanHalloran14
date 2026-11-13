// =============================================================================
// The orb and its planets
// =============================================================================
// The background's centre point (background.js) is drawn as a glowing orb: an
// abstract, slowly morphing blob built from layers of the palette's warm
// colours, with soft lumpy edges and a cosy cartoon outline. The rings pouring
// out of the point and the rays streaming from it come from background.js.
//
// The orb's layers throb out of step, a spiral turns inside it and wavy aura
// rings pulse out from it. Planets circle it in the page's own colours, each
// a wobbly blob with a turning stripe, on its own randomly shaped orbit (a
// tilted oval that slowly turns, with little loops in it), leaving its own
// fading cartoon trail behind it. Each
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
  coreRadius: 40,          // size of the orb, px
  outline: "--brown-deep", // outline colour
  outlineWidth: 3,         // px
  // The orb's layers, outside in: colour, size (share of coreRadius), how
  // lumpy the edge is, and how fast its lumps drift (negative = other way).
  layers: [
    { colour: "--ember", size: 1.3, lumps: 0.09, drift: 0.22 },
    { colour: "--sunset", size: 1.05, lumps: 0.08, drift: -0.3 },
    { colour: "--sun-glow", size: 0.78, lumps: 0.1, drift: 0.38 },
    { colour: "--horizon", size: 0.52, lumps: 0.12, drift: -0.5 },
    { colour: "--sun-core", size: 0.28, lumps: 0.14, drift: 0.65 },
  ],
  glowRadius: 4.5,         // warm halo size, as a multiple of the orb
  glowStrength: 0.26,      // halo opacity (0-1)
  glide: 1.1,              // seconds for the orb to glide to a clicked spot
  followDistance: 90,      // moves smaller than this (flying) are followed at once, px
  layerPulse: 0.08,        // how much the orb's layers throb (share of their size)
  spiralArms: 4,           // arms of the spiral inside the orb
  spiralTwist: 4.5,        // how tightly it winds, radians from centre to edge
  spiralSpeed: 0.9,        // how fast it turns, radians per second
  auraRings: 3,            // wavy rings pulsing out from the orb
  auraSpeed: 0.35,         // how fast they pulse out
  planetWobble: 0.09,      // how blobby the planets are (share of their size)
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
  // same position in .planet-list. Orbit distance (px), size (px), colour and
  // stripe colour from styles.css, and extras. Speeds follow the orbit.
  planets: [
    { orbit: 95, size: 8, colour: "--sky-light", stripe: "--sky", ring: false, moon: false },
    { orbit: 145, size: 10, colour: "--sage", stripe: "--forest", ring: false, moon: true },
    { orbit: 195, size: 9, colour: "--tan", stripe: "--sunset", ring: true, moon: false },
    { orbit: 245, size: 12, colour: "--sky", stripe: "--sky-light", ring: false, moon: false },
    { orbit: 295, size: 9, colour: "--olive", stripe: "--sage", ring: false, moon: false },
    { orbit: 345, size: 11, colour: "--horizon", stripe: "--ember", ring: false, moon: true },
    { orbit: 395, size: 10, colour: "--cream", stripe: "--horizon", ring: true, moon: false },
    { orbit: 445, size: 9, colour: "--earth", stripe: "--tan-dark", ring: false, moon: true },
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

function getLayerSize(layer, index, seconds) {
  // Each layer swells and shrinks out of step with its neighbours, so the orb
  // seems to throb from the inside out.
  let pulse = SUN.layerPulse;
  let speed = 2.2;
  if (seconds < sunState.celebrateUntil) {
    pulse = pulse * 3;
    speed = 6;
  }
  return layer.size * (1 + pulse * Math.sin(seconds * speed - index * 1.1));
}

function setOrbSpiral(centre, radius, seconds) {
  // A slowly turning hypnotic spiral inside the orb, clipped to its edge.
  const outer = SUN.layers[0];
  drawContext.save();
  setBlobPath(centre, centre, radius * getLayerSize(outer, 0, seconds), outer.lumps, outer.drift, seconds, 0, 64);
  drawContext.clip();
  drawContext.lineCap = "round";
  for (let arm = 0; arm < SUN.spiralArms; arm++) {
    drawContext.beginPath();
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const along = i / steps;
      const r = radius * (0.08 + along * 1.25);
      let spin = seconds * SUN.spiralSpeed;
      if (seconds < sunState.celebrateUntil) {
        spin = spin * 4;
      }
      const angle = arm / SUN.spiralArms * Math.PI * 2 + along * SUN.spiralTwist + spin;
      const x = centre + Math.cos(angle) * r;
      const y = centre + Math.sin(angle) * r;
      if (i === 0) {
        drawContext.moveTo(x, y);
      } else {
        drawContext.lineTo(x, y);
      }
    }
    drawContext.lineWidth = radius * 0.14;
    if (arm % 2 === 0) {
      drawContext.strokeStyle = getSunColour("--ember", 0.5);
    } else {
      drawContext.strokeStyle = getSunColour("--sun-core", 0.45);
    }
    drawContext.stroke();
  }
  drawContext.restore();
}

function setOrbAura(centre, radius, seconds) {
  // Wavy outlines that keep pulsing out from the orb's edge and fading.
  for (let k = 0; k < SUN.auraRings; k++) {
    const phase = (seconds * SUN.auraSpeed + k / SUN.auraRings) % 1;
    const r = radius * (1.35 + phase * 1.6);
    setBlobPath(centre, centre, r, 0.06, 0.6, seconds, k * 1.7, 64);
    drawContext.lineWidth = 3 * sunState.scale * (1 - phase * 0.5);
    drawContext.strokeStyle = getSunColour("--sun-glow", 0.55 * (1 - phase));
    drawContext.stroke();
  }
}

function setOrb(centre, radius, seconds) {
  setOrbAura(centre, radius, seconds);
  for (let i = 0; i < SUN.layers.length; i++) {
    const layer = SUN.layers[i];
    setBlobPath(centre, centre, radius * getLayerSize(layer, i, seconds), layer.lumps, layer.drift, seconds, i, 64);
    drawContext.fillStyle = getSunColour(layer.colour, 1);
    drawContext.fill();
    // An ink line round every layer: thick outside, thinner further in.
    setOutline(SUN.outlineWidth * (1 - i * 0.15));
    if (i === 1) {
      // The spiral sits under the inner layers, so it peeks between them.
      setOrbSpiral(centre, radius, seconds);
    }
  }
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
  // A wobbly blob of flat colour with a swirling stripe band, a soft shadow
  // crescent away from the orb, a shine dot facing it, and an ink outline.
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

    if (planet.ring) {
      setPlanetRing(px, py, size, false, seconds);
    }
    setPlanetBody(px, py, size, planet, centre, centre, seconds, i);
    if (planet.ring) {
      setPlanetRing(px, py, size, true, seconds);
    }
    if (planet.moon) {
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
