// =============================================================================
// The places: each planet as a building in the world
// =============================================================================
// Every top-level item in .planet-list in index.html (the company, the
// university, About me) is a building in a clearing in the forest just
// above the lake shore, a little way apart along it (BG.clearings in
// background.js says where; the landscape leaves the clearings open):
//
//   company    - Trolley Hospitality as a mountain lodge: a gravel lot of
//                its box trucks, the timber garage they park in, the timber
//                and stone office lodge with a glowing glass gable, the log
//                kitchen with a stone chimney, the timber-frame barn of a
//                warehouse with its loading docks, and the gravel lot where
//                suppliers deliver and the trucks are loaded; lanterns, a
//                fire pit, and a road along the shore below
//   university - a brick college hall with a white columned porch, a
//                cupola with a clock, and purple and gold flags
//   about      - a log cabin with a stone chimney, a porch lantern, flower
//                boxes and a mailbox by the path
//
// Hover a building for its label; click or tap it to go inside, where
// office.js opens a little walk-around room with a station for each of the
// items listed under it (its moons). Flying the orb over a building pops up
// an invitation to go in: press Enter or E, or click or tap it. (sun.js
// passes the hover and click here; places.js lists the places and flies
// there.)
//
// Each is made to sit in the painting: drawn at the landscape's own low
// resolution (BG.swirlResolution) so its edges soften the same way, in the
// same palette (BG.paintColours) with flat lit and shaded faces and ink
// lines, lit from the same side as the trees, hazed like them, with pines
// painted the way the forest's are round its clearing and in front of it
// (over the building, so their tops show), and a path down to the shore.
// The light follows the painting's time of day there; at night the windows
// glow. Like everything else they come round again each trip round the loop.
//
// Each building has its own canvas on the page, in landscape px (the
// painting's own units), so it zooms with the world.
//
// Uses from background.js: BG, getWorldOrigin, getNearestLoopX, getDayAt,
// getHeightInDay, getHexColour, getIsPlainView, getIsInsideBuilding. From
// sun.js: getSunColour, getPlanetItem, getCentrePagePoint. From office.js:
// setOfficeOpen.
// =============================================================================

const TOWN = {
  size: 0.55,              // buildings are drawn at this scale (the trees set the scale)
  top: -320,               // the drawing's extent above and below each clearing's floor, landscape px
  bottom: 260,
  lightSide: 1,            // which side the light comes from (1 = right): the first scene's sun is to the right
  haze: 0.08,              // how much of the sky's colour hazes everything, like the trees
  ink: 5,                  // outline width, landscape px (about the painting's own ink line)
  pathWidth: 46,           // the path from each building's doors down to the shore, landscape px
  fps: 30,
  promptReach: 40,         // flying the orb this close to a building (page px) pops up the invitation to go in
  promptKeys: "Press Enter or click here to go inside",
  promptTouch: "Tap here to go inside",
  // Each place, by its item's data-icon: the sign, the hover label's second
  // line, the building's size for hovering (landscape px, before TOWN.size)
  // and the pines round its clearing's edges (x and foot y from the floor).
  places: {
    company: {
      label: "Step inside the office to see the projects",
      width: 2380,
      height: 480,
      frontGap: 680,         // no trees in front of all this: the yard runs down to a road on the shore
      door: -157,            // the office doors, landscape px from the middle (fast travel lands here)
      pines: [{ x: -738, y: -8, height: 175 }, { x: -700, y: 6, height: 140 }, { x: 702, y: 4, height: 150 }, { x: 740, y: -10, height: 180 }],
    },
    university: {
      name: "JMU",
      subName: "JAMES MADISON UNIVERSITY",
      label: "Step inside to see what I studied",
      width: 420,
      height: 520,
      pines: [{ x: -336, y: -6, height: 175 }, { x: -296, y: 6, height: 140 }, { x: 300, y: 4, height: 150 }, { x: 338, y: -10, height: 180 }],
    },
    about: {
      name: "ABOUT ME",
      subName: "",
      label: "Come in and say hello",
      width: 340,
      height: 400,
      pines: [{ x: -262, y: -8, height: 165 }, { x: -226, y: 6, height: 130 }, { x: 230, y: 4, height: 140 }, { x: 266, y: -6, height: 170 }],
    },
  },
};

const townMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const townPage = document.querySelector(".page");
const townTouch = window.matchMedia("(hover: none) and (pointer: coarse)");

// The invitation that pops up when the orb flies over a building.
const townPrompt = document.createElement("button");
townPrompt.type = "button";
townPrompt.className = "town-prompt";
townPrompt.hidden = true;
townPrompt.innerHTML = '<span class="town-prompt-tag"></span><span class="town-prompt-text"></span>';
document.body.appendChild(townPrompt);

const townState = {
  places: [],              // one per clearing: its settings, item, canvas and so on (setTownPlaces)
  hovered: null,           // the place the pointer is over
  promptPlace: null,       // the place the invitation is up for
  lastFrame: 0,
  // While drawing a place: its lit windows (for the night glow) and this
  // frame's light, shade and haze colours (from the time of day there).
  windows: [],
  light: [255, 201, 77],
  shade: [77, 43, 125],
  haze: [255, 201, 77],
  mood: { sunset: 1, night: 0, dawn: 0 },
  canvas: null,
  startTime: performance.now(),
};

// ---------- The places ----------

function getTownItemIndex(icon) {
  // The .planet-list item a place is: the first top-level item with this icon.
  const items = document.querySelectorAll(".planet-list > li");
  for (let i = 0; i < items.length; i++) {
    if (items[i].dataset.icon === icon && items[i].dataset.kind !== "moon") {
      return i;
    }
  }
  return -1;
}

function setTownPlaces() {
  // A place for each clearing whose item is in the list.
  const before = document.querySelector(".sun-layer");
  for (const clearing of BG.clearings) {
    const settings = TOWN.places[clearing.place];
    const item = getTownItemIndex(clearing.place);
    if (!settings || item < 0) {
      continue;
    }
    const canvas = document.createElement("canvas");
    canvas.className = "town-layer";
    canvas.setAttribute("aria-hidden", "true");
    townPage.insertBefore(canvas, before);
    townState.places.push(Object.assign({}, settings, {
      icon: clearing.place,
      item: item,
      x: clearing.x,
      halfWidth: clearing.halfWidth,
      frontHalfWidth: clearing.frontHalfWidth,
      frontGap: settings.frontGap || 0,
      door: settings.door || 0,
      left: -clearing.halfWidth - 40,
      right: clearing.halfWidth + 40,
      canvas: canvas,
      context: canvas.getContext("2d"),
      zoom: null,
      ratio: null,
      frontPines: null,
    }));
  }
}

function getPlaceByItem(item) {
  for (const place of townState.places) {
    if (place.item === item) {
      return place;
    }
  }
  return null;
}

function getPlaceByIcon(icon) {
  for (const place of townState.places) {
    if (place.icon === icon) {
      return place;
    }
  }
  return null;
}

function getTownBase(place) {
  // Page px of a building's foot in its clearing (the nearest copy round
  // the loop), and page px per landscape px.
  const origin = getWorldOrigin();
  const scale = BG.zoom;
  const pageBox = townPage.getBoundingClientRect();
  const middle = origin.x + window.innerWidth / 2 - pageBox.left;
  const worldX = getNearestLoopX(place.x * scale, middle);
  return {
    x: worldX - origin.x,
    y: BG.clearingFloor * scale - origin.y,
    scale: scale,
  };
}

