// =============================================================================
// The map, and fast travel
// =============================================================================
// The Map button (top bar, or the M key) opens a map of the stretch of
// shore where the places are (town.js): the sky coloured by the time of
// day along it (the world has a day side and a night side), the sun over
// the day side and the moon over the night side, the mountains, the forest
// and the lake, each place's building with its name, and where you are
// (an arrow at the edge if you're off the map). Click or tap a place to
// fast travel there: a flash, and you're at its door (flight.js,
// setOrbTeleported), where the invitation to go inside pops up.
//
// Painted in the site's palette (town.js's paint helpers). Settings in MAP.
//
// Uses from background.js: BG, swirlState, getWorldOrigin, getNearestLoopX,
// getHeightInDay, getIsPlainView, getIsInsideBuilding. From town.js:
// townState, getPlaceWorldPoint, getTownMood, getMoodRgb, getPaintRgb,
// getMixedRgb, getRgbText. From sun.js: getPlanetItem, getCentrePagePoint.
// From flight.js: setOrbTeleported.
// =============================================================================

const MAP = {
  margin: 1600,            // the map reaches this far past the outermost places, landscape px
  top: -1700,              // the landscape y at the map's top edge...
  bottom: 1850,            // ...and at its bottom edge (room on the lake for the places' names)
  strips: 90,              // the sky is painted in this many strips across
  flashTime: 450,          // ms the fast-travel flash takes
};

const mapButton = document.createElement("button");
mapButton.type = "button";
mapButton.className = "top-link map-button";
mapButton.textContent = "Map";
mapButton.setAttribute("aria-expanded", "false");
mapButton.setAttribute("aria-controls", "map");
mapButton.title = "Map (M)";
document.querySelector(".contents-button").insertAdjacentElement("afterend", mapButton);

const mapBox = document.createElement("div");
mapBox.className = "map";
mapBox.id = "map";
mapBox.hidden = true;
mapBox.setAttribute("role", "dialog");
mapBox.setAttribute("aria-label", "Map");
mapBox.innerHTML = [
  '<div class="map-card">',
  '  <div class="map-head">',
  '    <p class="map-title">Map</p>',
  '    <button class="map-close" type="button" aria-label="Close the map">&times;</button>',
  '  </div>',
  '  <div class="map-view">',
  '    <canvas class="map-art" aria-hidden="true"></canvas>',
  '    <div class="map-pins"></div>',
  '    <div class="map-you" aria-hidden="true"><span class="map-you-dot"></span><span class="map-you-label">You</span></div>',
  '  </div>',
  '  <p class="map-note">Click a place to fast travel there.</p>',
  '</div>',
].join("");
document.body.appendChild(mapBox);

const mapFlash = document.createElement("div");
mapFlash.className = "travel-flash";
mapFlash.hidden = true;
mapFlash.setAttribute("aria-hidden", "true");
document.body.appendChild(mapFlash);

const mapView = mapBox.querySelector(".map-view");
const mapCanvas = mapBox.querySelector(".map-art");
const mapContext = mapCanvas.getContext("2d");
const mapPins = mapBox.querySelector(".map-pins");
const mapYou = mapBox.querySelector(".map-you");
const mapTouch = window.matchMedia("(hover: none) and (pointer: coarse)");

// ---------- Where things are on the map ----------

function getMapRange() {
  // The landscape x the map spans: the places, with a margin either side.
  let low = 0;
  let high = 0;
  for (const place of townState.places) {
    low = Math.min(low, place.x);
    high = Math.max(high, place.x);
  }
  return { left: low - MAP.margin, right: high + MAP.margin };
}

function getMapShare(x, range) {
  // Where a landscape x falls across the map, 0 (left) to 1 (right).
  return (x - range.left) / (range.right - range.left);
}

function getMapDown(y) {
  // Where a landscape y falls down the map, 0 (top) to 1 (bottom).
  return Math.min(1, Math.max(0, (y - MAP.top) / (MAP.bottom - MAP.top)));
}

function getMapPageX(x) {
  // The page x of a landscape x (for the time of day there).
  return x * BG.zoom - getWorldOrigin().x;
}

function getMapNearestX(x, near) {
  // The copy of a landscape x round the loop nearest another.
  const loop = BG.dayWidth;
  return x + Math.round((near - x) / loop) * loop;
}

