// =============================================================================
// The planet hunt
// =============================================================================
// A small game: each planet (project, About, Contact) starts hidden somewhere
// out in the endless world, drifting in place with a pulsing glow.
//
//   Find it  - fly the orb around (flight.js). The radar in the corner points to
//              the nearest planet you haven't found and pulses faster and
//              warmer as you get closer. Hovering a hidden planet teases it.
//   Catch it - fly the orb close to it (it's pulled in by gravity), or click
//              it: the planet flies home into its orbit and its panel opens.
//   Skip     - "Show me everything" sends every remaining planet home at once.
//   Contents - a button lists the planets found so far (click one to open it),
//              with a constellation whose stars light up as they're found.
//   Tutorial - before anything is found, the first planet hides close by
//              and a coach note points at it.
//   Win      - with all found, the orb and background celebrate, and the button
//              becomes "Hide them again" to replay.
//
// Found planets are remembered on this device (localStorage). Keyboard users
// can still Tab to any planet and press Enter to catch it. With reduced
// motion, caught planets come home instantly.
//
// Uses from sun.js: SUN, sunState, setDrawContext, setPlanetBody, setPanelShown,
// setViewOnOrb, setSunCelebration, getSunColour. From background.js:
// getCentrePagePoint, getSeededRandom, swirlSeed, setBackgroundCelebration.
// =============================================================================

const HUNT = {
  storageKey: "portfolio-planets-found",
  size: 1.7,               // hidden planets are drawn this much bigger than in orbit
  wander: 45,              // how far a hidden planet drifts round its spot, px
  wanderSpeed: [0.12, 0.28],  // drift speed range, radians per second (slow, so they're easy to click)
  spread: 2.2,             // planets hide up to this many screens from the orb, each way
  minSpacing: 420,         // hidden planets are at least this far apart, px
  awayFromOrb: 0.55,       // ...and at least this share of the screen's size from the orb
  catchReach: 34,          // how close a click must be to a hidden planet's edge, px
  gravityReach: 150,       // flying the orb this close to a hidden planet pulls it in, px
  flightTime: 1.3,         // seconds for a caught planet to fly home
  celebrateTime: 4,        // seconds the celebration lasts
  tutorialReach: 0.3,      // before anything is found, the first planet hides this share of the screen's width from the orb
  fps: 30,
};

const huntPage = document.querySelector(".page");
const radar = document.querySelector(".radar");
const radarCanvas = radar.querySelector(".radar-dial");
const radarContext = radarCanvas.getContext("2d");
const radarCount = radar.querySelector(".radar-count");
const radarButton = radar.querySelector(".radar-button");
const huntToast = document.querySelector(".hunt-toast");
const huntMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const huntState = {
  found: [],               // true/false per planet
  wild: [],                // hidden planets: spot (world px), drift, canvas
  flights: [],             // planets flying home: from, start time
  hovered: null,           // hidden planet under the pointer
  startTime: performance.now(),
  lastFrame: 0,
  frame: 0,
};

// ---------- Helpers ----------

function getHuntSeconds() {
  return (performance.now() - huntState.startTime) / 1000;
}

function getIsPlanetFound(index) {
  // Used by sun.js: only found planets orbit the orb.
  return huntState.found[index] === true;
}

function getFoundCount() {
  let count = 0;
  for (let i = 0; i < sunState.planetCount; i++) {
    if (huntState.found[i]) {
      count += 1;
    }
  }
  return count;
}

function getSavedFound() {
  // Indexes of planets found on an earlier visit (empty if none or blocked).
  try {
    const saved = JSON.parse(window.localStorage.getItem(HUNT.storageKey) || "[]");
    if (Array.isArray(saved)) {
      return saved;
    }
  } catch (error) {
    // Storage can be unavailable (private browsing); the hunt still works.
  }
  return [];
}

function setSavedFound() {
  const indexes = [];
  for (let i = 0; i < sunState.planetCount; i++) {
    if (huntState.found[i]) {
      indexes.push(i);
    }
  }
  try {
    window.localStorage.setItem(HUNT.storageKey, JSON.stringify(indexes));
  } catch (error) {
    // Not saved this time; nothing else to do.
  }
}

function getWorldSize() {
  const box = huntPage.getBoundingClientRect();
  return { width: box.width, height: box.height, left: box.left, top: box.top };
}

