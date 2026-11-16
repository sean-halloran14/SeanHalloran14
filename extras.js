// =============================================================================
// Game extras: sky-ribbon currents, black holes, stardust and boost
// =============================================================================
//   Currents   - the swirling ribbons high in the sky carry the orb along
//                their flow and keep it near their middle (unless the
//                visitor is steering), and flying is faster in them.
//                (background.js reads the ribbons from its own shader with
//                getRiverProbe, so it matches what's drawn.)
//   Black holes - dark swirls scattered through the open sky pull the orb in
//                when it comes close. Fly away to escape; if one swallows the
//                orb, it's flung out somewhere nearby. They're never placed
//                near the start, near a hidden planet, or below the peaks
//                (getIsSkyWorld).
//   Stardust   - specks of light scattered about. Flying through them fills
//                the meter under the radar; a full share of it buys a boost
//                (Space, or the Boost button) that makes the orb much faster
//                for a moment.
// Black holes and stardust are drawn into the swirl layer (setExtrasDrawn), so
// the live warp bends them like everything else. Nothing happens while a
// planet's panel is open.
//
// Uses from background.js: BG, swirlSeed, getSeededRandom, getWorldOrigin,
// getCentrePagePoint, getRiverProbe, getIsSkyWorld, setCentrePoint,
// setBackgroundRipple, getRgba. From flight.js: setOrbMovedBy. From hunt.js: huntState.
// From sun.js: getIsPanelOpen.
// =============================================================================

const EXTRAS = {
  // Currents
  currentSpeed: 240,        // how fast a river carries the orb mid-stream, px/s
  currentBoost: 1.5,        // flying is this much faster in a river
  centring: 2.5,            // how quickly a stream draws the orb to its middle (per s)
  wobble: 3,                // the orb drifts this far either side of the middle, px
  probeEvery: 60,           // ms between river checks

  // Black holes
  holeSpacing: 2000,        // world px between possible black holes
  holeChance: 0.55,         // share of those spots that have one
  holeReach: 330,           // they pull from this far away, px
  holePull: 620,            // pull at the edge of the core, px/s (flying tops out near 1100)
  holeCore: 42,             // closer than this and the orb is swallowed, px
  holeSize: 120,            // drawn radius, px
  holeClearStart: 900,      // no black holes this close to where the orb starts, px
  holeClearPlanet: 520,     // ...or to a hidden planet, px
  flingDistance: 950,       // how far a swallowed orb is flung, px
  flingCalm: 2,             // seconds after a fling with no pull

  // Stardust
  dustSpacing: 230,         // world px between possible specks
  dustChance: 0.32,         // share of those spots with a speck
  dustReach: 46,            // flying this close collects a speck, px
  dustMax: 12,              // meter size
  boostCost: 4,             // stardust per boost
  boostTime: 1.4,           // seconds a boost lasts
  boostSpeed: 2.6,          // flying is this much faster while boosting
  boostPush: 700,           // a boost also pushes the orb this fast the way it was going, px/s
};

// World px settings above that scale with the zoom (zoom.js, setExtrasZoom),
// so black holes and stardust stay in the same spots of the landscape.
const EXTRAS_ZOOMED = [
  "holeSpacing", "holeReach", "holeCore", "holeSize", "holeClearStart", "holeClearPlanet",
  "flingDistance", "dustSpacing", "dustReach",
];

const extrasMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const stardustBox = document.querySelector(".stardust");
const stardustFill = document.querySelector(".stardust-fill");
const boostButton = document.querySelector(".boost-button");

const extrasState = {
  river: null,              // latest river probe at the orb
  lastProbe: 0,             // ms
  lastFrame: null,          // ms
  calmUntil: 0,             // seconds: no black-hole pull until then
  collected: new Set(),     // stardust specks already taken ("x,y" cell keys)
  stardust: 0,
  boostUntil: -1,           // seconds
  lastOrb: null,            // last orb page point, for the direction of travel
  headingX: 1,              // unit direction the orb was last going
  headingY: 0,
  startTime: performance.now(),
  scale: 1,                 // drawing size, follows the zoom
};