function getMapDayX(dayPoint, near) {
  // The landscape x where it's this time of day (0 = sunrise), nearest 'near'.
  const drift = typeof swirlState !== "undefined" ? swirlState.dayDrift : 0;
  const x = (dayPoint - BG.dayStart - drift) * BG.dayWidth;
  return getMapNearestX(x, near);
}

// ---------- Painting the map ----------

function setMapArt() {
  // Sky by the time of day, sun and moon, mountains, forest, lake, and the
  // places' buildings, in the painting's palette.
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = mapView.clientWidth;
  const height = mapView.clientHeight;
  mapCanvas.width = Math.round(width * ratio);
  mapCanvas.height = Math.round(height * ratio);
  const context = mapContext;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const range = getMapRange();
  const ink = getRgbText(getPaintRgb("INK"));
  const horizon = getMapDown(BG.horizon) * height;
  const shore = getMapDown(BG.shoreLevel) * height;
  const hills = getMapDown(BG.horizon + 330) * height;

  // Sky, strip by strip, with the colours of the time of day there.
  for (let i = 0; i < MAP.strips; i++) {
    const x = range.left + (i + 0.5) / MAP.strips * (range.right - range.left);
    const mood = getTownMood(getMapPageX(x));
    const sky = context.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, getRgbText(getMoodRgb(mood, "VIOLET", "SPACE", "NIGHT_BLUE")));
    sky.addColorStop(0.6, getRgbText(getMoodRgb(mood, "MAGENTA", "INDIGO", "PASTEL_MINT")));
    sky.addColorStop(1, getRgbText(getMoodRgb(mood, "GOLD", "NIGHT_BLUE", "PASTEL_PINK")));
    context.fillStyle = sky;
    context.fillRect(Math.floor(i / MAP.strips * width), 0, Math.ceil(width / MAP.strips) + 1, horizon + 2);
  }

  // The sun over the middle of the day side, the moon over the night side.
  const middle = (range.left + range.right) / 2;
  const sunX = getMapDayX(BG.dayShare / 2, middle);
  const moonX = getMapDayX(BG.dayShare + (1 - BG.dayShare) / 2, middle);
  const bodyY = horizon * 0.32;
  const bodySize = Math.max(9, height * 0.055);
  if (sunX > range.left && sunX < range.right) {
    const x = getMapShare(sunX, range) * width;
    context.beginPath();
    context.arc(x, bodyY, bodySize * 1.9, 0, Math.PI * 2);
    context.fillStyle = getRgbText(getPaintRgb("GOLD"), 0.3);
    context.fill();
    context.beginPath();
    context.arc(x, bodyY, bodySize, 0, Math.PI * 2);
    context.fillStyle = getRgbText(getPaintRgb("GOLD"));
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = ink;
    context.stroke();
  }
  if (moonX > range.left && moonX < range.right) {
    const x = getMapShare(moonX, range) * width;
    context.beginPath();
    context.arc(x, bodyY, bodySize * 0.8, 0, Math.PI * 2);
    context.fillStyle = getRgbText(getPaintRgb("SNOW"));
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = ink;
    context.stroke();
  }

  // Mountains: a jagged, snow-capped skyline (a drawing of the idea, not
  // the painting's exact peaks).
  const peak = function (share) {
    const a = Math.sin(share * 37.1) * 0.5 + Math.sin(share * 91.7 + 1.3) * 0.3 + Math.sin(share * 211.3 + 2.1) * 0.2;
    return horizon - (0.35 + 0.65 * Math.abs(a)) * (horizon * 0.42);
  };
  context.beginPath();
  context.moveTo(0, hills);
  for (let px = 0; px <= width; px += 6) {
    context.lineTo(px, peak(px / width + range.left / 9000));
  }
  context.lineTo(width, hills);
  context.closePath();
  context.fillStyle = getRgbText(getMixedRgb(getPaintRgb("ROCK"), getPaintRgb("VIOLET"), 0.3));
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = ink;
  context.stroke();

  // Forest down to the shore, with a row of little pines along the top.
  context.fillStyle = getRgbText(getPaintRgb("PINE"));
  context.fillRect(0, hills, width, shore - hills);
  const pine = Math.max(5, height * 0.035);
  context.fillStyle = getRgbText(getMixedRgb(getPaintRgb("PINE"), getPaintRgb("PINE_LIGHT"), 0.35));
  for (let px = pine / 2; px < width; px += pine * 1.1) {
    context.beginPath();
    context.moveTo(px - pine / 2, hills + pine * 0.4);
    context.lineTo(px, hills - pine);
    context.lineTo(px + pine / 2, hills + pine * 0.4);
    context.fill();
  }
  context.beginPath();
  context.moveTo(0, hills);
  context.lineTo(width, hills);
  context.lineWidth = 2;
  context.strokeStyle = ink;
  context.stroke();

  // The lake.
  context.fillStyle = getRgbText(getMixedRgb(getPaintRgb("NIGHT_BLUE"), getPaintRgb("GLOW"), 0.25));
  context.fillRect(0, shore, width, height - shore);
  context.beginPath();
  context.moveTo(0, shore);
  context.lineTo(width, shore);
  context.stroke();
  context.strokeStyle = getRgbText(getPaintRgb("SNOW"), 0.35);
  context.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    const y = shore + (height - shore) * (0.3 + k * 0.22);
    context.beginPath();
    context.moveTo(width * (0.1 + k * 0.2), y);
    context.lineTo(width * (0.25 + k * 0.2), y);
    context.stroke();
  }

  // The places' buildings, in their clearings.
  for (const place of townState.places) {
    const x = getMapShare(place.x, range) * width;
    const foot = getMapDown(BG.clearingFloor) * height;
    setMapBuilding(context, place.icon, x, foot, Math.max(16, height * 0.13));
  }
}