// ---------- Hiding the planets ----------

function getOrbWorldPoint() {
  // Where the orb is in the endless world, in world px.
  const orb = getCentrePagePoint();
  const origin = getWorldOrigin();
  return { x: origin.x + orb.x, y: origin.y + orb.y };
}

function getHidingSpots(count) {
  // Spots (world px) spread around the orb, up to HUNT.spread screens away:
  // not too close to the orb, and away from each other. Uses the swirl seed,
  // so ?swirls=12345 repeats them.
  let random = Math.random;
  if (typeof getSeededRandom === "function" && typeof swirlSeed === "number") {
    random = getSeededRandom(swirlSeed + 7000);
  }
  const orb = getOrbWorldPoint();
  const reachX = window.innerWidth * HUNT.spread;
  const reachY = window.innerHeight * HUNT.spread;
  // (At least 1px, so a page loaded in a hidden, zero-size window still works.)
  const awayFromOrb = Math.max(1, Math.min(window.innerWidth, window.innerHeight) * HUNT.awayFromOrb);
  const spots = [];
  for (let n = 0; n < count; n++) {
    let best = null;
    let bestScore = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = {
        x: orb.x + (random() * 2 - 1) * reachX,
        y: orb.y + (random() * 2 - 1) * reachY,
      };
      // Score: distance to the nearest other spot (and to the orb, weighted).
      let nearest = Math.hypot(candidate.x - orb.x, candidate.y - orb.y) * (HUNT.minSpacing / awayFromOrb);
      for (const other of spots) {
        nearest = Math.min(nearest, Math.hypot(candidate.x - other.x, candidate.y - other.y));
      }
      if (best === null || nearest > bestScore) {
        best = candidate;
        bestScore = nearest;
      }
      if (bestScore >= HUNT.minSpacing) {
        break;
      }
    }
    spots.push(best);
  }
  // A first-time visitor's first planet hides close by, in view, so they
  // learn to fly to it straight away (the coach note points at it).
  if (spots.length > 0 && getFoundCount() === 0) {
    spots[0] = {
      x: orb.x + Math.max(150, window.innerWidth * HUNT.tutorialReach),
      y: orb.y - window.innerHeight * 0.06,
    };
  }
  return spots;
}

function setWildPlanets() {
  // Hides every planet that hasn't been found yet out in the world.
  for (const wild of huntState.wild) {
    if (wild && wild.canvas) {
      wild.canvas.remove();
    }
  }
  huntState.wild = [];
  const spots = getHidingSpots(sunState.planetCount);
  for (let i = 0; i < sunState.planetCount; i++) {
    if (huntState.found[i]) {
      huntState.wild.push(null);
      continue;
    }
    const canvas = document.createElement("canvas");
    canvas.className = "wild-planet";
    canvas.setAttribute("aria-hidden", "true");
    huntPage.appendChild(canvas);
    huntState.wild.push({
      spot: spots[i],
      wanderPhase: Math.random() * Math.PI * 2,
      wanderSpeed: HUNT.wanderSpeed[0] + Math.random() * (HUNT.wanderSpeed[1] - HUNT.wanderSpeed[0]),
      canvas: canvas,
      context: canvas.getContext("2d"),
      boxSize: 0,
    });
  }
  setWildCanvasSizes();
}