// ---------- Helpers ----------

function getExtrasSeconds() {
  return (performance.now() - extrasState.startTime) / 1000;
}

function getCellRandom(cellX, cellY, salt) {
  // A repeatable random generator for one grid square of the world.
  const seed = (Math.imul(cellX, 73856093) ^ Math.imul(cellY, 19349663) ^ Math.imul(swirlSeed + salt, 83492791)) | 0;
  return getSeededRandom(seed);
}

function setExtrasZoom(factor) {
  for (const name of EXTRAS_ZOOMED) {
    EXTRAS[name] = EXTRAS[name] * factor;
  }
  extrasState.scale = extrasState.scale * factor;
}

function getOrbWorld() {
  const orb = getCentrePagePoint();
  const origin = getWorldOrigin();
  return { x: origin.x + orb.x, y: origin.y + orb.y };
}

function getIsPaused() {
  if (getIsPlainView()) {
    return true;
  }
  return typeof getIsPanelOpen === "function" && getIsPanelOpen();
}

// ---------- Black holes ----------

function getIsNearHiddenPlanet(x, y) {
  if (typeof huntState === "undefined") {
    return false;
  }
  for (const wild of huntState.wild) {
    if (wild && Math.hypot(wild.spot.x - x, wild.spot.y - y) < EXTRAS.holeClearPlanet) {
      return true;
    }
  }
  return false;
}

function getBlackHoleAt(cellX, cellY) {
  // The black hole in one grid square of the world (world px), or null.
  const random = getCellRandom(cellX, cellY, 101);
  if (random() > EXTRAS.holeChance) {
    return null;
  }
  const x = (cellX + 0.15 + 0.7 * random()) * EXTRAS.holeSpacing;
  const y = (cellY + 0.15 + 0.7 * random()) * EXTRAS.holeSpacing;
  if (Math.hypot(x, y) < EXTRAS.holeClearStart || getIsNearHiddenPlanet(x, y)) {
    return null;
  }
  // Only in the open sky, never over the mountains, forest or lake.
  if (typeof getIsSkyWorld === "function" && !getIsSkyWorld(y + EXTRAS.holeSize)) {
    return null;
  }
  return { x: x, y: y, spin: 1 - 2 * Math.round(random()), phase: random() * Math.PI * 2 };
}

function getBlackHolesAround(world, reach) {
  // Every black hole within reach of a world point.
  const holes = [];
  const lowX = Math.floor((world.x - reach) / EXTRAS.holeSpacing);
  const highX = Math.floor((world.x + reach) / EXTRAS.holeSpacing);
  const lowY = Math.floor((world.y - reach) / EXTRAS.holeSpacing);
  const highY = Math.floor((world.y + reach) / EXTRAS.holeSpacing);
  for (let cellY = lowY; cellY <= highY; cellY++) {
    for (let cellX = lowX; cellX <= highX; cellX++) {
      const hole = getBlackHoleAt(cellX, cellY);
      if (hole) {
        holes.push(hole);
      }
    }
  }
  return holes;
}

function setBlackHolePull(elapsed, seconds) {
  // Black holes near the orb pull it in, harder the closer it gets.
  if (seconds < extrasState.calmUntil) {
    return;
  }
  const orb = getOrbWorld();
  for (const hole of getBlackHolesAround(orb, EXTRAS.holeReach)) {
    const dx = hole.x - orb.x;
    const dy = hole.y - orb.y;
    const distance = Math.hypot(dx, dy);
    if (distance > EXTRAS.holeReach) {
      continue;
    }
    if (distance < EXTRAS.holeCore) {
      setSwallowed(hole);
      return;
    }
    const closeness = 1 - (distance - EXTRAS.holeCore) / (EXTRAS.holeReach - EXTRAS.holeCore);
    const step = Math.min(distance, EXTRAS.holePull * closeness * closeness * elapsed);
    setOrbMovedBy(dx / distance * step, dy / distance * step);
  }
}