function getPlaceWorldPoint(place) {
  // World px of a building's doorstep, the copy nearest a world x (for
  // flying there: places.js).
  return { x: (place.x + (place.door || 0)) * BG.zoom, y: (BG.clearingFloor - 40) * BG.zoom };
}

function getTownBuildingBox(place) {
  // A building's box on the screen (client px).
  const base = getTownBase(place);
  const pageBox = townPage.getBoundingClientRect();
  const half = place.width / 2 * TOWN.size * base.scale;
  const left = pageBox.left + base.x - half;
  const bottom = pageBox.top + base.y;
  return { left: left, right: left + half * 2, top: bottom - place.height * TOWN.size * base.scale, bottom: bottom };
}

function getTownBuildingAt(clientX, clientY) {
  // Used by sun.js: the .planet-list index of the building under this
  // point, or null.
  if (getIsPlainView()) {
    return null;
  }
  for (const place of townState.places) {
    if (place.canvas.hidden) {
      continue;
    }
    const box = getTownBuildingBox(place);
    if (clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom) {
      return place.item;
    }
  }
  return null;
}

function getTownBuildingPoint(item) {
  // Used by sun.js to place a building's label: a point just above its roof.
  const place = getPlaceByItem(item);
  if (!place) {
    return null;
  }
  const box = getTownBuildingBox(place);
  return { x: (box.left + box.right) / 2, y: box.top + 10, size: 0 };
}

function setTownHovered(item) {
  // Used by sun.js: which building the pointer is over (by item), or null.
  townState.hovered = item === null ? null : getPlaceByItem(item);
}

function getTownLabel(item) {
  // Used by sun.js: the hover label's second line for a building.
  const place = getPlaceByItem(item);
  return place ? place.label : null;
}

function setPlaceEntered(item) {
  // Goes inside a place (sun.js, on a click or tap; the invitation).
  const place = getPlaceByItem(item);
  townPrompt.hidden = true;
  townState.promptPlace = null;
  if (place && typeof setOfficeOpen === "function") {
    setOfficeOpen(place.icon);
  } else if (typeof setPanelShown === "function") {
    setPanelShown(item);
  }
}

function getPlaceMood(icon) {
  // Used by office.js: the time of day at a place, for the light inside.
  const place = getPlaceByIcon(icon);
  if (!place) {
    return { sunset: 1, night: 0, dawn: 0 };
  }
  return getTownMood(getTownBase(place).x);
}

// ---------- Drawing helpers ----------

const TOWN_PAINT = {
  SPACE: 0, INDIGO: 1, VIOLET: 2, MAGENTA: 3, ORANGE: 4, GOLD: 5, NIGHT_BLUE: 6, GLOW: 7,
  PASTEL_PINK: 8, PASTEL_MINT: 9, SNOW: 10, SNOW_PINK: 11, ROCK: 12, ROCK_DARK: 13,
  PINE: 14, PINE_LIGHT: 15, INK: 16,
};

function getPaintRgb(name) {
  // A colour from the painting's palette (BG.paintColours), as [r, g, b].
  return getHexColour(BG.paintColours[TOWN_PAINT[name]]);
}

function getMixedRgb(a, b, amount) {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount];
}

function getRgbText(rgb, alpha) {
  return "rgba(" + Math.round(rgb[0]) + ", " + Math.round(rgb[1]) + ", " + Math.round(rgb[2]) + ", " + (alpha === undefined ? 1 : alpha) + ")";
}

function getTownMood(pageX) {
  // How much sunset, night and dawn there is at a spot, as the terrain
  // shader's getMood works it out, so the building is lit like the hills.
  if (typeof getDayAt !== "function") {
    return { sunset: 1, night: 0, dawn: 0 };
  }
  const day = getDayAt(pageX);
  const height = getHeightInDay(day, BG.dayShare);
  const n = Math.min(1, Math.max(0, (0.25 - height) / 0.8));
  const night = n * n * (3 - 2 * n);
  let fromMidnight = day - BG.dayShare - (1 - BG.dayShare) / 2;
  fromMidnight = fromMidnight - Math.floor(fromMidnight);
  const m = Math.min(1, Math.max(0, (0.7 - fromMidnight) / 0.4));
  const morning = m * m * (3 - 2 * m);
  return { sunset: (1 - night) * (1 - morning), night: night, dawn: (1 - night) * morning };
}

function getMoodRgb(mood, sunset, night, dawn) {
  const a = getPaintRgb(sunset);
  const b = getPaintRgb(night);
  const c = getPaintRgb(dawn);
  return [
    a[0] * mood.sunset + b[0] * mood.night + c[0] * mood.dawn,
    a[1] * mood.sunset + b[1] * mood.night + c[1] * mood.dawn,
    a[2] * mood.sunset + b[2] * mood.night + c[2] * mood.dawn,
  ];
}

function setCelBox(context, x, y, width, height, base, options) {
  // A box painted like the landscape: a flat lit face, a shaded band down
  // the side away from the light, a bright rim along the top, inked edges.
  const light = townState.light;
  const shade = townState.shade;
  const lit = getMixedRgb(base, light, 0.22);
  context.beginPath();
  if (options && options.round) {
    context.roundRect(x, y, width, height, options.round);
  } else {
    context.rect(x, y, width, height);
  }
  context.fillStyle = getRgbText(lit);
  context.fill();
  context.save();
  context.clip();
  // The shaded band is on the side away from the light (TOWN.lightSide).
  const band = width * (options && options.shadeShare !== undefined ? options.shadeShare : 0.3);
  const bandX = TOWN.lightSide > 0 ? x : x + width - band;
  const edgeX = TOWN.lightSide > 0 ? x + band : x + width - band;
  context.fillStyle = getRgbText(getMixedRgb(base, shade, 0.55));
  context.fillRect(bandX, y, band, height);
  context.fillStyle = getRgbText(getMixedRgb(base, light, 0.55));
  context.fillRect(x, y, width, Math.min(8, height * 0.15));
  context.beginPath();
  context.moveTo(edgeX, y);
  context.lineTo(edgeX, y + height);
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"), 0.6);
  context.stroke();
  context.restore();
  context.lineWidth = TOWN.ink;
  context.lineJoin = "round";
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
}

function setTownShape(context, fill) {
  // Fills the current path and outlines it in ink.
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  context.lineWidth = TOWN.ink;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
}

function setTownWindow(context, x, y, width, height) {
  // A window: glass catching the sky's colour, remembered so it can glow
  // at night.
  context.beginPath();
  context.moveTo(x, y + height);
  context.lineTo(x, y + width / 2);
  context.arc(x + width / 2, y + width / 2, width / 2, Math.PI, 0);
  context.lineTo(x + width, y + height);
  context.closePath();
  setTownShape(context, getRgbText(getMixedRgb(getPaintRgb("NIGHT_BLUE"), townState.light, 0.35)));
  context.beginPath();
  context.moveTo(x + width / 2, y);
  context.lineTo(x + width / 2, y + height);
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  const matrix = context.getTransform();
  townState.windows.push({ matrix: matrix, x: x, y: y, width: width, height: height });
}

// ---------- The buildings (each drawn round its own foot, y up = negative) ----------

function setTownPane(context, x, y, width, height) {
  // A plain rectangular window, glass catching the sky's colour,
  // remembered so it can glow at night.
  context.beginPath();
  context.rect(x, y, width, height);
  setTownShape(context, getRgbText(getMixedRgb(getPaintRgb("NIGHT_BLUE"), townState.light, 0.35)));
  context.beginPath();
  context.moveTo(x, y + height * 0.5);
  context.lineTo(x + width, y + height * 0.5);
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  townState.windows.push({ matrix: context.getTransform(), x: x, y: y, width: width, height: height });
}

