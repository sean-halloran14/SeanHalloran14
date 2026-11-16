// =============================================================================
// Pointer effects: cursor trail and click vortex
// =============================================================================
// Both are drawn on one full-screen canvas (.pointer-effects) over the
// background, below the planet label and panel. They use the accent colours (BG.accentColours in
// background.js) and the same soft three-pass style as the background lines.
//
// Trail  - a soft line that follows the mouse (or a finger) and slowly fades.
//          Like the background flow lines, bright pulses travel along it and
//          its older parts drift and wave on a gentle flowing current.
//          Each new movement after a pause switches to the next accent colour.
// Click  - a left click (or tap) moves the background's centre point there
//          (setCentrePoint), so new rings pour out of that spot and the rays
//          swing across to it, and sends a gentle wave through the swirls
//          (setBackgroundRipple). If the swirl layer isn't animating (no
//          WebGL, or reduced motion), this file draws a fading spiral-armed
//          vortex at the click instead (the RIPPLE settings).
//
// Points are stored in page coordinates, so effects stay where they were made
// when the page scrolls. The canvas only redraws while something is visible.
// =============================================================================

const TRAIL = {
  width: 14,               // widest (softest) pass at the newest point, px
  strength: 34,            // opacity of the strongest pass, percent
  lifetime: 3200,          // how long a point stays visible, ms
  taper: 0.35,             // width left at the oldest end (0-1)
  restTime: 450,           // a pause this long starts a new trail colour, ms
  minDistance: 4,          // ignore movements smaller than this, px
  maxPoints: 500,          // safety limit on stored points
  pulseLength: 150,        // distance between bright pulses travelling along the trail, px
  pulseSpeed: 110,         // how fast pulses travel, px per second
  pulseDepth: 0.85,        // how much dimmer the gaps between pulses are (0-1)
  pulseSharpness: 2.5,     // higher = shorter, punchier pulses with longer gaps
  pulseSwell: 0.55,        // how much thicker the line gets at a pulse (0-1)
  drift: 26,               // how far the oldest part of the trail drifts, px
  driftScale: 0.009,       // size of the drifting current; smaller = broader waves
  driftSpeed: 0.7,         // how fast the current flows
};

// Fallback click vortex, only used when the swirl layer isn't animating.
const RIPPLE = {
  arms: 3,                 // spiral arms per click vortex
  startSize: 60,           // how big the vortex is the moment you click, px
  maxRadius: 300,          // how far the arms reach as it spreads, px
  lifetime: 5200,          // how long the vortex takes to fade away, ms
  width: 18,               // widest (softest) pass, px
  strength: 62,            // opacity of the strongest pass at the start, percent
  curl: 3.2,               // how tightly the arms spiral in towards the centre, radians
  swing: 1.0,              // extra twist that swings back and forth, radians
  swingSpeed: 1.2,         // how fast the twist swings
  turn: 0.6,               // slow steady turning, radians per second
  smoothness: 48,          // pieces per arm; more = smoother curves
  maxClicks: 8,            // older clicks are dropped beyond this
};

// The same three soft passes as the flow lines in background.js.
const SOFT_PASSES = [
  { width: 1.0, strength: 0.3 },
  { width: 0.6, strength: 0.6 },
  { width: 0.3, strength: 1.0 },
];

const pointerCanvas = document.querySelector(".pointer-effects");
const pointerContext = pointerCanvas.getContext("2d");
const accentRgbs = [];
const trailPoints = [];
const ripples = [];
let trailColourIndex = 0;
let rippleColourIndex = 0;
let pointerFrame = 0;


// ---------- Setup ----------

function setAccentRgbs() {
  // Reads the accent colours from styles.css so the effects match the swirls.
  for (const name of BG.accentColours) {
    const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace("#", "");
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    accentRgbs.push(red + ", " + green + ", " + blue);
  }
}