function setSwallowed(hole) {
  // Flings the orb out the far side of the black hole, with a ripple.
  const origin = getWorldOrigin();
  const page = document.querySelector(".page").getBoundingClientRect();
  let angle = Math.atan2(extrasState.headingY, extrasState.headingX);
  angle = angle + (Math.random() - 0.5) * 1.2;
  let x = hole.x - origin.x + Math.cos(angle) * EXTRAS.flingDistance;
  let y = hole.y - origin.y + Math.sin(angle) * EXTRAS.flingDistance;
  x = Math.min(page.width - 80, Math.max(80, x));
  y = Math.min(page.height - 80, Math.max(80, y));
  extrasState.calmUntil = getExtrasSeconds() + EXTRAS.flingCalm;
  setBackgroundRipple(page.left + hole.x - origin.x, page.top + hole.y - origin.y);
  setCentrePoint(page.left + x, page.top + y);
  setExtrasToast("Swallowed by a black hole and flung back out!");
}

function setBlackHolesDrawn(context, seconds) {
  // A dark swirl: an inky core fading out, with rings of aurora light
  // spiralling into it.
  const origin = getWorldOrigin();
  const page = document.querySelector(".page").getBoundingClientRect();
  const centre = { x: origin.x + page.width / 2, y: origin.y + page.height / 2 };
  const reach = Math.hypot(page.width, page.height) / 2 + BG.margin;
  for (const hole of getBlackHolesAround(centre, reach)) {
    const x = hole.x - origin.x + BG.margin;
    const y = hole.y - origin.y + BG.margin;
    const size = EXTRAS.holeSize;
    const dark = context.createRadialGradient(x, y, 0, x, y, size);
    dark.addColorStop(0, "rgba(4, 6, 12, 0.98)");
    dark.addColorStop(0.35, "rgba(6, 10, 20, 0.92)");
    dark.addColorStop(1, "rgba(6, 10, 20, 0)");
    context.fillStyle = dark;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();

    // Spiral arms of light winding inward.
    context.lineCap = "round";
    const colours = ["--sky-light", "--olive", "--sun-glow"];
    for (let arm = 0; arm < 3; arm++) {
      context.beginPath();
      for (let i = 0; i <= 24; i++) {
        const along = i / 24;
        const radius = size * (1.15 - along * 0.85);
        const turn = hole.phase + arm * Math.PI * 2 / 3 + along * 4 + hole.spin * seconds * 1.4;
        const px = x + Math.cos(turn) * radius;
        const py = y + Math.sin(turn) * radius;
        if (i === 0) {
          context.moveTo(px, py);
        } else {
          context.lineTo(px, py);
        }
      }
      context.lineWidth = 4 * extrasState.scale;
      context.strokeStyle = getRgba(colours[arm], 55);
      context.stroke();
    }
    // The bright edge of the core.
    context.beginPath();
    context.arc(x, y, EXTRAS.holeCore * 0.9, 0, Math.PI * 2);
    context.lineWidth = 3 * extrasState.scale;
    context.strokeStyle = getRgba("--sun-glow", 70);
    context.stroke();
  }
}

// ---------- Stardust ----------

function getStardustAt(cellX, cellY) {
  // The speck in one grid square of the world (world px), or null.
  const key = cellX + "," + cellY;
  if (extrasState.collected.has(key)) {
    return null;
  }
  const random = getCellRandom(cellX, cellY, 202);
  if (random() > EXTRAS.dustChance) {
    return null;
  }
  return {
    key: key,
    x: (cellX + 0.15 + 0.7 * random()) * EXTRAS.dustSpacing,
    y: (cellY + 0.15 + 0.7 * random()) * EXTRAS.dustSpacing,
    phase: random() * Math.PI * 2,
  };
}