function setMapBuilding(context, icon, x, foot, size) {
  // A little building for the map: the depot, the hall or the cabin.
  const ink = getRgbText(getPaintRgb("INK"));
  context.beginPath();
  context.ellipse(x, foot, size * 0.95, size * 0.28, 0, 0, Math.PI * 2);
  context.fillStyle = getRgbText(getMixedRgb(getPaintRgb("PINE"), getPaintRgb("PINE_LIGHT"), 0.4));
  context.fill();
  const shape = function (fill) {
    context.fillStyle = getRgbText(fill);
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = ink;
    context.stroke();
  };
  const brick = getMixedRgb(getPaintRgb("MAGENTA"), getPaintRgb("ORANGE"), 0.45);
  if (icon === "company") {
    // The lodge: garage, office (with its glass gable), kitchen and barn,
    // side by side, each under a dark roof.
    const wood = getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.45);
    const darkWood = getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.68);
    const roof = getMixedRgb(getPaintRgb("VIOLET"), getPaintRgb("ROCK_DARK"), 0.55);
    const parts = [[-1.5, -0.95, 0.42, 0.62, darkWood], [-0.95, -0.25, 0.48, 1.0, wood], [-0.25, 0.25, 0.4, 0.62, wood], [0.25, 1.1, 0.55, 0.85, darkWood]];
    for (const [from, to, tall, peak, fill] of parts) {
      context.beginPath();
      context.rect(x + from * size, foot - tall * size, (to - from) * size, tall * size);
      shape(fill);
      context.beginPath();
      context.moveTo(x + (from - 0.04) * size, foot - tall * size);
      context.lineTo(x + (from + to) / 2 * size, foot - peak * size);
      context.lineTo(x + (to + 0.04) * size, foot - tall * size);
      context.closePath();
      shape(roof);
    }
    context.beginPath();
    context.moveTo(x - 0.75 * size, foot - 0.48 * size);
    context.lineTo(x - 0.6 * size, foot - 0.8 * size);
    context.lineTo(x - 0.45 * size, foot - 0.48 * size);
    context.closePath();
    shape(getPaintRgb("GOLD"));
  } else if (icon === "university") {
    context.beginPath();
    context.rect(x - size * 0.55, foot - size * 0.6, size * 1.1, size * 0.6);
    shape(brick);
    context.beginPath();
    context.moveTo(x - size * 0.3, foot - size * 0.6);
    context.lineTo(x, foot - size * 0.85);
    context.lineTo(x + size * 0.3, foot - size * 0.6);
    context.closePath();
    shape(getPaintRgb("VIOLET"));
    context.beginPath();
    context.arc(x, foot - size * 0.92, size * 0.14, Math.PI, 0);
    context.closePath();
    shape(getPaintRgb("PINE_LIGHT"));
  } else {
    context.beginPath();
    context.rect(x - size * 0.42, foot - size * 0.5, size * 0.84, size * 0.5);
    shape(getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.45));
    context.beginPath();
    context.moveTo(x - size * 0.55, foot - size * 0.45);
    context.lineTo(x, foot - size * 0.95);
    context.lineTo(x + size * 0.55, foot - size * 0.45);
    context.closePath();
    shape(getMixedRgb(getPaintRgb("VIOLET"), getPaintRgb("ROCK_DARK"), 0.5));
  }
}