function setWildCanvasSizes() {
  const ratio = window.devicePixelRatio || 1;
  for (let i = 0; i < huntState.wild.length; i++) {
    const wild = huntState.wild[i];
    if (!wild) {
      continue;
    }
    const size = getWildSize(i);
    wild.boxSize = Math.ceil(size * 9);
    wild.canvas.width = Math.round(wild.boxSize * ratio);
    wild.canvas.height = Math.round(wild.boxSize * ratio);
    wild.canvas.style.width = wild.boxSize + "px";
    wild.canvas.style.height = wild.boxSize + "px";
    wild.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
}

function getWildSize(index) {
  return Math.max(6, SUN.planets[index].size * sunState.scale * HUNT.size);
}

function getWildPagePoint(index, seconds) {
  // Where a hidden planet is now, in page px: its spot plus a slow drift.
  const wild = huntState.wild[index];
  const origin = getWorldOrigin();
  let angle = wild.wanderPhase;
  if (!huntMotion.matches) {
    angle = angle + seconds * wild.wanderSpeed;
  }
  return {
    x: wild.spot.x - origin.x + Math.cos(angle) * HUNT.wander * BG.zoom,
    y: wild.spot.y - origin.y + Math.sin(angle * 1.3) * HUNT.wander * BG.zoom * 0.7,
  };
}

function getWildPlanetAt(clientX, clientY, includeFlying) {
  // Used by sun.js: which hidden planet (if any) is under this point.
  // includeFlying also counts one that was just caught (so the click that
  // caught it isn't mistaken for a click on empty space).
  const world = getWorldSize();
  const seconds = getHuntSeconds();
  for (let i = 0; i < huntState.wild.length; i++) {
    const wild = huntState.wild[i];
    if (!wild) {
      continue;
    }
    const flight = getFlight(i);
    if (flight && !includeFlying) {
      continue;
    }
    if (flight && seconds - flight.start > 0.4) {
      continue;
    }
    let point = getWildPagePoint(i, seconds);
    if (flight) {
      point = flight.from;
    }
    const x = world.left + point.x;
    const y = world.top + point.y;
    if (Math.hypot(clientX - x, clientY - y) <= getWildSize(i) + HUNT.catchReach) {
      return i;
    }
  }
  return null;
}

function getMissingPlanetPoints() {
  // Used by background.js to aim its rays: where each hidden planet is now,
  // in page px. Planets already flying home don't count.
  const seconds = getHuntSeconds();
  const points = [];
  for (let i = 0; i < huntState.wild.length; i++) {
    if (huntState.wild[i] && !getIsFlying(i)) {
      points.push(getWildPagePoint(i, seconds));
    }
  }
  return points;
}

function setWildHover(index) {
  // Used by sun.js on pointer moves: a hidden planet under the pointer gets
  // a teaser label.
  huntState.hovered = index;
}

// ---------- Catching ----------

function getIsFlying(index) {
  for (const flight of huntState.flights) {
    if (flight.index === index) {
      return true;
    }
  }
  return false;
}

function setCatchPlanet(index) {
  // Starts a hidden planet's flight home (or brings it home at once with
  // reduced motion). Already found: just open its panel.
  if (huntState.found[index]) {
    setPanelShown(index);
    return;
  }
  if (getIsFlying(index)) {
    return;
  }
  setHuntToastHidden();
  const seconds = getHuntSeconds();
  const from = getWildPagePoint(index, seconds);
  if (huntMotion.matches) {
    setPlanetHome(index, true);
    return;
  }
  huntState.flights.push({ index: index, from: from, start: seconds, openPanel: true });
  setViewOnOrb(true);
}

function setPlanetHome(index, openPanel) {
  // A planet has arrived: it joins the orbit and its hidden copy goes away.
  huntState.found[index] = true;
  const wild = huntState.wild[index];
  if (wild) {
    wild.canvas.remove();
    huntState.wild[index] = null;
  }
  setSavedFound();
  setRadarText();
  if (openPanel) {
    setPanelShown(index);
  }
  if (getFoundCount() === sunState.planetCount) {
    setCelebration();
  }
}

function setShowEverything() {
  // Sends every remaining planet home at once (no panel opens).
  const seconds = getHuntSeconds();
  for (let i = 0; i < sunState.planetCount; i++) {
    if (huntState.found[i] || getIsFlying(i)) {
      continue;
    }
    if (huntMotion.matches) {
      setPlanetHome(i, false);
      continue;
    }
    huntState.flights.push({
      index: i,
      from: getWildPagePoint(i, seconds),
      start: seconds + i * 0.08,
      openPanel: false,
    });
  }
  setViewOnOrb(true);
}

function setHideAgain() {
  // Starts the hunt over: every planet hides again.
  for (let i = 0; i < sunState.planetCount; i++) {
    huntState.found[i] = false;
  }
  huntState.flights = [];
  setSavedFound();
  setPanelHidden();
  setHuntToastHidden();
  setWildPlanets();
  setRadarText();
}

function setCelebration() {
  if (typeof setSunCelebration === "function") {
    setSunCelebration(HUNT.celebrateTime);
  }
  if (typeof setBackgroundCelebration === "function") {
    setBackgroundCelebration(HUNT.celebrateTime);
  }
  huntToast.hidden = false;
  huntToast.classList.remove("is-popping");
  void huntToast.offsetWidth;
  huntToast.classList.add("is-popping");
  window.setTimeout(setHuntToastHidden, 5000);
}

function setHuntToastHidden() {
  huntToast.hidden = true;
}

// ---------- Drawing ----------

function setWildPlanetFrame(index, seconds) {
  // One hidden planet on its own little canvas: a pulsing glow ("something's
  // here"), then the planet itself, drawn by sun.js's planet painter.
  const wild = huntState.wild[index];
  const planet = SUN.planets[index];
  const size = getWildSize(index);
  const centre = wild.boxSize / 2;
  const context = wild.context;
  context.clearRect(0, 0, wild.boxSize, wild.boxSize);

  let point = getWildPagePoint(index, seconds);
  let scale = 1;
  const flight = getFlight(index);
  if (flight) {
    // Flying home: glide from where it was caught to the orb, shrinking.
    const progress = Math.max(0, Math.min(1, (seconds - flight.start) / HUNT.flightTime));
    const eased = progress * progress * (3 - 2 * progress);
    const home = getCentrePagePoint();
    point = {
      x: flight.from.x + (home.x - flight.from.x) * eased,
      y: flight.from.y + (home.y - flight.from.y) * eased - Math.sin(Math.PI * eased) * 120,
    };
    scale = 1 - 0.55 * eased;
  }
  wild.canvas.style.transform = "translate(" + (point.x - centre) + "px, " + (point.y - centre) + "px)";

  // Pulsing glow rings.
  if (!flight) {
    for (let k = 0; k < 2; k++) {
      const phase = (seconds * 0.6 + k * 0.5) % 1;
      context.beginPath();
      context.arc(centre, centre, size * (1.4 + phase * 2.2), 0, Math.PI * 2);
      context.lineWidth = 3;
      context.strokeStyle = getSunColour(planet.colour, 0.6 * (1 - phase));
      context.stroke();
    }
  }
  const halo = context.createRadialGradient(centre, centre, size * 0.5, centre, centre, size * 2.6);
  halo.addColorStop(0, getSunColour("--sun-glow", 0.35));
  halo.addColorStop(1, getSunColour("--sun-glow", 0));
  context.fillStyle = halo;
  context.fillRect(0, 0, wild.boxSize, wild.boxSize);

  // The planet, lit from the direction of the orb.
  const orb = getCentrePagePoint();
  const towardX = orb.x - point.x;
  const towardY = orb.y - point.y;
  const distance = Math.hypot(towardX, towardY) || 1;
  setDrawContext(context);
  setPlanetBody(
    centre, centre, size * scale, planet,
    centre + towardX / distance * 100, centre + towardY / distance * 100,
    seconds, index
  );
  setDrawContext(null);
}

function getFlight(index) {
  for (const flight of huntState.flights) {
    if (flight.index === index) {
      return flight;
    }
  }
  return null;
}

function setFlightsLanded(seconds) {
  const stillFlying = [];
  for (const flight of huntState.flights) {
    if (seconds - flight.start >= HUNT.flightTime) {
      setPlanetHome(flight.index, flight.openPanel);
    } else {
      stillFlying.push(flight);
    }
  }
  huntState.flights = stillFlying;
}

function getNearestWild(seconds) {
  // The closest hidden planet to the middle of the screen, as an offset in px.
  const world = getWorldSize();
  let nearest = null;
  for (let i = 0; i < huntState.wild.length; i++) {
    if (!huntState.wild[i] || getIsFlying(i)) {
      continue;
    }
    const point = getWildPagePoint(i, seconds);
    const dx = world.left + point.x - window.innerWidth / 2;
    const dy = world.top + point.y - window.innerHeight / 2;
    const distance = Math.hypot(dx, dy);
    if (nearest === null || distance < nearest.distance) {
      nearest = { index: i, dx: dx, dy: dy, distance: distance };
    }
  }
  return nearest;
}

function setRadarFrame(seconds) {
  // The cartoon radar: a sweeping beam, pulsing rings (faster and warmer when
  // close), and a blip pointing at the nearest hidden planet.
  const size = radarCanvas.clientWidth;
  if (size < 10) {
    return;   // hidden (the plain view)
  }
  const ratio = window.devicePixelRatio || 1;
  if (radarCanvas.width !== Math.round(size * ratio)) {
    radarCanvas.width = Math.round(size * ratio);
    radarCanvas.height = Math.round(size * ratio);
  }
  const context = radarContext;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, size, size);
  const centre = size / 2;
  const radius = size / 2 - 4;
  const nearest = getNearestWild(seconds);

  // How close, from 0 (far) to 1 (on screen).
  let closeness = 0;
  if (nearest) {
    const reach = Math.hypot(window.innerWidth, window.innerHeight);
    closeness = Math.max(0, Math.min(1, 1 - (nearest.distance - reach * 0.35) / (reach * 1.2)));
  }

  // Dial.
  context.beginPath();
  context.arc(centre, centre, radius, 0, Math.PI * 2);
  context.fillStyle = getSunColour("--navy", 0.92);
  context.fill();

  // Pulsing rings: faster and warmer as you get closer.
  const pulseSpeed = 0.5 + closeness * 2.5;
  let ringColour = "--sky-light";
  if (closeness > 0.66) {
    ringColour = "--sunset";
  } else if (closeness > 0.33) {
    ringColour = "--sun-glow";
  }
  for (let k = 0; k < 2; k++) {
    const phase = (seconds * pulseSpeed + k * 0.5) % 1;
    context.beginPath();
    context.arc(centre, centre, radius * phase, 0, Math.PI * 2);
    context.lineWidth = 2;
    context.strokeStyle = getSunColour(ringColour, 0.7 * (1 - phase));
    context.stroke();
  }

  // Sweeping beam.
  const sweep = seconds * 2.2;
  context.beginPath();
  context.moveTo(centre, centre);
  context.arc(centre, centre, radius, sweep - 0.5, sweep);
  context.closePath();
  context.fillStyle = getSunColour("--sky-light", 0.18);
  context.fill();

  if (nearest) {
    // Blip: in the direction of the nearest hidden planet; nearer the middle
    // when it's close.
    const angle = Math.atan2(nearest.dy, nearest.dx);
    const out = radius * (0.35 + 0.5 * (1 - closeness));
    const bx = centre + Math.cos(angle) * out;
    const by = centre + Math.sin(angle) * out;
    const blink = 0.6 + 0.4 * Math.sin(seconds * (4 + closeness * 8));
    context.beginPath();
    context.arc(bx, by, 5 + closeness * 3, 0, Math.PI * 2);
    context.fillStyle = getSunColour(SUN.planets[nearest.index].colour, blink);
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = getSunColour("--brown-deep", 0.8);
    context.stroke();
  } else {
    // All found: a tiny orb with planets circling it.
    context.beginPath();
    context.arc(centre, centre, 7, 0, Math.PI * 2);
    context.fillStyle = getSunColour("--sunset", 1);
    context.fill();
    for (let i = 0; i < 3; i++) {
      const angle = seconds * (1.5 - i * 0.3) + i * 2;
      const r = 14 + i * 9;
      context.beginPath();
      context.arc(centre + Math.cos(angle) * r, centre + Math.sin(angle) * r, 3, 0, Math.PI * 2);
      context.fillStyle = getSunColour(SUN.planets[i].colour, 1);
      context.fill();
    }
  }

  // Outline.
  context.beginPath();
  context.arc(centre, centre, radius, 0, Math.PI * 2);
  context.lineWidth = 3;
  context.strokeStyle = getSunColour("--brown-deep", 1);
  context.stroke();
}