function getStardustAround(world, reach) {
  const specks = [];
  const lowX = Math.floor((world.x - reach) / EXTRAS.dustSpacing);
  const highX = Math.floor((world.x + reach) / EXTRAS.dustSpacing);
  const lowY = Math.floor((world.y - reach) / EXTRAS.dustSpacing);
  const highY = Math.floor((world.y + reach) / EXTRAS.dustSpacing);
  for (let cellY = lowY; cellY <= highY; cellY++) {
    for (let cellX = lowX; cellX <= highX; cellX++) {
      const speck = getStardustAt(cellX, cellY);
      if (speck) {
        specks.push(speck);
      }
    }
  }
  return specks;
}

function setStardustCollected() {
  // Specks the orb flies through go into the meter.
  const orb = getOrbWorld();
  let gained = 0;
  for (const speck of getStardustAround(orb, EXTRAS.dustReach)) {
    if (Math.hypot(speck.x - orb.x, speck.y - orb.y) < EXTRAS.dustReach) {
      extrasState.collected.add(speck.key);
      gained += 1;
    }
  }
  if (gained > 0) {
    extrasState.stardust = Math.min(EXTRAS.dustMax, extrasState.stardust + gained);
    setStardustMeter(true);
  }
}

function setStardustDrawn(context, seconds) {
  // Each speck is a small twinkling four-pointed star.
  const origin = getWorldOrigin();
  const page = document.querySelector(".page").getBoundingClientRect();
  const centre = { x: origin.x + page.width / 2, y: origin.y + page.height / 2 };
  const reach = Math.hypot(page.width, page.height) / 2 + BG.margin;
  context.fillStyle = getRgba("--sun-core", 90);
  for (const speck of getStardustAround(centre, reach)) {
    const x = speck.x - origin.x + BG.margin;
    const y = speck.y - origin.y + BG.margin;
    const size = (9 + 4 * Math.sin(seconds * 3 + speck.phase)) * extrasState.scale;
    context.beginPath();
    context.moveTo(x, y - size);
    context.quadraticCurveTo(x, y, x + size, y);
    context.quadraticCurveTo(x, y, x, y + size);
    context.quadraticCurveTo(x, y, x - size, y);
    context.quadraticCurveTo(x, y, x, y - size);
    context.fill();
  }
}

function setStardustMeter(popping) {
  stardustFill.style.width = (extrasState.stardust / EXTRAS.dustMax * 100) + "%";
  boostButton.disabled = extrasState.stardust < EXTRAS.boostCost;
  if (popping) {
    stardustBox.classList.remove("is-popping");
    void stardustBox.offsetWidth;   // restart the animation
    stardustBox.classList.add("is-popping");
  }
}

// ---------- Boost ----------

function setBoost() {
  if (extrasState.stardust < EXTRAS.boostCost || getIsPaused()) {
    return;
  }
  extrasState.stardust -= EXTRAS.boostCost;
  extrasState.boostUntil = getExtrasSeconds() + EXTRAS.boostTime;
  setStardustMeter(false);
}

function setBoostKey(event) {
  if (event.code !== "Space" || event.repeat) {
    return;
  }
  if (event.target && event.target.closest && event.target.closest("a, button, input, textarea, .planet-panel")) {
    return;
  }
  event.preventDefault();
  setBoost();
}

function getIsBoosting() {
  return getExtrasSeconds() < extrasState.boostUntil;
}

function setBoostPush(elapsed) {
  // While boosting, the orb keeps shooting the way it was going.
  if (!getIsBoosting()) {
    return;
  }
  const left = (extrasState.boostUntil - getExtrasSeconds()) / EXTRAS.boostTime;
  const step = EXTRAS.boostPush * left * elapsed;
  setOrbMovedBy(extrasState.headingX * step, extrasState.headingY * step);
}