// ---------- Pins and you ----------

function setMapPins() {
  // A button for each place (its tag and title), under its building, out
  // on the lake (where it's clear of the sky and of you).
  mapPins.textContent = "";
  const range = getMapRange();
  const places = townState.places.slice().sort(function (a, b) {
    return a.x - b.x;
  });
  for (const place of places) {
    const item = getPlanetItem(place.item);
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "map-pin";
    pin.style.left = (getMapShare(place.x, range) * 100) + "%";
    pin.style.top = (getMapDown(BG.clearingFloor) * 100) + "%";
    pin.setAttribute("aria-label", "Fast travel to " + item.title);
    const tag = document.createElement("small");
    tag.textContent = item.tag;
    const title = document.createElement("span");
    title.textContent = item.title;
    pin.appendChild(tag);
    pin.appendChild(title);
    pin.addEventListener("click", function () {
      setMapTravel(place);
    });
    mapPins.appendChild(pin);
  }
}

function setMapYou() {
  // Where the orb is (the copy round the loop nearest the map's middle);
  // off the map, an arrow at the nearer edge.
  const range = getMapRange();
  const orb = getCentrePagePoint();
  const origin = getWorldOrigin();
  const x = getMapNearestX((origin.x + orb.x) / BG.zoom, (range.left + range.right) / 2);
  const y = (origin.y + orb.y) / BG.zoom;
  const share = getMapShare(x, range);
  const label = mapYou.querySelector(".map-you-label");
  mapYou.classList.toggle("is-off-left", share < 0);
  mapYou.classList.toggle("is-off-right", share > 1);
  label.textContent = share < 0 ? "← You" : share > 1 ? "You →" : "You";
  mapYou.style.left = (Math.min(1, Math.max(0, share)) * 100) + "%";
  mapYou.style.top = (getMapDown(y) * 100) + "%";
}

// ---------- Opening, closing and travelling ----------

function setMapShown(shown) {
  if (shown && (getIsPlainView() || getIsInsideBuilding())) {
    return;
  }
  mapBox.hidden = !shown;
  mapButton.setAttribute("aria-expanded", String(shown));
  if (shown) {
    if (typeof setContentsShown === "function") {
      setContentsShown(false);
    }
    mapBox.querySelector(".map-note").textContent = mapTouch.matches ? "Tap a place to fast travel there." : "Click a place to fast travel there.";
    setMapPins();
    setMapArt();
    setMapYou();
    const first = mapPins.querySelector(".map-pin");
    if (first) {
      first.focus({ preventScroll: true });
    }
  }
}

function setMapTravel(place) {
  // Fast travel: a flash, and the orb is at the place's door.
  setMapShown(false);
  const point = getPlaceWorldPoint(place);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    setOrbTeleported(point.x, point.y);
    return;
  }
  mapFlash.hidden = false;
  mapFlash.classList.remove("is-flashing");
  void mapFlash.offsetWidth;
  mapFlash.classList.add("is-flashing");
  setTimeout(function () {
    setOrbTeleported(point.x, point.y);
  }, MAP.flashTime / 2);
  setTimeout(function () {
    mapFlash.hidden = true;
  }, MAP.flashTime);
}

mapButton.addEventListener("click", function () {
  setMapShown(mapBox.hidden);
});
mapBox.querySelector(".map-close").addEventListener("click", function () {
  setMapShown(false);
  mapButton.focus({ preventScroll: true });
});
// A click on the dimmed backdrop (outside the card) closes it too.
mapBox.addEventListener("click", function (event) {
  if (event.target === mapBox) {
    setMapShown(false);
  }
});
// The map keeps its pointer events to itself, so the world underneath
// doesn't fly or ripple.
for (const type of ["pointerdown", "pointermove", "click", "wheel"]) {
  mapBox.addEventListener(type, function (event) {
    event.stopPropagation();
  }, { passive: type === "wheel" });
}

window.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && !mapBox.hidden) {
    setMapShown(false);
    mapButton.focus({ preventScroll: true });
    return;
  }
  if ((event.key === "m" || event.key === "M") && !event.repeat) {
    const target = event.target;
    if (target && target.closest && target.closest("input, textarea, select")) {
      return;
    }
    setMapShown(mapBox.hidden);
  }
});

window.addEventListener("resize", function () {
  if (!mapBox.hidden) {
    setMapArt();
    setMapYou();
  }
});
