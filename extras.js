// =============================================================================
// Game extras: sky-ribbon currents, stardust and boost
// =============================================================================
//   Currents   - the swirling ribbons high in the sky carry the orb along
//                their flow and keep it near their middle (unless the
//                visitor is steering), and flying is faster in them.
//                (background.js reads the ribbons from its own shader with
//                getRiverProbe, so it matches what's drawn.)
//   Stardust   - specks of light scattered about. Flying through them fills
//                the stardust meter in the corner; a full share of it buys a boost
//                (Space, or the Boost button) that makes the orb much faster
//                for a moment.
// Stardust is drawn into the swirl layer (setExtrasDrawn), so
// the live warp bends it like everything else. Nothing happens while a
// planet's panel is open.
//
// Uses from background.js: BG, swirlSeed, getSeededRandom, getWorldOrigin,
// getCentrePagePoint, getRiverProbe, getRgba. From flight.js: setOrbMovedBy.
// From sun.js: getIsPanelOpen.
// =============================================================================

const EXTRAS = {
  // Currents
  currentSpeed: 240,        // how fast a river carries the orb mid-stream, px/s
  currentBoost: 1.5,        // flying is this much faster in a river
  centring: 2.5,            // how quickly a stream draws the orb to its middle (per s)
  wobble: 3,                // the orb drifts this far either side of the middle, px
  probeEvery: 60,           // ms between river checks

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
// so stardust stays in the same spots of the landscape.
const EXTRAS_ZOOMED = [
  "dustSpacing", "dustReach",
];

const extrasMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const stardustBox = document.querySelector(".stardust");
const stardustFill = document.querySelector(".stardust-fill");
const boostButton = document.querySelector(".boost-button");

const extrasState = {
  river: null,              // latest river probe at the orb
  lastProbe: 0,             // ms
  lastFrame: null,          // ms
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

// ---------- Stardust ----------

function getDustGrid() {
  // The stardust grid repeats with the world (background.js loops it): its
  // squares are nudged so a whole number fit in one trip round.
  if (typeof getLoopWorldWidth !== "function") {
    return { spacing: EXTRAS.dustSpacing, cells: Infinity };
  }
  const cells = Math.max(1, Math.round(getLoopWorldWidth() / EXTRAS.dustSpacing));
  return { spacing: getLoopWorldWidth() / cells, cells: cells };
}

function getStardustAt(cellX, cellY) {
  // The speck in one grid square of the world (world px), or null. Squares a
  // loop apart hold the same speck (taking one takes it everywhere).
  const grid = getDustGrid();
  let loopX = cellX;
  if (isFinite(grid.cells)) {
    loopX = ((cellX % grid.cells) + grid.cells) % grid.cells;
  }
  const key = loopX + "," + cellY;
  if (extrasState.collected.has(key)) {
    return null;
  }
  const random = getCellRandom(loopX, cellY, 202);
  if (random() > EXTRAS.dustChance) {
    return null;
  }
  return {
    key: key,
    x: (cellX + 0.15 + 0.7 * random()) * grid.spacing,
    y: (cellY + 0.15 + 0.7 * random()) * EXTRAS.dustSpacing,
    phase: random() * Math.PI * 2,
  };
}

function getStardustAround(world, reach) {
  const specks = [];
  const spacingX = getDustGrid().spacing;
  const lowX = Math.floor((world.x - reach) / spacingX);
  const highX = Math.floor((world.x + reach) / spacingX);
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

// ---------- Every frame ----------

function setHeading() {
  // Remembers which way the orb was last going (for boosts).
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