function setTownLot(context, left, right) {
  // A gravel lot, edged with timber.
  setCelBox(context, left, -14, right - left, 18, getMixedRgb(getPaintRgb("ROCK"), getPaintRgb("ORANGE"), 0.2), { shadeShare: 0 });
  context.fillStyle = getRgbText(getPaintRgb("INK"), 0.3);
  for (let x = left + 8; x < right - 4; x += 13) {
    context.fillRect(x, -9 + ((x * 7) % 9), 3, 3);
  }
  setCelBox(context, left - 6, -16, 12, 20, getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.6), { shadeShare: 0 });
  setCelBox(context, right - 6, -16, 12, 20, getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.6), { shadeShare: 0 });
}

function setTownWheel(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  setTownShape(context, getRgbText(getPaintRgb("ROCK_DARK")));
  context.beginPath();
  context.arc(x, y, radius * 0.4, 0, Math.PI * 2);
  setTownShape(context, getRgbText(getPaintRgb("ROCK")));
}

function setTownBoxTruck(context, x, facing, blink) {
  // One of the company's box trucks (its foot at y = 0, x its middle),
  // cream with a green stripe, cab towards 'facing' (1 = right).
  context.save();
  context.translate(x, 0);
  context.scale(facing, 1);
  const cream = getMixedRgb(getPaintRgb("SNOW"), getPaintRgb("GOLD"), 0.25);
  setCelBox(context, -95, -128, 135, 104, cream, { round: 6, shadeShare: 0.15 });
  setCelBox(context, -95, -78, 135, 14, getPaintRgb("PINE_LIGHT"), { shadeShare: 0 });
  context.beginPath();
  context.moveTo(42, -24);
  context.lineTo(42, -96);
  context.lineTo(74, -96);
  context.quadraticCurveTo(96, -94, 98, -64);
  context.lineTo(98, -24);
  context.closePath();
  setTownShape(context, getRgbText(getMixedRgb(getPaintRgb("PINE_LIGHT"), townState.light, 0.15)));
  setTownPane(context, 58, -88, 32, 26);
  if (blink) {
    context.beginPath();
    context.arc(-92, -30, 6, 0, Math.PI * 2);
    context.fillStyle = getRgbText(getPaintRgb("GOLD"));
    context.fill();
  }
  setTownWheel(context, -60, -16, 16);
  setTownWheel(context, 70, -16, 16);
  context.restore();
}

function setTownSemi(context, x, facing) {
  // A supplier's semi: a long grey trailer and a red tractor unit.
  context.save();
  context.translate(x, 0);
  context.scale(facing, 1);
  setCelBox(context, -200, -150, 270, 124, getMixedRgb(getPaintRgb("ROCK"), getPaintRgb("SNOW"), 0.35), { round: 4, shadeShare: 0.12 });
  context.beginPath();
  for (let rib = -170; rib < 70; rib += 30) {
    context.moveTo(rib, -146);
    context.lineTo(rib, -30);
  }
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"), 0.3);
  context.stroke();
  context.beginPath();
  context.moveTo(78, -26);
  context.lineTo(78, -110);
  context.lineTo(118, -118);
  context.quadraticCurveTo(146, -116, 150, -80);
  context.lineTo(150, -26);
  context.closePath();
  setTownShape(context, getRgbText(getMixedRgb(getPaintRgb("MAGENTA"), townState.light, 0.15)));
  setTownPane(context, 100, -106, 36, 30);
  setCelBox(context, 70, -132, 10, 70, getPaintRgb("ROCK_DARK"), { shadeShare: 0 });
  setTownWheel(context, -170, -16, 16);
  setTownWheel(context, -134, -16, 16);
  setTownWheel(context, 96, -16, 16);
  setTownWheel(context, 132, -16, 16);
  context.restore();
}

function setTownForklift(context, x, facing) {
  // A little forklift carrying a pallet of boxes.
  context.save();
  context.translate(x, 0);
  context.scale(facing, 1);
  setCelBox(context, -30, -54, 46, 40, getPaintRgb("GOLD"), { round: 6, shadeShare: 0.2 });
  context.beginPath();
  context.moveTo(-26, -54);
  context.lineTo(-26, -86);
  context.lineTo(8, -86);
  context.lineTo(8, -54);
  context.lineWidth = 4;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  context.beginPath();
  context.moveTo(20, -14);
  context.lineTo(20, -96);
  context.stroke();
  setCelBox(context, 22, -50, 40, 34, getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.3), { shadeShare: 0.2 });
  setTownWheel(context, -18, -12, 10);
  setTownWheel(context, 10, -12, 10);
  context.restore();
}

function setTownBoards(context, x, y, width, height, step, vertical, alpha) {
  // Plank lines across (or down) a wall, clipped to it.
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.beginPath();
  if (vertical) {
    for (let bx = x + step; bx < x + width; bx += step) {
      context.moveTo(bx, y);
      context.lineTo(bx, y + height);
    }
  } else {
    for (let by = y + step; by < y + height; by += step) {
      context.moveTo(x, by);
      context.lineTo(x + width, by);
    }
  }
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"), alpha || 0.35);
  context.stroke();
  context.restore();
}

function setTownStones(context, x, y, width, height, stone) {
  // A stone wall: rounded stones in staggered rows.
  setCelBox(context, x, y, width, height, getMixedRgb(stone, getPaintRgb("ROCK_DARK"), 0.25), { shadeShare: 0.2 });
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  const size = 22;
  for (let row = 0; row * size * 0.8 < height + size; row++) {
    const offset = row % 2 === 0 ? 0 : size * 0.55;
    for (let sx = x - size + offset; sx < x + width + size; sx += size * 1.1) {
      context.beginPath();
      context.ellipse(sx, y + row * size * 0.8 + size * 0.4, size * 0.5, size * 0.36, 0, 0, Math.PI * 2);
      context.fillStyle = getRgbText(getMixedRgb(stone, townState.light, 0.12 + ((row + Math.round(sx)) % 3) * 0.06));
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = getRgbText(getPaintRgb("INK"), 0.55);
      context.stroke();
    }
  }
  context.restore();
  context.beginPath();
  context.rect(x, y, width, height);
  context.lineWidth = TOWN.ink;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
}

function setTownGable(context, left, right, eaves, peak, fill) {
  // A steep roof with deep eaves, shingle lines and a ridge beam.
  const overhang = 22;
  context.beginPath();
  context.moveTo(left - overhang, eaves + 12);
  context.lineTo((left + right) / 2, peak);
  context.lineTo(right + overhang, eaves + 12);
  context.lineTo(right + overhang - 10, eaves + 22);
  context.lineTo((left + right) / 2, peak + 18);
  context.lineTo(left - overhang + 10, eaves + 22);
  context.closePath();
  setTownShape(context, getRgbText(getMixedRgb(fill, townState.light, 0.12)));
}

function setTownLantern(context, x, y, seconds) {
  // A lantern on a timber post, glowing at night.
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, y + 18);
  context.lineWidth = 7;
  context.strokeStyle = getRgbText(getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.7));
  context.stroke();
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  const flicker = townMotion.matches ? 0 : Math.sin(seconds * 7 + x) * 0.08;
  setCelBox(context, x - 10, y - 4, 20, 24, getMixedRgb(getPaintRgb("GOLD"), getPaintRgb("ORANGE"), 0.2 + flicker), { round: 4, shadeShare: 0 });
  context.beginPath();
  context.moveTo(x - 13, y - 4);
  context.lineTo(x, y - 14);
  context.lineTo(x + 13, y - 4);
  context.closePath();
  setTownShape(context, getRgbText(getPaintRgb("ROCK_DARK")));
  townState.windows.push({ matrix: context.getTransform(), x: x - 10, y: y - 4, width: 20, height: 24 });
}