// ---------- Table of contents ----------

const contentsButton = document.querySelector(".contents-button");
const contentsPanel = document.querySelector(".contents");
const contentsList = contentsPanel.querySelector(".contents-list");
const contentsNote = contentsPanel.querySelector(".contents-note");
const constellationCanvas = contentsPanel.querySelector(".constellation");
const coach = document.querySelector(".coach");

// Where each planet's star sits in the constellation (shares of the canvas),
// in planet order; found planets light their star and join their neighbours.
const CONSTELLATION = [
  [0.08, 0.66], [0.2, 0.34], [0.34, 0.56], [0.47, 0.2],
  [0.6, 0.44], [0.73, 0.24], [0.87, 0.5], [0.7, 0.8],
];

function setConstellationDrawn() {
  const width = constellationCanvas.clientWidth;
  const height = constellationCanvas.clientHeight;
  if (width === 0) {
    return;   // the panel is closed; drawn when it opens
  }
  const ratio = window.devicePixelRatio || 1;
  constellationCanvas.width = Math.round(width * ratio);
  constellationCanvas.height = Math.round(height * ratio);
  const context = constellationCanvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const count = Math.min(sunState.planetCount, CONSTELLATION.length);
  const complete = getFoundCount() === sunState.planetCount;
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({ x: CONSTELLATION[i][0] * width, y: CONSTELLATION[i][1] * height });
  }

  // Lines: lit between two found stars, a faint dotted guide otherwise.
  context.lineCap = "round";
  for (let i = 1; i < count; i++) {
    const lit = huntState.found[i - 1] && huntState.found[i];
    context.beginPath();
    context.moveTo(points[i - 1].x, points[i - 1].y);
    context.lineTo(points[i].x, points[i].y);
    if (lit) {
      context.setLineDash([]);
      context.lineWidth = 2;
      context.strokeStyle = getSunColour("--sun-glow", 0.85);
      context.shadowColor = getSunColour("--sun-glow", 0.9);
      context.shadowBlur = 6;
      if (complete) {
        context.lineWidth = 2.5;
        context.shadowBlur = 12;
      }
    } else {
      context.setLineDash([2, 5]);
      context.lineWidth = 1;
      context.strokeStyle = getSunColour("--sky-light", 0.25);
      context.shadowBlur = 0;
    }
    context.stroke();
  }
  context.setLineDash([]);

  // Stars.
  for (let i = 0; i < count; i++) {
    context.beginPath();
    if (huntState.found[i]) {
      context.arc(points[i].x, points[i].y, 4, 0, Math.PI * 2);
      context.fillStyle = getSunColour("--sun-core", 1);
      context.shadowColor = getSunColour("--sun-glow", 1);
      context.shadowBlur = 10;
    } else {
      context.arc(points[i].x, points[i].y, 1.8, 0, Math.PI * 2);
      context.fillStyle = getSunColour("--sky-light", 0.45);
      context.shadowBlur = 0;
    }
    context.fill();
  }
  context.shadowBlur = 0;
}

