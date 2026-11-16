// =============================================================================
// Flying the orb
// =============================================================================
// Instead of scrolling the page, the visitor moves the orb (the background's
// centre point) around the big world, and the view follows it:
//
//   Hold             - press and hold (mouse or finger) and the orb flies
//                      towards the pointer, faster the further away it is.
//   Click / tap      - a quick click on empty space dashes the orb there
//                      (pointer-effects.js does that part).
//   Keys             - arrow keys or WASD fly it.
//   Joystick         - on touch screens, a thumb stick flies it (joystick.js).
//   Wheel / trackpad - nudges it.
//   SH. mark         - flies it home to the middle of the world.
//
// Flying close to a hidden planet pulls it in (hunt.js, setGravityCatch).
// The world never ends: when the orb nears the edge of the page, the whole
// world slides back under it (setWorldRecentred) and the view scrolls by the
// same amount, so nothing visibly moves.
// The page itself never scrolls by hand. The orb roams freely round the
// middle of the screen; the camera (window.scrollTo) only pans once it nears
// an edge or corner (FLIGHT.cameraEdge), easing, or at once with reduced motion.
// =============================================================================

const FLIGHT = {
  holdDelay: 150,         // ms a press must last before it becomes a flight
  holdMove: 6,            // ...or px it must move
  speedPerPx: 2.2,        // flight speed per px between orb and pointer, px/s
  maxSpeed: 1100,         // fastest the orb flies, px/s
  keySpeed: 520,          // flight speed with the keys, px/s
  stickSpeed: 820,        // flight speed with the joystick pushed all the way, px/s
  touchSpeed: 0.55,       // on touch screens, holding and the joystick fly this much slower
  wheelScale: 0.9,        // orb px moved per wheel px
  edge: 60,               // the orb never gets closer than this to the page's edge, px
  recentreEdge: 0.3,      // when the view is within this many screens of the page's edge, the world slides back
  cameraEdge: 0.2,        // the view only moves once the orb is within this share of the screen's edge
  cameraEase: 6,          // how quickly the view catches up (per s)
  maxStep: 1 / 30,        // a slow frame moves things at most this many seconds' worth,
                          // so a hiccup (common on phones) never makes the view jump
};

const flightMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const flightPage = document.querySelector(".page");
const flightTouch = window.matchMedia("(hover: none) and (pointer: coarse)");

const flightState = {
  pointerId: null,        // the pointer being held, if any
  downAt: 0,              // when it was pressed (ms)
  downX: 0,               // where it was pressed (client px)
  downY: 0,
  pointerX: 0,            // where it is now (client px)
  pointerY: 0,
  isFlying: false,        // has the press turned into a flight?
  swallowClick: false,    // ignore the click that ends a flight
  keys: new Set(),        // direction keys held down
  stickX: 0,              // the touch joystick (joystick.js), each -1..1
  stickY: 0,
  lastFrame: null,        // time of the previous frame (ms)
  cameraSnap: true,       // jump the view to the orb next frame
  lastWheel: -1000,       // when the wheel last nudged the orb (ms)
};

const FLIGHT_KEYS = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
};

// ---------- Moving the orb ----------

function getIsSteering() {
  // Used by extras.js: is the visitor moving the orb themselves right now
  // (holding to fly, holding a key, or using the wheel)?
  if (flightState.isFlying || flightState.keys.size > 0 || flightState.stickX !== 0 || flightState.stickY !== 0) {
    return true;
  }
  return performance.now() - flightState.lastWheel < 400;
}

function getSpeedFactor() {
  // Faster in a river or while boosting (extras.js).
  if (typeof getFlightSpeedFactor === "function") {
    return getFlightSpeedFactor();
  }
  return 1;
}

function getTouchFactor() {
  // Phone screens are small, so full speed whips the orb past things.
  return flightTouch.matches ? FLIGHT.touchSpeed : 1;
}

function getOrbPagePoint() {
  return getCentrePagePoint();
}

function setOrbMovedBy(dx, dy) {
  // Moves the orb by (dx, dy) page px, keeping it inside the world.
  if (dx === 0 && dy === 0) {
    return;
  }
  const orb = getOrbPagePoint();
  const pageBox = flightPage.getBoundingClientRect();
  const x = Math.min(pageBox.width - FLIGHT.edge, Math.max(FLIGHT.edge, orb.x + dx));
  const y = Math.min(pageBox.height - FLIGHT.edge, Math.max(FLIGHT.edge, orb.y + dy));
  setCentrePagePosition(x, y);
  if (flightMotion.matches && typeof setSunFrame === "function") {
    // No animation loop with reduced motion, so redraw the orb here.
    setSunFrame(0);
  }
}