function setTownFirePit(context, x, seconds) {
  // A ring of stones with a fire, and two log benches.
  const wood = getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.5);
  for (const bx of [x - 78, x + 48]) {
    setCelBox(context, bx, -22, 30, 22, wood, { round: 8, shadeShare: 0.3 });
  }
  const flicker = townMotion.matches ? 0 : Math.sin(seconds * 9) * 4;
  context.beginPath();
  context.moveTo(x - 20, -12);
  context.quadraticCurveTo(x - 10, -40 - flicker, x, -54 + flicker);
  context.quadraticCurveTo(x + 10, -40 + flicker, x + 20, -12);
  context.closePath();
  context.fillStyle = getRgbText(getPaintRgb("ORANGE"));
  context.fill();
  context.beginPath();
  context.ellipse(x, -20, 8, 14 + flicker * 0.5, 0, 0, Math.PI * 2);
  context.fillStyle = getRgbText(getPaintRgb("GOLD"));
  context.fill();
  townState.windows.push({ matrix: context.getTransform(), x: x - 16, y: -44, width: 32, height: 32 });
  setCelBox(context, x - 34, -14, 68, 14, getMixedRgb(getPaintRgb("ROCK"), getPaintRgb("SNOW"), 0.25), { round: 7, shadeShare: 0 });
}

function setTownCompany(context, seconds, place) {
  // The company's place as a mountain lodge, left to right: a gravel lot
  // of its box trucks, the timber garage they park in, the timber and
  // stone office lodge with its glowing glass gable, the log kitchen with
  // its stone chimney, the timber-frame barn of a warehouse with its
  // loading docks, and the gravel lot where suppliers deliver and the
  // trucks are loaded; lanterns along the front and a fire pit by the
  // office. (Each drawn round the place's foot, in the building's own
  // units: TOWN.size scales them.)
  const still = townMotion.matches;
  const wood = getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.45);
  const darkWood = getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.68);
  const stone = getMixedRgb(getPaintRgb("ROCK"), getPaintRgb("SNOW"), 0.3);
  const roof = getMixedRgb(getPaintRgb("VIOLET"), getPaintRgb("ROCK_DARK"), 0.55);
  const glass = getMixedRgb(getPaintRgb("GOLD"), townState.light, 0.2);

  // Gravel lots first (the trucks stand on them).
  setTownLot(context, -1160, -760);
  setTownLot(context, 720, 1200);

  // The warehouse: a big timber-frame barn with three loading docks.
  setCelBox(context, 210, -300, 510, 300, darkWood);
  setTownBoards(context, 210, -300, 510, 300, 18, true, 0.3);
  context.beginPath();
  for (const bx of [210, 380, 550, 720]) {
    context.moveTo(bx, -300);
    context.lineTo(bx, -60);
  }
  context.moveTo(210, -230);
  context.lineTo(720, -230);
  context.moveTo(210, -300);
  context.lineTo(380, -230);
  context.moveTo(550, -230);
  context.lineTo(720, -300);
  context.lineWidth = 9;
  context.strokeStyle = getRgbText(getMixedRgb(wood, townState.light, 0.2));
  context.stroke();
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"), 0.7);
  context.stroke();
  setTownGable(context, 210, 720, -300, -400, roof);
  setTownPane(context, 440, -350, 50, 30);
  setTownStones(context, 210, -60, 510, 60, stone);
  for (const x of [240, 400, 560]) {
    setCelBox(context, x, -200, 130, 140, wood, { shadeShare: 0.15 });
    setTownBoards(context, x, -200, 130, 140, 16, true, 0.4);
    context.beginPath();
    context.moveTo(x, -200);
    context.lineTo(x + 130, -60);
    context.moveTo(x + 130, -200);
    context.lineTo(x, -60);
    context.lineWidth = 3;
    context.strokeStyle = getRgbText(getPaintRgb("INK"), 0.5);
    context.stroke();
  }

  // The kitchen: log walls, a stone chimney puffing smoke, warm windows,
  // and a back door with a little awning.
  setTownStones(context, 120, -330, 56, 120, stone);
  if (!still) {
    for (let k = 0; k < 4; k++) {
      const life = (seconds * 0.3 + k / 4) % 1;
      context.beginPath();
      context.arc(148 + Math.sin(life * 5 + k) * 10 + life * 24, -344 - life * 110, 10 + life * 16, 0, Math.PI * 2);
      context.fillStyle = getRgbText(getMixedRgb(getPaintRgb("SNOW"), townState.shade, 0.3), 0.5 * (1 - life));
      context.fill();
    }
  }
  setCelBox(context, -80, -210, 290, 210, wood);
  setTownBoards(context, -80, -210, 290, 210, 21, false, 0.45);
  for (let y = -200; y < 0; y += 21) {
    for (const lx of [-80, 210]) {
      context.beginPath();
      context.arc(lx, y, 9, 0, Math.PI * 2);
      setTownShape(context, getRgbText(getMixedRgb(wood, getPaintRgb("GOLD"), 0.25)));
    }
  }
  setTownGable(context, -80, 210, -210, -290, roof);
  setTownPane(context, -50, -160, 60, 54);
  setTownPane(context, 20, -160, 60, 54);
  setCelBox(context, 110, -130, 66, 130, darkWood, { round: 4, shadeShare: 0.25 });
  setCelBox(context, 100, -146, 86, 16, getPaintRgb("PINE_LIGHT"), { round: 4, shadeShare: 0 });

  // The office lodge: a stone ground floor, timber above, a steep roof
  // with deep eaves and a tall glass gable glowing in the middle, a timber
  // porch over the doors.
  setTownStones(context, -490, -120, 410, 120, stone);
  setCelBox(context, -490, -260, 410, 140, wood);
  setTownBoards(context, -490, -260, 410, 140, 20, false, 0.4);
  setTownGable(context, -490, -80, -260, -460, roof);
  // The glass gable: a tall triangle of warm windows under the roof.
  context.beginPath();
  context.moveTo(-395, -262);
  context.lineTo(-285, -420);
  context.lineTo(-175, -262);
  context.closePath();
  setTownShape(context, getRgbText(glass));
  context.beginPath();
  context.moveTo(-285, -420);
  context.lineTo(-285, -262);
  for (const y of [-300, -340, -380]) {
    const spread = (y + 420) * (110 / 158);
    context.moveTo(-285 - spread, y);
    context.lineTo(-285 + spread, y);
  }
  context.moveTo(-340, -262);
  context.lineTo(-322, -368);
  context.moveTo(-230, -262);
  context.lineTo(-248, -368);
  context.lineWidth = 3;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  townState.windows.push({ matrix: context.getTransform(), triangle: [[-395, -262], [-285, -420], [-175, -262]] });
  for (const x of [-470, -420, -150, -110]) {
    setTownPane(context, x, -240, 34, 50);
  }
  for (const x of [-470, -420, -150, -110]) {
    setTownPane(context, x, -100, 34, 46);
  }
  // Porch: posts, a little roof, and the doors.
  setCelBox(context, -318, -118, 66, 118, glass, { shadeShare: 0.2 });
  context.beginPath();
  context.moveTo(-285, -118);
  context.lineTo(-285, 0);
  context.lineWidth = 3;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  for (const px of [-352, -224]) {
    setCelBox(context, px, -150, 14, 150, darkWood, { shadeShare: 0.4 });
  }
  context.beginPath();
  context.moveTo(-372, -146);
  context.lineTo(-285, -186);
  context.lineTo(-198, -146);
  context.closePath();
  setTownShape(context, getRgbText(getMixedRgb(roof, townState.light, 0.12)));

  // The garage: a timber shed with three bays, one door rolling up and down.
  setCelBox(context, -760, -230, 270, 230, darkWood);
  setTownBoards(context, -760, -230, 270, 230, 18, true, 0.3);
  setTownGable(context, -760, -490, -230, -300, roof);
  for (const [i, x] of [-740, -655, -570].entries()) {
    const open = i === 1 ? (still ? 0.6 : 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(seconds * 0.5))) : 0;
    setCelBox(context, x, -170, 74, 170, getPaintRgb("ROCK_DARK"), { shadeShare: 0 });
    const doorBottom = -170 + 170 * (1 - open);
    setCelBox(context, x, -170, 74, Math.max(8, doorBottom + 170), wood, { shadeShare: 0.12 });
    setTownBoards(context, x, -170, 74, Math.max(8, doorBottom + 170), 14, false, 0.4);
  }

  // Lanterns along the front, and a fire pit by the office.
  for (const x of [-500, -60, 200]) {
    setTownLantern(context, x, -96, seconds);
  }
  setTownFirePit(context, -130, seconds);

  // Trucks: ours parked in their lot, one at the first dock being loaded;
  // a supplier's semi backed up to the last dock and another parked; a
  // forklift shuttling pallets between them.
  setTownBoxTruck(context, -1050, 1, false);
  setTownBoxTruck(context, -870, 1, false);
  setTownBoxTruck(context, 305, -1, !still && Math.floor(seconds * 2) % 2 === 0);
  setTownSemi(context, 650, 1);
  setTownSemi(context, 1020, 1);
  const shuttle = still ? 0.5 : 0.5 + 0.5 * Math.sin(seconds * 0.7);
  setTownForklift(context, 470 + shuttle * 120, Math.cos(seconds * 0.7) >= 0 ? 1 : -1);
}