function setPointerCanvasSize() {
  // Matches the screen's pixel density so lines stay crisp.
  const ratio = Math.min(2, window.devicePixelRatio || 1);   // sharper than 2x costs a lot on phones for little gain
  pointerCanvas.width = Math.round(window.innerWidth * ratio);
  pointerCanvas.height = Math.round(window.innerHeight * ratio);
  pointerContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setPointerFrameSoon() {
  if (!pointerFrame) {
    pointerFrame = requestAnimationFrame(setPointerFrame);
  }
}

// ---------- Trail ----------

function setPointerShift(dx, dy) {
  // The world slid under the page (flight.js), and the view scrolled back by
  // the same amount: keep the trail and ripples where they are on screen.
  for (const point of trailPoints) {
    point.x -= dx;
    point.y -= dy;
  }
  for (const ripple of ripples) {
    ripple.x -= dx;
    ripple.y -= dy;
  }
  setPointerFrameSoon();
}

function setTrailPoint(event) {
  const now = performance.now();
  const x = event.clientX + window.scrollX;
  const y = event.clientY + window.scrollY;
  const last = trailPoints[trailPoints.length - 1];
  let along = 0;

  if (last) {
    const moved = Math.hypot(x - last.x, y - last.y);
    if (moved < TRAIL.minDistance) {
      return;
    }
    if (now - last.time > TRAIL.restTime) {
      trailColourIndex = (trailColourIndex + 1) % accentRgbs.length;
    }
    along = last.along + moved;
  }

  // "along" is how far along the trail this point is, for the travelling pulses.
  trailPoints.push({ x: x, y: y, along: along, time: now, colour: accentRgbs[trailColourIndex] });
  if (trailPoints.length > TRAIL.maxPoints) {
    trailPoints.shift();
  }
  setPointerFrameSoon();
}

function getDriftedPoint(point, now) {
  // Where a trail point is drawn right now: older points are carried further
  // by a smooth, slowly flowing current (on screen, so it follows scrolling).
  const seconds = now / 1000;
  const age = (now - point.time) / TRAIL.lifetime;
  const amount = TRAIL.drift * age;
  const flow = seconds * TRAIL.driftSpeed;
  return {
    x: point.x - window.scrollX + amount * Math.sin(point.y * TRAIL.driftScale + flow + 1.3),
    y: point.y - window.scrollY + amount * Math.cos(point.x * TRAIL.driftScale * 1.1 - flow * 0.9),
  };
}

function getPulse(point, now) {
  // Bright pulses that slide along the trail, like the dashes on the flow lines.
  const travel = (point.along - now / 1000 * TRAIL.pulseSpeed) / TRAIL.pulseLength * Math.PI * 2;
  const wave = Math.pow(0.5 + 0.5 * Math.sin(travel), TRAIL.pulseSharpness);
  return 1 - TRAIL.pulseDepth * (1 - wave);
}

function setTrailSegment(before, point, after, width, colour, opacity) {
  // A curve from the middle of the previous segment to the middle of the next,
  // bending through this point. Neighbouring curves meet smoothly, so flat
  // ("butt") line ends join without gaps or overlapping blobs.
  pointerContext.beginPath();
  pointerContext.moveTo((before.x + point.x) / 2, (before.y + point.y) / 2);
  pointerContext.quadraticCurveTo(point.x, point.y, (point.x + after.x) / 2, (point.y + after.y) / 2);
  pointerContext.lineWidth = width;
  pointerContext.strokeStyle = "rgba(" + colour + ", " + opacity + ")";
  pointerContext.stroke();
}

function setTrail(now) {
  // Drops faded points, then draws the rest; older parts are thinner, fainter
  // and drift further.
  while (trailPoints.length > 0 && now - trailPoints[0].time > TRAIL.lifetime) {
    trailPoints.shift();
  }
  pointerContext.lineCap = "butt";
  pointerContext.lineJoin = "round";

  const drawn = [];
  for (const point of trailPoints) {
    drawn.push(getDriftedPoint(point, now));
  }

  // Soft glow: a wide faint pass, then a narrower brighter core, so the
  // trail blends into the background like light.
  const passes = [
    { width: 1.0, strength: 0.3 },
    { width: 0.4, strength: 0.75 },
  ];
  for (const pass of passes) {
    for (let i = 1; i < trailPoints.length; i++) {
      const point = trailPoints[i];
      const after = Math.min(trailPoints.length - 1, i + 1);
      const life = 1 - (now - point.time) / TRAIL.lifetime;
      const pulse = getPulse(point, now);
      const width = TRAIL.width * pass.width * (TRAIL.taper + (1 - TRAIL.taper) * life) * (1 - TRAIL.pulseSwell + TRAIL.pulseSwell * pulse);
      const colour = point.colour;
      const opacity = life * (0.35 + 0.65 * pulse) * pass.strength;
      setTrailSegment(drawn[i - 1], drawn[i], drawn[after], width, colour, opacity);
    }
  }
}

// ---------- Click vortex (fallback drawing) ----------

function setRipple(event) {
  // Left button only (taps count as the left button too).
  if (event.button !== 0 || getIsPlainView()) {
    return;
  }
  // Clicks on links, buttons, the planet label/panel, or planets do their own
  // thing, and a click while a panel is open just closes it (sun.js).
  if (event.target && event.target.closest && event.target.closest("a, button, input, .planet-panel, .planet-label, .contents, .joystick")) {
    return;
  }
  if (typeof getIsOverPlanet === "function" && getIsOverPlanet(event.clientX, event.clientY)) {
    return;
  }
  if (typeof getIsPanelOpen === "function" && getIsPanelOpen()) {
    return;
  }
  const colourIndex = rippleColourIndex;
  rippleColourIndex = (rippleColourIndex + 1) % accentRgbs.length;

  // The click becomes the centre point the background rings and rays pour
  // out of, and sends a gentle wave through the swirls.
  if (typeof setCentrePoint === "function") {
    setCentrePoint(event.clientX, event.clientY);
  }
  if (typeof setBackgroundRipple === "function") {
    setBackgroundRipple(event.clientX, event.clientY);
  }

  // While the background swirl layer is animating, the new centre point is
  // the click's effect: rings start pouring out of it straight away.
  if (typeof getIsSwirlAnimating === "function" && getIsSwirlAnimating()) {
    return;
  }

  // Fallback when the swirl layer isn't animating: draw spiral arms here.
  let spin = 1;
  if (Math.random() < 0.5) {
    spin = -1;
  }
  ripples.push({
    x: event.clientX + window.scrollX,
    y: event.clientY + window.scrollY,
    time: performance.now(),
    colour: accentRgbs[colourIndex],
    spin: spin,
    angle: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
  });
  if (ripples.length > RIPPLE.maxClicks) {
    ripples.shift();
  }
  setPointerFrameSoon();
}

function getEaseOut(progress) {
  // Fast at first, then slowing down, like a ripple on water.
  return 1 - Math.pow(1 - progress, 3);
}

function getArmPoint(ripple, arm, reach, size, seconds) {
  // One point on a spiral arm, "reach" of the way from the centre (0) to the
  // tip (1). Like the background vortices, the twist is strongest near the
  // centre, swings back and forth, and slowly turns over time.
  const inward = 1 - reach;
  const swing = RIPPLE.swing * Math.sin(seconds * RIPPLE.swingSpeed + ripple.phase);
  const twist = (RIPPLE.curl + swing) * inward * inward;
  const angle = ripple.angle
    + arm / RIPPLE.arms * Math.PI * 2
    + ripple.spin * (twist + RIPPLE.turn * seconds);
  const r = size * reach;
  return {
    x: ripple.x - window.scrollX + Math.cos(angle) * r,
    y: ripple.y - window.scrollY + Math.sin(angle) * r,
  };
}

function setVortexArm(ripple, arm, size, seconds, width, opacity) {
  // Draws one arm as short pieces so each piece can have its own strength:
  // the arm is faint at the very centre, strongest in the middle and tapers
  // to nothing at the tip. Flat piece ends avoid beads where pieces meet.
  const steps = RIPPLE.smoothness;
  let previous = getArmPoint(ripple, arm, 0, size, seconds);
  for (let i = 1; i <= steps; i++) {
    const reach = i / steps;
    const point = getArmPoint(ripple, arm, reach, size, seconds);
    const middle = (i - 0.5) / steps;
    const strength = Math.pow(Math.sin(Math.PI * Math.min(1, middle * 1.15)), 0.8);
    pointerContext.beginPath();
    pointerContext.moveTo(previous.x, previous.y);
    pointerContext.lineTo(point.x, point.y);
    pointerContext.lineWidth = width * (0.35 + 0.65 * strength);
    pointerContext.strokeStyle = "rgba(" + ripple.colour + ", " + opacity * strength + ")";
    pointerContext.stroke();
    previous = point;
  }
}

function setRipples(now) {
  while (ripples.length > 0 && now - ripples[0].time > RIPPLE.lifetime) {
    ripples.shift();
  }
  pointerContext.lineCap = "butt";
  pointerContext.lineJoin = "round";

  for (const pass of SOFT_PASSES) {
    for (const ripple of ripples) {
      const age = now - ripple.time;
      const progress = age / RIPPLE.lifetime;
      const seconds = age / 1000;
      // Starts small and grows quickly, then slows, while fading away.
      const size = RIPPLE.startSize + (RIPPLE.maxRadius - RIPPLE.startSize) * getEaseOut(progress);
      const life = 1 - progress;
      const width = RIPPLE.width * pass.width * (0.45 + 0.55 * life);
      const opacity = (RIPPLE.strength / 100) * pass.strength * Math.pow(life, 1.3);
      for (let arm = 0; arm < RIPPLE.arms; arm++) {
        setVortexArm(ripple, arm, size, seconds, width, opacity);
      }
    }
  }
}

// ---------- Drawing ----------

function setPointerFrame(now) {
  pointerContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
  setRipples(now);
  setTrail(now);

  if (trailPoints.length > 0 || ripples.length > 0) {
    pointerFrame = requestAnimationFrame(setPointerFrame);
  } else {
    pointerFrame = 0;
  }
}

setAccentRgbs();
setPointerCanvasSize();
window.addEventListener("resize", setPointerCanvasSize);
window.addEventListener("pointermove", setTrailPoint, { passive: true });
// A click moves the centre point there and sends a ripple. (flight.js
// swallows the click that ends a press-and-hold flight.)
window.addEventListener("click", setRipple);