function setOrbHome() {
  // Sends the orb back to where it started, world (0, 0) (the SH. mark).
  // If that's far away, the world slides first so home is just off screen,
  // then the orb glides the last stretch.
  const origin = getWorldOrigin();
  let pageBox = flightPage.getBoundingClientRect();
  const orb = getOrbPagePoint();
  const homeX = -origin.x;
  const homeY = -origin.y;
  const awayX = homeX - orb.x;
  const awayY = homeY - orb.y;
  const away = Math.hypot(awayX, awayY);
  const glideReach = Math.min(window.innerWidth, window.innerHeight) * 0.6;
  if (away > glideReach) {
    // Jump to a spot glideReach short of home, keeping the view on the orb.
    const step = getShiftStep();
    const jumpX = Math.round(awayX * (1 - glideReach / away) / step) * step;
    const jumpY = Math.round(awayY * (1 - glideReach / away) / step) * step;
    setWorldShift(jumpX, jumpY);
    setCentrePagePosition(orb.x, orb.y);
    if (typeof setSunShift === "function") {
      setSunShift(-jumpX, -jumpY);
    }
    flightState.cameraSnap = true;
    setCameraFrame(0);
    pageBox = flightPage.getBoundingClientRect();
  }
  const newOrigin = getWorldOrigin();
  setCentrePoint(pageBox.left - newOrigin.x, pageBox.top - newOrigin.y);
  if (flightMotion.matches && typeof setSunFrame === "function") {
    setSunFrame(0);
  }
}

// ---------- The endless world ----------

function setWorldShift(dx, dy) {
  // Slides the world (dx, dy) page px under the page, and everything on the
  // page back by the same, then scrolls the view to match.
  if (typeof setBackgroundShift === "function") {
    setBackgroundShift(dx, dy);
  }
  if (typeof setSunShift === "function") {
    setSunShift(dx, dy);
  }
  if (typeof setHuntShift === "function") {
    setHuntShift(dx, dy);
  }
  if (typeof setPointerShift === "function") {
    setPointerShift(dx, dy);
  }
  window.scrollTo(window.scrollX - dx, window.scrollY - dy);
}

function setWorldRecentred() {
  // When the view nears the edge of the page, the world slides back so the
  // view is in the middle of the page again. (The orb always stays on
  // screen, so it stays well inside the page too.)
  if (typeof setBackgroundShift !== "function") {
    return;
  }
  const pageBox = flightPage.getBoundingClientRect();
  const viewX = -pageBox.left;
  const viewY = -pageBox.top;
  const maxX = pageBox.width - window.innerWidth;
  const maxY = pageBox.height - window.innerHeight;
  const roomX = window.innerWidth * FLIGHT.recentreEdge;
  const roomY = window.innerHeight * FLIGHT.recentreEdge;
  const nearEdge = viewX < roomX || viewX > maxX - roomX || viewY < roomY || viewY > maxY - roomY;
  if (!nearEdge) {
    return;
  }
  // Whole steps, so the landscape can be copied across pixel for pixel.
  const step = getShiftStep();
  const dx = Math.round((viewX - maxX / 2) / step) * step;
  const dy = Math.round((viewY - maxY / 2) / step) * step;
  if (dx !== 0 || dy !== 0) {
    setWorldShift(dx, dy);
  }
}

// ---------- Holding to fly ----------

function getIsFlightBlocked(event) {
  // Presses on links, buttons, the panel or label, or on a planet, and any
  // press while a panel is open, do their own thing.
  if (event.button !== 0 || getIsPlainView()) {
    return true;
  }
  if (event.target && event.target.closest && event.target.closest("a, button, input, .planet-panel, .planet-label, .radar, .contents, .joystick")) {
    return true;
  }
  if (typeof getIsOverPlanet === "function" && getIsOverPlanet(event.clientX, event.clientY)) {
    return true;
  }
  if (typeof getIsPanelOpen === "function" && getIsPanelOpen()) {
    return true;
  }
  return false;
}

function setFlightStart(event) {
  flightState.swallowClick = false;
  if (getIsFlightBlocked(event)) {
    return;
  }
  flightState.pointerId = event.pointerId;
  flightState.downAt = performance.now();
  flightState.downX = event.clientX;
  flightState.downY = event.clientY;
  flightState.pointerX = event.clientX;
  flightState.pointerY = event.clientY;
  flightState.isFlying = false;
}

function setFlightPointer(event) {
  if (event.pointerId !== flightState.pointerId) {
    return;
  }
  flightState.pointerX = event.clientX;
  flightState.pointerY = event.clientY;
}