function setCoachFrame(seconds) {
  // Points the coach note at the first hidden planet until something is found.
  const wild = huntState.wild[0];
  if (getFoundCount() > 0 || !wild || getIsFlying(0) || getIsPlainView()) {
    coach.hidden = true;
    return;
  }
  const world = getWorldSize();
  const point = getWildPagePoint(0, seconds);
  const x = world.left + point.x - getWildSize(0) - 24;
  const y = world.top + point.y;
  if (x < 140 || y < 40 || x > window.innerWidth || y > window.innerHeight - 40) {
    coach.hidden = true;
    return;
  }
  coach.hidden = false;
  coach.style.left = x + "px";
  coach.style.top = y + "px";
}

function setContentsList() {
  // Lists every planet found so far (click one to open its panel); the
  // rest show as "not found yet" placeholders.
  contentsList.textContent = "";
  let missing = 0;
  for (let i = 0; i < sunState.planetCount; i++) {
    const row = document.createElement("li");
    if (huntState.found[i]) {
      const item = getPlanetItem(i);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "contents-item";
      const tag = document.createElement("small");
      tag.textContent = item.tag;
      button.appendChild(tag);
      button.appendChild(document.createTextNode(item.title));
      button.addEventListener("click", function () {
        setPanelShown(i);
      });
      row.appendChild(button);
    } else {
      row.className = "contents-hidden";
      row.textContent = "? not found yet";
      missing += 1;
    }
    contentsList.appendChild(row);
  }
  contentsNote.textContent = "";
  if (missing > 0) {
    contentsNote.textContent = "Each planet you find lights a star. Find the rest with the radar, or press \"Show me everything\".";
  } else {
    // The constellation is complete: a thank-you, and a way to get in touch.
    contentsNote.appendChild(document.createTextNode("Constellation complete! Thanks for exploring. "));
    const talk = document.createElement("a");
    talk.href = document.querySelector(".top-email").getAttribute("href");
    talk.textContent = "Let's talk";
    contentsNote.appendChild(talk);
  }
  setConstellationDrawn();
}