function setTownPine(context, x, footY, height) {
  // A pine as the forest paints them: three jagged tiers, dark, with a lit
  // edge on the side the light comes from, outlined in ink.
  const spacing = BG.treeSpacing;
  const points = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const tier = (t * 3 + 0.15) % 1;
    let half = spacing * 0.62 * (1 - t) * (0.5 + 0.5 * (1 - tier));
    if (t < 0.08) {
      half = spacing * 0.07;   // the trunk
    }
    points.push({ up: t * height, half: half });
  }
  const tracePine = function () {
    context.beginPath();
    context.moveTo(x - points[0].half, footY);
    for (const point of points) {
      context.lineTo(x + point.half, footY - point.up);
    }
    for (let i = points.length - 1; i >= 0; i--) {
      context.lineTo(x - points[i].half, footY - points[i].up);
    }
    context.closePath();
  };
  const mood = townState.mood;
  const haze = townState.haze;
  const lightTint = getMixedRgb(getPaintRgb("PINE_LIGHT"), getMoodRgb(mood, "ORANGE", "GLOW", "PASTEL_MINT"), 0.37);
  const dark = getMixedRgb(getPaintRgb("PINE"), haze, 0.06);
  tracePine();
  context.fillStyle = getRgbText(dark);
  context.fill();
  // The lit edge: the outer part of each tier on the light's side (from
  // 30% of the way out, as the forest's trees are lit).
  const side = TOWN.lightSide > 0 ? 1 : -1;
  context.beginPath();
  context.moveTo(x + side * points[0].half * 0.3, footY);
  for (const point of points) {
    context.lineTo(x + side * point.half * 0.3, footY - point.up);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    context.lineTo(x + side * points[i].half, footY - points[i].up);
  }
  context.closePath();
  context.fillStyle = getRgbText(getMixedRgb(dark, lightTint, 0.55));
  context.fill();
  tracePine();
  context.lineWidth = TOWN.ink;
  context.lineJoin = "round";
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
}

function setTownHall(context, seconds, place) {
  // A brick college hall: a white porch of columns under a violet
  // pediment with the initials in gold, a cupola with a clock and a dome,
  // purple and gold flags, and a lamp post either side.
  const brick = getMixedRgb(getPaintRgb("MAGENTA"), getPaintRgb("ORANGE"), 0.4);
  const white = getMixedRgb(getPaintRgb("SNOW"), getPaintRgb("GOLD"), 0.15);
  const violet = getPaintRgb("VIOLET");
  setCelBox(context, -210, -40, 420, 40, getMixedRgb(getPaintRgb("ROCK"), white, 0.35));
  setCelBox(context, -195, -270, 390, 230, brick);
  context.save();
  context.beginPath();
  context.rect(-195, -270, 390, 230);
  context.clip();
  context.beginPath();
  for (let y = -252; y < -40; y += 18) {
    context.moveTo(-195, y);
    context.lineTo(195, y);
  }
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"), 0.25);
  context.stroke();
  context.restore();
  for (const x of [-180, -140, 108, 148]) {
    setTownWindow(context, x, -245, 32, 60);
    setTownWindow(context, x, -150, 32, 60);
  }
  // The door, behind the columns.
  context.beginPath();
  context.moveTo(-26, -40);
  context.lineTo(-26, -112);
  context.arc(0, -112, 26, Math.PI, 0);
  context.lineTo(26, -40);
  setTownShape(context, getRgbText(getMixedRgb(getPaintRgb("ROCK_DARK"), townState.light, 0.15)));
  townState.windows.push({ matrix: context.getTransform(), x: -18, y: -128, width: 36, height: 20 });
  // The porch: steps, columns, the beam and the pediment.
  setCelBox(context, -112, -52, 224, 12, white, { shadeShare: 0.1 });
  for (const x of [-96, -56, 40, 80]) {
    setCelBox(context, x, -238, 16, 186, white, { shadeShare: 0.45 });
  }
  setCelBox(context, -118, -258, 236, 20, white, { shadeShare: 0.12 });
  context.beginPath();
  context.moveTo(-126, -258);
  context.lineTo(0, -330);
  context.lineTo(126, -258);
  context.closePath();
  setTownShape(context, getRgbText(getMixedRgb(violet, townState.light, 0.15)));
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 38px 'Space Grotesk', sans-serif";
  context.fillStyle = getRgbText(getPaintRgb("GOLD"));
  context.fillText(place.name, 0, -282, 120);
  // Cupola, clock and dome.
  setCelBox(context, -40, -400, 80, 70, white, { shadeShare: 0.3 });
  context.beginPath();
  context.arc(0, -366, 20, 0, Math.PI * 2);
  setTownShape(context, getRgbText(getPaintRgb("SNOW")));
  const turn = townMotion.matches ? 0.8 : seconds * 0.3;
  context.beginPath();
  context.moveTo(0, -366);
  context.lineTo(Math.sin(turn) * 14, -366 - Math.cos(turn) * 14);
  context.moveTo(0, -366);
  context.lineTo(Math.sin(turn / 12) * 9, -366 - Math.cos(turn / 12) * 9);
  context.lineWidth = 3;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  context.beginPath();
  context.moveTo(-48, -400);
  context.arc(0, -400, 48, Math.PI, 0);
  context.closePath();
  setTownShape(context, getRgbText(getMixedRgb(getPaintRgb("PINE_LIGHT"), townState.shade, 0.3)));
  context.beginPath();
  context.moveTo(0, -448);
  context.lineTo(0, -480);
  context.lineWidth = 4;
  context.stroke();
  // Flags on the corners, purple and gold.
  const wave = townMotion.matches ? 0 : Math.sin(seconds * 4) * 6;
  for (const [x, colour] of [[-195, "VIOLET"], [195, "GOLD"]]) {
    context.beginPath();
    context.moveTo(x, -270);
    context.lineTo(x, -340);
    context.lineWidth = 4;
    context.strokeStyle = getRgbText(getPaintRgb("INK"));
    context.stroke();
    const out = x < 0 ? -1 : 1;
    context.beginPath();
    context.moveTo(x, -338);
    context.quadraticCurveTo(x + out * 18, -338 + wave, x + out * 36, -333);
    context.lineTo(x + out * 36, -315);
    context.quadraticCurveTo(x + out * 18, -320 + wave, x, -318);
    context.closePath();
    setTownShape(context, getRgbText(getMixedRgb(getPaintRgb(colour), townState.light, 0.15)));
  }
  // Lamp posts.
  for (const x of [-250, 250]) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, -110);
    context.lineWidth = 6;
    context.strokeStyle = getRgbText(getPaintRgb("INK"));
    context.stroke();
    context.beginPath();
    context.arc(x, -120, 12, 0, Math.PI * 2);
    setTownShape(context, getRgbText(getPaintRgb("GOLD")));
    townState.windows.push({ matrix: context.getTransform(), x: x - 10, y: -130, width: 20, height: 20 });
  }
}