// ---------- Currents ----------

function setRiverProbe(now) {
  if (now - extrasState.lastProbe < EXTRAS.probeEvery) {
    return;
  }
  extrasState.lastProbe = now;
  const orb = getCentrePagePoint();
  extrasState.river = getRiverProbe(orb.x, orb.y);
}

function setCurrentDrift(elapsed, seconds) {
  // A sky ribbon carries the orb along, fastest mid-stream, and (unless the
  // visitor is steering) gently draws it to the middle, where it drifts a
  // few px either side, so it doesn't slide out on a bend. Steering turns
  // the pull off, so the arrow keys, holding or the wheel get out easily.
  const river = extrasState.river;
  if (!river || !river.inRiver) {
    return;
  }
  const step = EXTRAS.currentSpeed * (0.4 + 0.6 * river.strength) * elapsed;
  setOrbMovedBy(river.flowX * step, river.flowY * step);

  let steering = getIsBoosting();
  if (typeof getIsSteering === "function" && getIsSteering()) {
    steering = true;
  }
  if (steering) {
    return;
  }
  const target = EXTRAS.wobble * Math.sin(seconds * 0.8);
  const shift = (river.offset - target) * Math.min(1, EXTRAS.centring * elapsed);
  setOrbMovedBy(-river.acrossX * shift, -river.acrossY * shift);
  // Until the next probe, remember the orb has moved towards the middle.
  river.offset = river.offset - shift;
}

function getFlightSpeedFactor() {
  // Used by flight.js: faster in a river, much faster while boosting.
  let factor = 1;
  if (extrasState.river && extrasState.river.inRiver) {
    factor = factor * EXTRAS.currentBoost;
  }
  if (getIsBoosting()) {
    factor = factor * EXTRAS.boostSpeed;
  }
  return factor;
}

// ---------- Messages ----------

let extrasToastTimer = 0;

function setExtrasToast(message) {
  // Borrows the hunt's toast for a moment.
  const toast = document.querySelector(".hunt-toast");
  const usual = "You found every project!";
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(extrasToastTimer);
  extrasToastTimer = setTimeout(function () {
    toast.hidden = true;
    toast.textContent = usual;
  }, 2600);
}

// ---------- Every frame ----------

function setHeading() {
  // Remembers which way the orb was last going (for boosts and flings).
  const orb = getCentrePagePoint();
  const last = extrasState.lastOrb;
  extrasState.lastOrb = orb;
  if (!last) {
    return;
  }
  const dx = orb.x - last.x;
  const dy = orb.y - last.y;
  const moved = Math.hypot(dx, dy);
  if (moved > 0.5 && moved < 200) {
    extrasState.headingX = dx / moved;
    extrasState.headingY = dy / moved;
  }
}

function setExtrasDrawn(context, seconds) {
  // Called by background.js while it draws the swirl layer.
  setBlackHolesDrawn(context, seconds);
  setStardustDrawn(context, seconds);
}

function setExtrasFrame(now) {
  let elapsed = 0;
  if (extrasState.lastFrame !== null) {
    elapsed = Math.min(1 / 30, (now - extrasState.lastFrame) / 1000);   // a slow frame never jumps the orb far (as flight.js)
  }
  extrasState.lastFrame = now;
  if (!getIsPaused()) {
    const seconds = getExtrasSeconds();
    setRiverProbe(now);
    setCurrentDrift(elapsed, seconds);
    setBlackHolePull(elapsed, seconds);
    setBoostPush(elapsed);
    setStardustCollected();
  }
  setHeading();
  requestAnimationFrame(setExtrasFrame);
}

boostButton.addEventListener("click", setBoost);
window.addEventListener("keydown", setBoostKey);
setStardustMeter(false);
requestAnimationFrame(setExtrasFrame);