function setFlightEnd(event) {
  if (event.pointerId !== flightState.pointerId) {
    return;
  }
  if (flightState.isFlying) {
    flightState.swallowClick = true;
  }
  flightState.pointerId = null;
  flightState.isFlying = false;
  document.body.classList.remove("is-flying");
}

function setFlightClickIgnored(event) {
  // The click that ends a hold-to-fly isn't a dash.
  if (!flightState.swallowClick) {
    return;
  }
  flightState.swallowClick = false;
  event.stopImmediatePropagation();
  event.preventDefault();
}

function setHoldFlight(elapsed) {
  // Flies the orb towards the held pointer.
  if (flightState.pointerId === null) {
    return;
  }
  if (!flightState.isFlying) {
    const held = performance.now() - flightState.downAt;
    const moved = Math.hypot(flightState.pointerX - flightState.downX, flightState.pointerY - flightState.downY);
    if (held < FLIGHT.holdDelay && moved < FLIGHT.holdMove) {
      return;
    }
    flightState.isFlying = true;
    document.body.classList.add("is-flying");
  }
  const pageBox = flightPage.getBoundingClientRect();
  const orb = getOrbPagePoint();
  const dx = flightState.pointerX - pageBox.left - orb.x;
  const dy = flightState.pointerY - pageBox.top - orb.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) {
    return;
  }
  const speed = Math.min(FLIGHT.maxSpeed, distance * FLIGHT.speedPerPx) * getSpeedFactor() * getTouchFactor();
  const step = Math.min(distance, speed * elapsed);
  setOrbMovedBy(dx / distance * step, dy / distance * step);
}

// ---------- Keys and wheel ----------

function getFlightKey(event) {
  // The direction for a key, or null. Letters ignore Shift / Caps Lock.
  let key = event.key;
  if (key.length === 1) {
    key = key.toLowerCase();
  }
  if (FLIGHT_KEYS[key]) {
    return key;
  }
  return null;
}

function getIsTyping(target) {
  // Keys inside the panel (scrolling it) or a text field aren't for flying.
  if (!target || !target.closest) {
    return false;
  }
  return target.closest("input, textarea, .planet-panel, .contents") !== null;
}

function setKeyDown(event) {
  const key = getFlightKey(event);
  if (key === null || getIsPlainView() || event.ctrlKey || event.metaKey || event.altKey || getIsTyping(event.target)) {
    return;
  }
  event.preventDefault();
  flightState.keys.add(key);
}

function setKeyUp(event) {
  const key = getFlightKey(event);
  if (key !== null) {
    flightState.keys.delete(key);
  }
}

function setKeyFlight(elapsed) {
  let x = 0;
  let y = 0;
  for (const key of flightState.keys) {
    x = x + FLIGHT_KEYS[key].x;
    y = y + FLIGHT_KEYS[key].y;
  }
  const length = Math.hypot(x, y);
  if (length === 0) {
    return;
  }
  const step = FLIGHT.keySpeed * elapsed * getSpeedFactor();
  setOrbMovedBy(x / length * step, y / length * step);
}

function setFlightStick(x, y) {
  // Used by joystick.js: how far the stick is pushed, each axis -1..1.
  flightState.stickX = x;
  flightState.stickY = y;
}

function setStickFlight(elapsed) {
  // A gentle curve, so small pushes give fine control near planets.
  const push = Math.min(1, Math.hypot(flightState.stickX, flightState.stickY));
  if (push === 0 || (typeof getIsPanelOpen === "function" && getIsPanelOpen())) {
    return;
  }
  const length = Math.hypot(flightState.stickX, flightState.stickY);
  const step = FLIGHT.stickSpeed * Math.pow(push, 1.5) * elapsed * getSpeedFactor() * getTouchFactor();
  setOrbMovedBy(flightState.stickX / length * step, flightState.stickY / length * step);
}

function setWheelFlight(event) {
  // The wheel or trackpad nudges the orb (the panel still scrolls normally,
  // and Ctrl + wheel still zooms).
  if (event.ctrlKey || getIsTyping(event.target) || getIsPlainView()) {
    return;
  }
  event.preventDefault();
  flightState.lastWheel = performance.now();
  let scale = FLIGHT.wheelScale;
  if (event.deltaMode === 1) {
    scale = scale * 16;    // lines, not px
  }
  setOrbMovedBy(event.deltaX * scale, event.deltaY * scale);
}

// ---------- The camera ----------