function setTownCabin(context, seconds, place) {
  // A log cabin: stacked logs, a steep shingled roof, a stone chimney with
  // smoke, a porch with a lantern, flower boxes, a hanging sign, and a
  // mailbox by the path.
  const wood = getMixedRgb(getPaintRgb("ORANGE"), getPaintRgb("ROCK_DARK"), 0.45);
  const stone = getMixedRgb(getPaintRgb("ROCK"), getPaintRgb("SNOW"), 0.25);
  // Chimney (behind the roof) and its smoke.
  setCelBox(context, 70, -330, 50, 180, stone, { shadeShare: 0.35 });
  if (!townMotion.matches) {
    for (let k = 0; k < 4; k++) {
      const life = (seconds * 0.25 + k / 4) % 1;
      context.beginPath();
      context.arc(95 + Math.sin(life * 6 + k) * 10 + life * 30, -340 - life * 120, 10 + life * 16, 0, Math.PI * 2);
      context.fillStyle = getRgbText(getMixedRgb(getPaintRgb("SNOW"), townState.shade, 0.3), 0.55 * (1 - life));
      context.fill();
    }
  }
  // Log walls.
  setCelBox(context, -150, -190, 300, 190, wood);
  context.save();
  context.beginPath();
  context.rect(-150, -190, 300, 190);
  context.clip();
  context.beginPath();
  for (let y = -170; y < 0; y += 22) {
    context.moveTo(-150, y);
    context.lineTo(150, y);
  }
  context.lineWidth = 3;
  context.strokeStyle = getRgbText(getPaintRgb("INK"), 0.45);
  context.stroke();
  context.restore();
  for (let y = -179; y < 0; y += 22) {
    for (const x of [-150, 150]) {
      context.beginPath();
      context.arc(x, y, 10, 0, Math.PI * 2);
      setTownShape(context, getRgbText(getMixedRgb(wood, getPaintRgb("GOLD"), 0.25)));
    }
  }
  // Windows with flower boxes.
  for (const x of [-120, 70]) {
    setTownWindow(context, x, -150, 50, 56);
    setCelBox(context, x - 6, -94, 62, 14, getMixedRgb(wood, getPaintRgb("INK"), 0.2), { shadeShare: 0.2 });
    for (let f = 0; f < 4; f++) {
      context.beginPath();
      context.arc(x + 4 + f * 14, -98, 6, 0, Math.PI * 2);
      setTownShape(context, getRgbText(getPaintRgb(f % 2 === 0 ? "MAGENTA" : "GOLD")));
    }
  }
  // Door with a round window.
  setCelBox(context, -26, -120, 52, 120, getMixedRgb(wood, getPaintRgb("INK"), 0.3), { round: 6, shadeShare: 0.25 });
  setTownWindow(context, -12, -104, 24, 24);
  // Roof.
  context.beginPath();
  context.moveTo(-180, -180);
  context.lineTo(0, -320);
  context.lineTo(180, -180);
  context.closePath();
  setTownShape(context, getRgbText(getMixedRgb(getPaintRgb("VIOLET"), getPaintRgb("ROCK_DARK"), 0.5)));
  context.save();
  context.beginPath();
  context.moveTo(-180, -180);
  context.lineTo(0, -320);
  context.lineTo(180, -180);
  context.closePath();
  context.clip();
  context.beginPath();
  for (let y = -300; y < -180; y += 20) {
    context.moveTo(-200, y);
    context.lineTo(200, y);
  }
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"), 0.35);
  context.stroke();
  context.restore();
  // Porch roof and lantern.
  context.beginPath();
  context.moveTo(-60, -140);
  context.lineTo(60, -140);
  context.lineTo(70, -122);
  context.lineTo(-70, -122);
  context.closePath();
  setTownShape(context, getRgbText(getMixedRgb(getPaintRgb("MAGENTA"), townState.shade, 0.3)));
  const swing = townMotion.matches ? 0 : Math.sin(seconds * 1.4) * 0.15;
  context.save();
  context.translate(48, -122);
  context.rotate(swing);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(0, 12);
  context.lineWidth = 3;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  setCelBox(context, -8, 12, 16, 20, getPaintRgb("GOLD"), { round: 4, shadeShare: 0 });
  context.restore();
  townState.windows.push({ matrix: context.getTransform(), x: 40, y: -110, width: 16, height: 20 });
  // The hanging sign under the porch roof.
  context.beginPath();
  context.moveTo(-50, -122);
  context.lineTo(-50, -112);
  context.moveTo(-10, -122);
  context.lineTo(-10, -112);
  context.lineWidth = 2;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  // (The sign sits on the wall beside the door, where it's readable.)
  setCelBox(context, -140, -232, 120, 34, getMixedRgb(getPaintRgb("SNOW"), getPaintRgb("GOLD"), 0.3), { round: 6, shadeShare: 0.12 });
  context.font = "700 22px 'Space Grotesk', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = getRgbText(getPaintRgb("MAGENTA"));
  context.fillText(place.name, -80, -214, 110);
  // Mailbox by the path, flag up.
  context.beginPath();
  context.moveTo(-70, 30);
  context.lineTo(-70, -30);
  context.lineWidth = 6;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  setCelBox(context, -96, -58, 52, 30, getMixedRgb(getPaintRgb("NIGHT_BLUE"), getPaintRgb("SNOW"), 0.3), { round: 10, shadeShare: 0.3 });
  context.beginPath();
  context.moveTo(-46, -56);
  context.lineTo(-46, -78);
  context.lineTo(-30, -72);
  context.lineTo(-46, -66);
  setTownShape(context, getRgbText(getPaintRgb("MAGENTA")));
}

const TOWN_PAINTERS = {
  company: setTownCompany,
  university: setTownHall,
  about: setTownCabin,
};