function setContentsShown(shown) {
  contentsPanel.hidden = !shown;
  contentsButton.setAttribute("aria-expanded", String(shown));
  if (shown) {
    setConstellationDrawn();
  }
  if (shown) {
    contentsButton.textContent = "Hide contents";
  } else {
    contentsButton.textContent = "Contents";
  }
}

function setRadarText() {
  setContentsList();
  const found = getFoundCount();
  radarCount.textContent = found + " / " + sunState.planetCount + " found";
  if (found === sunState.planetCount) {
    radarButton.textContent = "Hide them again";
  } else {
    radarButton.textContent = "Show me everything";
  }
}

function setWildLabel(seconds) {
  // The teaser label next to a hovered hidden planet.
  if (huntState.hovered === null || !huntState.wild[huntState.hovered]) {
    if (planetLabel.dataset.wild === "true") {
      planetLabel.dataset.wild = "false";
      // Only hide it if sun.js isn't using the label for an orbiting planet.
      if (sunState.labelPlanet === null) {
        planetLabel.hidden = true;
      }
    }
    return;
  }
  const index = huntState.hovered;
  const world = getWorldSize();
  const point = getWildPagePoint(index, seconds);
  if (planetLabel.dataset.wild !== "true" || planetLabel.dataset.index !== String(index)) {
    planetLabel.querySelector(".planet-label-tag").textContent = "Undiscovered planet";
    planetLabel.querySelector(".planet-label-title").textContent = "Click to catch it!";
    planetLabel.style.setProperty("--planet-colour", "var(" + SUN.planets[index].colour + ")");
    planetLabel.hidden = false;
    planetLabel.dataset.wild = "true";
    planetLabel.dataset.index = String(index);
    planetLabel.classList.remove("is-popping");
    void planetLabel.offsetWidth;
    planetLabel.classList.add("is-popping");
  }
  planetLabel.hidden = false;
  planetLabel.style.left = Math.min(window.innerWidth - 120, Math.max(120, world.left + point.x)) + "px";
  planetLabel.style.top = Math.max(70, world.top + point.y - getWildSize(index) * 1.8) + "px";
}

