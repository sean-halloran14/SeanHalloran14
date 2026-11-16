// =============================================================================
// Zooming out to see more of the painted world
// =============================================================================
// The + and − buttons (and the - and + keys) step between a few zoom levels.
// Zooming out shrinks the whole world around the orb (background.js,
// setBackgroundZoom): the landscape, the orb and its planets, hidden planets,
// black holes and stardust all get smaller together, so more of the painting
// fits on screen and the orb sits where it was in it. The change eases over a
// moment (at once with reduced motion).
//
// On touch screens the buttons sit just above the joystick, under the thumb
// (styles.css, .zoom).
// =============================================================================

const ZOOM = {
  levels: [1, 0.7, 0.5],  // shares of the starting zoom (background.js, BG.zoom)
  time: 0.4,              // seconds to ease from one level to the next
};

const zoomMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const zoomInButton = document.querySelector(".zoom-in");
const zoomOutButton = document.querySelector(".zoom-out");

const zoomState = {
  level: 0,               // index into ZOOM.levels
  from: 1,                // share of the starting zoom when the ease began
  to: 1,
  start: 0,               // ms
  frame: 0,
};

function getZoomShare() {
  return BG.zoom / BG_START_ZOOM;
}

function setWorldZoom(share) {
  // Zooms everything to this share of the starting zoom, right now.
  const factor = setBackgroundZoom(BG_START_ZOOM * share);
  if (factor === 1) {
    return;
  }
  if (typeof setHuntZoom === "function") {
    setHuntZoom(factor);
  }
  if (typeof setExtrasZoom === "function") {
    setExtrasZoom(factor);
  }
  if (typeof setSunLayout === "function") {
    setSunLayout();
  }
}

function setZoomFrame(now) {
  const along = Math.min(1, (now - zoomState.start) / (ZOOM.time * 1000));
  const eased = 1 - Math.pow(1 - along, 3);
  setWorldZoom(zoomState.from + (zoomState.to - zoomState.from) * eased);
  if (along < 1) {
    zoomState.frame = requestAnimationFrame(setZoomFrame);
  } else {
    zoomState.frame = 0;
  }
}

function setZoomButtons() {
  zoomInButton.disabled = zoomState.level === 0;
  zoomOutButton.disabled = zoomState.level === ZOOM.levels.length - 1;
}

function setZoomLevel(level) {
  level = Math.max(0, Math.min(ZOOM.levels.length - 1, level));
  if (level === zoomState.level || getIsPlainView()) {
    return;
  }
  zoomState.level = level;
  setZoomButtons();
  cancelAnimationFrame(zoomState.frame);
  zoomState.from = getZoomShare();
  zoomState.to = ZOOM.levels[level];
  if (zoomMotion.matches) {
    setWorldZoom(zoomState.to);
    return;
  }
  zoomState.start = performance.now();
  zoomState.frame = requestAnimationFrame(setZoomFrame);
}

function setZoomKey(event) {
  // - zooms out, + (or =) zooms back in. Not while typing or with Ctrl/Cmd
  // (that's the browser's own zoom).
  if (event.ctrlKey || event.metaKey || event.altKey || getIsPlainView()) {
    return;
  }
  if (event.target && event.target.closest && event.target.closest("input, textarea, .planet-panel")) {
    return;
  }
  if (event.key === "-" || event.key === "_") {
    setZoomLevel(zoomState.level + 1);
  } else if (event.key === "+" || event.key === "=") {
    setZoomLevel(zoomState.level - 1);
  }
}

zoomInButton.addEventListener("click", function () {
  setZoomLevel(zoomState.level - 1);
});
zoomOutButton.addEventListener("click", function () {
  setZoomLevel(zoomState.level + 1);
});
window.addEventListener("keydown", setZoomKey);
setZoomButtons();