function getTownFrontPines(place) {
  // The forest just in front of a building, which the landscape leaves for
  // this file to paint (the clearing's frontHalfWidth, BG.clearingFrontDepth)
  // so these trees stand over the building: rows like the forest's, with a
  // gap for the path to the doors. Back rows first, so nearer ones overlap.
  if (place.frontPines) {
    return place.frontPines;
  }
  let seed = 7 + Math.round(Math.abs(place.x));
  const random = function () {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const spacing = BG.treeSpacing;
  const rowStep = spacing * 1.3;
  const pines = [];
  // Rows down to just above the shore (trees don't stand in the lake).
  const lowest = Math.min(BG.clearingFrontDepth, BG.shoreLevel - BG.clearingFloor - 30);
  for (let row = 0; row * rowStep + 30 < lowest; row++) {
    for (let x = -place.frontHalfWidth + 20; x < place.frontHalfWidth - 10; x += spacing) {
      const px = x + (random() - 0.5) * spacing * 0.5;
      const footY = Math.min(lowest, 30 + row * rowStep + random() * rowStep * 0.4);
      const height = spacing * (1.5 + 1.1 * random()) * (1 + row * 0.05);
      if (Math.abs(px) < (place.frontGap || TOWN.pathWidth / 2 + spacing * 0.45)) {
        continue;
      }
      pines.push({ x: px, y: footY, height: height });
    }
  }
  place.frontPines = pines;
  return pines;
}

function setTownGround(context, place) {
  // A worn patch of earth in front of the doors (the landscape paints the
  // meadow).
  if (place.icon === "company") {
    return;   // its yard is drawn by setTownYard
  }
  const floor = getMixedRgb(getPaintRgb("PINE"), getPaintRgb("ROCK_DARK"), 0.55);
  context.beginPath();
  context.ellipse(0, 4, 150, 16, 0, 0, Math.PI * 2);
  context.fillStyle = getRgbText(getMixedRgb(floor, getPaintRgb("ROCK"), 0.35));
  context.fill();
}

function setTownYard(context, place) {
  // In front of the company: a grass verge down to a road along the shore,
  // driveways from both lots, and a footpath from the office doors.
  const end = BG.shoreLevel - BG.clearingFloor - 30;
  const half = place.frontGap + 20;
  const floor = getMixedRgb(getPaintRgb("PINE"), getPaintRgb("ROCK_DARK"), 0.55);
  const grass = getMixedRgb(floor, getMixedRgb(getPaintRgb("PINE"), getPaintRgb("PINE_LIGHT"), 0.3), 0.75);
  context.beginPath();
  context.moveTo(-half, 2);
  context.lineTo(half, 2);
  context.lineTo(half + 30, end);
  context.lineTo(-half - 30, end);
  context.closePath();
  context.fillStyle = getRgbText(getMixedRgb(grass, townState.light, 0.06));
  context.fill();
  const asphalt = getRgbText(getMixedRgb(getPaintRgb("ROCK_DARK"), getPaintRgb("ROCK"), 0.35));
  const gravel = getRgbText(getMixedRgb(getPaintRgb("ROCK"), getPaintRgb("ORANGE"), 0.2));
  // Gravel driveways: the trucks' lot (left) and the delivery lot (right).
  const size = TOWN.size;
  for (const [from, to] of [[-1080 * size, -860 * size], [800 * size, 1100 * size]]) {
    context.beginPath();
    context.moveTo(from, 2);
    context.lineTo(to, 2);
    context.lineTo(to + 20, end - 20);
    context.lineTo(from - 20, end - 20);
    context.closePath();
    context.fillStyle = gravel;
    context.fill();
  }
  // Footpath from the office doors.
  context.beginPath();
  context.moveTo(-300 * size, 2);
  context.lineTo(-270 * size, 2);
  context.lineTo(-254 * size, end - 20);
  context.lineTo(-316 * size, end - 20);
  context.closePath();
  context.fillStyle = getRgbText(getMixedRgb(getMixedRgb(getPaintRgb("ROCK"), getPaintRgb("ORANGE"), 0.25), townState.shade, 0.25));
  context.fill();
  // The road along the shore, with a dashed middle line.
  context.fillStyle = asphalt;
  context.fillRect(-half - 40, end - 22, (half + 40) * 2, 20);
  context.beginPath();
  context.moveTo(-half - 40, end - 22);
  context.lineTo(half + 40, end - 22);
  context.lineWidth = TOWN.ink;
  context.strokeStyle = getRgbText(getPaintRgb("INK"));
  context.stroke();
  context.setLineDash([16, 14]);
  context.beginPath();
  context.moveTo(-half - 40, end - 12);
  context.lineTo(half + 40, end - 12);
  context.lineWidth = 3;
  context.strokeStyle = getRgbText(getPaintRgb("GOLD"), 0.8);
  context.stroke();
  context.setLineDash([]);
}

function setTownPath(context) {
  // A worn path from the doors down through the trees, widening as it comes.
  // It ends at the shore (BG.shoreLevel), just short of the water.
  const top = TOWN.pathWidth / 2;
  const bottom = TOWN.pathWidth;
  const end = BG.shoreLevel - BG.clearingFloor - 35;
  context.beginPath();
  context.moveTo(-top, 0);
  context.lineTo(top, 0);
  context.lineTo(bottom, end);
  context.quadraticCurveTo(0, end + 18, -bottom, end);
  context.closePath();
  context.fillStyle = getRgbText(getMixedRgb(getMixedRgb(getPaintRgb("ROCK"), getPaintRgb("ORANGE"), 0.25), townState.shade, 0.25));
  context.fill();
}

function setTownHaze(context) {
  // A light wash of the sky's colour over everything, like the trees get,
  // so the building sits at the same depth in the painting.
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = getRgbText(townState.haze, TOWN.haze);
  context.fillRect(0, 0, townState.canvas.width, townState.canvas.height);
  context.restore();
}

// ---------- Night ----------

function getTownNight(base) {
  // How much it's night at a place (0 day .. 1 night), matching the
  // painting's colours there.
  if (typeof getDayAt !== "function") {
    return 0;
  }
  const height = getHeightInDay(getDayAt(base.x), BG.dayShare);
  const t = Math.min(1, Math.max(0, (0.25 - height) / 0.8));
  return t * t * (3 - 2 * t);
}

function setTownNight(context, night) {
  // Darkens and cools everything drawn, then lights the windows.
  if (night <= 0.01) {
    return;
  }
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = "rgba(14, 22, 58, " + (0.35 * night) + ")";
  context.fillRect(0, 0, townState.canvas.width, townState.canvas.height);
  context.restore();
  context.save();
  for (const pane of townState.windows) {
    context.setTransform(pane.matrix);
    context.globalAlpha = night;
    context.fillStyle = getSunColour("--sun-glow", 1);
    if (pane.triangle) {
      // A shaped window (the lodge's glass gable): glow in its own shape.
      const [a, b, c] = pane.triangle;
      context.beginPath();
      context.moveTo(a[0], a[1]);
      context.lineTo(b[0], b[1]);
      context.lineTo(c[0], c[1]);
      context.closePath();
      context.fill();
      // Its frames: down the middle and across in thirds.
      context.moveTo(b[0], b[1]);
      context.lineTo((a[0] + c[0]) / 2, a[1]);
      for (const t of [1 / 3, 2 / 3]) {
        const y = b[1] + (a[1] - b[1]) * (1 - t);
        const spread = (c[0] - a[0]) / 2 * (1 - t);
        context.moveTo(b[0] - spread, y);
        context.lineTo(b[0] + spread, y);
      }
      context.lineWidth = 3;
      context.strokeStyle = getRgbText(getPaintRgb("INK"));
      context.stroke();
      continue;
    }
    context.fillRect(pane.x + 2, pane.y + 2, pane.width - 4, pane.height - 4);
    context.globalAlpha = night * 0.3;
    context.fillStyle = getSunColour("--sun-core", 1);
    context.beginPath();
    context.arc(pane.x + pane.width / 2, pane.y + pane.height / 2, Math.min(40, Math.max(pane.width, pane.height) * 1.1), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

// ---------- Every frame ----------

function setTownCanvasSize(place) {
  // Drawn at the landscape's own resolution, then scaled up by the browser
  // like the landscape is, so the edges soften the same way.
  const ratio = BG.swirlResolution;
  if (place.zoom === BG.zoom && place.ratio === ratio) {
    return;
  }
  place.zoom = BG.zoom;
  place.ratio = ratio;
  place.canvas.width = Math.ceil((place.right - place.left) * BG.zoom * ratio);
  place.canvas.height = Math.ceil((TOWN.bottom - TOWN.top) * BG.zoom * ratio);
  place.canvas.style.width = (place.right - place.left) * BG.zoom + "px";
  place.canvas.style.height = (TOWN.bottom - TOWN.top) * BG.zoom + "px";
}

function setTownPlacement(place) {
  // Puts a place's canvas where its building is on the page; returns its
  // base and the canvas's top-left (page px).
  const base = getTownBase(place);
  const left = base.x + place.left * base.scale;
  const top = base.y + TOWN.top * base.scale;
  place.canvas.style.transform = "translate(" + left + "px, " + top + "px)";
  return { base: base, left: left, top: top };
}

function setTownShift() {
  // The world slid under the page (flight.js, setWorldShift): move the
  // buildings with it straight away, as everything else on the page moves,
  // so they don't jump for a frame before their next drawing.
  for (const place of townState.places) {
    setTownPlacement(place);
  }
}

function setTownZoom() {
  // The world zoomed (zoom.js): redraw the buildings at the new size now,
  // rather than on their next frame, so they don't lag behind the zoom.
  if (getIsPlainView() || getIsInsideBuilding()) {
    return;
  }
  const seconds = townMotion.matches ? 0 : (performance.now() - townState.startTime) / 1000;
  for (const place of townState.places) {
    setTownPlaceFrame(place, seconds);
  }
}

function setTownPlaceFrame(place, seconds) {
  setTownCanvasSize(place);
  const placement = setTownPlacement(place);
  const base = placement.base;
  const left = placement.left;
  const top = placement.top;

  // Skip the drawing while the place is well off screen.
  const pageBox = townPage.getBoundingClientRect();
  const screenLeft = pageBox.left + left;
  const screenTop = pageBox.top + top;
  const width = (place.right - place.left) * base.scale;
  const height = (TOWN.bottom - TOWN.top) * base.scale;
  const onScreen = screenLeft < window.innerWidth + 50 && screenLeft + width > -50
    && screenTop < window.innerHeight + 50 && screenTop + height > -50;
  place.canvas.hidden = !onScreen;
  if (!onScreen) {
    return;
  }

  const context = place.context;
  const unit = place.ratio * base.scale;
  townState.canvas = place.canvas;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, place.canvas.width, place.canvas.height);
  context.setTransform(unit, 0, 0, unit, -place.left * unit, -TOWN.top * unit);
  townState.windows = [];
  // The light here: warm at sunset, cool and blue at night, pastel at dawn.
  const mood = getTownMood(base.x);
  townState.mood = mood;
  townState.light = getMoodRgb(mood, "GOLD", "GLOW", "PASTEL_PINK");
  townState.shade = getMoodRgb(mood, "VIOLET", "INDIGO", "VIOLET");
  townState.haze = getMoodRgb(mood, "GOLD", "GLOW", "PASTEL_PINK");
  for (const pine of place.pines) {
    setTownPine(context, pine.x, pine.y, pine.height);
  }
  setTownGround(context, place);
  context.save();
  context.scale(TOWN.size, TOWN.size);
  if (townState.hovered === place) {
    // A happy little bounce while hovered (gentler for the wide company).
    const lift = 0.04 * Math.min(1, 450 / place.width);
    const bounce = townMotion.matches ? 1 + lift : 1 + lift + lift * 0.5 * Math.sin(seconds * 9);
    context.scale(bounce, bounce);
  }
  TOWN_PAINTERS[place.icon](context, seconds, place);
  context.restore();
  if (place.icon === "company") {
    setTownYard(context, place);
  } else {
    setTownPath(context);
  }
  for (const pine of getTownFrontPines(place)) {
    setTownPine(context, pine.x, pine.y, pine.height);
  }
  setTownHaze(context);
  setTownNight(context, getTownNight(base));
}

// ---------- The invitation to go in ----------

function getPlaceAtOrb() {
  // The place whose building the orb is over (or right by), or null.
  const pageBox = townPage.getBoundingClientRect();
  const orb = getCentrePagePoint();
  const x = pageBox.left + orb.x;
  const y = pageBox.top + orb.y;
  const reach = TOWN.promptReach;
  for (const place of townState.places) {
    if (place.canvas.hidden) {
      continue;
    }
    const box = getTownBuildingBox(place);
    if (x > box.left - reach && x < box.right + reach && y > box.top - reach && y < box.bottom + reach) {
      return place;
    }
  }
  return null;
}

function setTownPrompt() {
  // Shows the invitation above a building while the orb is over it.
  let place = null;
  if (!getIsPlainView() && !getIsInsideBuilding()) {
    place = getPlaceAtOrb();
  }
  if (!place) {
    townPrompt.hidden = true;
    townState.promptPlace = null;
    return;
  }
  if (townState.promptPlace !== place) {
    const item = getPlanetItem(place.item);
    townPrompt.querySelector(".town-prompt-tag").textContent = item.title;
    townPrompt.querySelector(".town-prompt-text").textContent = townTouch.matches ? TOWN.promptTouch : TOWN.promptKeys;
    townPrompt.setAttribute("aria-label", "Go inside: " + item.title);
    townPrompt.hidden = false;
    townPrompt.classList.remove("is-popping");
    void townPrompt.offsetWidth;
    townPrompt.classList.add("is-popping");
    townState.promptPlace = place;
  }
  const box = getTownBuildingBox(place);
  const x = Math.min(window.innerWidth - 130, Math.max(130, (box.left + box.right) / 2));
  townPrompt.style.left = x + "px";
  townPrompt.style.top = Math.max(110, box.top - 12) + "px";
}

townPrompt.addEventListener("click", function () {
  if (townState.promptPlace) {
    setPlaceEntered(townState.promptPlace.item);
  }
});

window.addEventListener("keydown", function (event) {
  // Enter or E goes in while the invitation is up (unless typing, or a
  // link or button has the keyboard).
  if (!townState.promptPlace || event.repeat || getIsInsideBuilding()) {
    return;
  }
  if (event.key !== "Enter" && event.key !== "e" && event.key !== "E") {
    return;
  }
  const target = event.target;
  if (target && target.closest && target !== townPrompt && target.closest("a, button, input, textarea, select, .planet-panel")) {
    return;
  }
  event.preventDefault();
  setPlaceEntered(townState.promptPlace.item);
});

function setTownAnimation(now) {
  requestAnimationFrame(setTownAnimation);
  if (getIsPlainView()) {
    for (const place of townState.places) {
      place.canvas.hidden = true;
    }
    townPrompt.hidden = true;
    return;
  }
  if (now - townState.lastFrame < 1000 / TOWN.fps || getIsInsideBuilding()) {
    return;
  }
  townState.lastFrame = now;
  const seconds = townMotion.matches ? 0 : (now - townState.startTime) / 1000;
  for (const place of townState.places) {
    setTownPlaceFrame(place, seconds);
  }
  setTownPrompt();
}

setTownPlaces();
requestAnimationFrame(setTownAnimation);