function setGravityCatch(seconds) {
  // Flying the orb close to a hidden planet pulls it into orbit.
  const orb = getCentrePagePoint();
  for (let i = 0; i < huntState.wild.length; i++) {
    if (!huntState.wild[i] || getIsFlying(i)) {
      continue;
    }
    const point = getWildPagePoint(i, seconds);
    if (Math.hypot(point.x - orb.x, point.y - orb.y) < HUNT.gravityReach * BG.zoom) {
      setCatchPlanet(i);
    }
  }
}

function setHuntShift(dx, dy) {
  // The world slid under the page (flight.js): planets flying home started
  // from page points, so move those back too, and redraw at once.
  for (const flight of huntState.flights) {
    flight.from = { x: flight.from.x - dx, y: flight.from.y - dy };
  }
  const seconds = getHuntSeconds();
  for (let i = 0; i < huntState.wild.length; i++) {
    if (huntState.wild[i]) {
      setWildPlanetFrame(i, seconds);
    }
  }
}

function setHuntFrame(seconds) {
  setGravityCatch(seconds);
  setFlightsLanded(seconds);
  for (let i = 0; i < huntState.wild.length; i++) {
    if (huntState.wild[i]) {
      setWildPlanetFrame(i, seconds);
    }
  }
  setRadarFrame(seconds);
  setWildLabel(seconds);
  setCoachFrame(seconds);
}

function setHuntAnimation(now) {
  huntState.frame = requestAnimationFrame(setHuntAnimation);
  if (now - huntState.lastFrame < 1000 / HUNT.fps) {
    return;
  }
  huntState.lastFrame = now;
  setHuntFrame(getHuntSeconds());
}

// ---------- Start ----------

function setHuntStart() {
  const saved = getSavedFound();
  for (let i = 0; i < sunState.planetCount; i++) {
    huntState.found.push(saved.indexOf(i) !== -1);
  }
  setWildPlanets();
  setRadarText();
  radar.hidden = false;
  contentsButton.addEventListener("click", function () {
    setContentsShown(contentsPanel.hidden);
  });
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !contentsPanel.hidden && sunState.panelPlanet === null) {
      setContentsShown(false);
    }
  });
  radarButton.addEventListener("click", function () {
    if (getFoundCount() === sunState.planetCount) {
      setHideAgain();
    } else {
      setShowEverything();
    }
  });
  window.addEventListener("resize", setWildCanvasSizes);
  // Runs even with reduced motion, but then hidden planets don't drift and
  // caught ones come home instantly.
  huntState.frame = requestAnimationFrame(setHuntAnimation);
}

setHuntStart();