function setCameraOnOrb(smooth) {
  // Used by sun.js (setViewOnOrb): the camera already keeps the orb on
  // screen, so only a jump (not smooth) needs anything: it centres the orb.
  if (!smooth) {
    flightState.cameraSnap = true;
  }
}

function getCameraAxisTarget(scroll, onScreen, screenSize, centre) {
  // Where the view should scroll to along one axis. The orb roams freely in
  // the middle of the screen; the view only moves to keep it out of the
  // border (FLIGHT.cameraEdge), or centres it when asked to (centre).
  if (centre) {
    return scroll + onScreen - screenSize / 2;
  }
  const border = screenSize * FLIGHT.cameraEdge;
  if (onScreen < border) {
    return scroll - (border - onScreen);
  }
  if (onScreen > screenSize - border) {
    return scroll + (onScreen - (screenSize - border));
  }
  return scroll;
}

function setCameraFrame(elapsed) {
  // Moves the view only when the orb nears an edge or corner of the screen
  // (or centres it on the orb when cameraSnap is set, e.g. on load).
  let point = getOrbPagePoint();
  if (typeof sunState !== "undefined" && sunState.hasPosition && !flightMotion.matches) {
    point = { x: sunState.x, y: sunState.y };   // where the orb is drawn (it glides)
  }
  const pageBox = flightPage.getBoundingClientRect();
  const centre = flightState.cameraSnap;
  const targetX = getCameraAxisTarget(window.scrollX, pageBox.left + point.x, window.innerWidth, centre);
  const targetY = getCameraAxisTarget(window.scrollY, pageBox.top + point.y, window.innerHeight, centre);
  let ease = 1 - Math.exp(-FLIGHT.cameraEase * elapsed);
  if (flightState.cameraSnap || flightMotion.matches) {
    ease = 1;
    flightState.cameraSnap = false;
  }
  const x = window.scrollX + (targetX - window.scrollX) * ease;
  const y = window.scrollY + (targetY - window.scrollY) * ease;
  if (Math.abs(x - window.scrollX) > 0.5 || Math.abs(y - window.scrollY) > 0.5) {
    window.scrollTo(x, y);
  }
}

// ---------- Every frame ----------

function setFlightFrame(now) {
  let elapsed = 0;
  if (flightState.lastFrame !== null) {
    elapsed = Math.min(FLIGHT.maxStep, (now - flightState.lastFrame) / 1000);
  }
  flightState.lastFrame = now;
  if (!getIsPlainView()) {
    setHoldFlight(elapsed);
    setKeyFlight(elapsed);
    setStickFlight(elapsed);
    setWorldRecentred();
    setCameraFrame(elapsed);
  }
  requestAnimationFrame(setFlightFrame);
}

function setFlightStop() {
  // Lets go of everything (the window lost focus, say).
  flightState.keys.clear();
  flightState.stickX = 0;
  flightState.stickY = 0;
  flightState.pointerId = null;
  flightState.isFlying = false;
  document.body.classList.remove("is-flying");
}

window.addEventListener("pointerdown", setFlightStart);
window.addEventListener("pointermove", setFlightPointer, { passive: true });
window.addEventListener("pointerup", setFlightEnd);
window.addEventListener("pointercancel", setFlightEnd);
window.addEventListener("click", setFlightClickIgnored, true);
window.addEventListener("keydown", setKeyDown);
window.addEventListener("keyup", setKeyUp);
window.addEventListener("wheel", setWheelFlight, { passive: false });
window.addEventListener("blur", setFlightStop);
requestAnimationFrame(setFlightFrame);

// ---------- Frame-rate readout (add ?fps=1 to the address) ----------
// Shows frames per second and the slowest frame of the last second, to
// check smoothness on a phone.
if (new URLSearchParams(window.location.search).get("fps") === "1") {
  const readout = document.createElement("div");
  readout.style.cssText = "position:fixed;left:8px;top:50%;z-index:99;padding:4px 8px;border-radius:6px;" +
    "background:rgba(0,0,0,0.7);color:#fff;font:12px monospace;pointer-events:none";
  document.body.appendChild(readout);
  let frames = 0;
  let slowest = 0;
  let last = performance.now();
  let since = last;
  const setReadoutFrame = function (now) {
    frames += 1;
    slowest = Math.max(slowest, now - last);
    last = now;
    if (now - since >= 1000) {
      readout.textContent = Math.round(frames * 1000 / (now - since)) + " fps · slowest " + Math.round(slowest) + " ms";
      frames = 0;
      slowest = 0;
      since = now;
    }
    requestAnimationFrame(setReadoutFrame);
  };
  requestAnimationFrame(setReadoutFrame);
}
