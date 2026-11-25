// =============================================================================
// Inside the places: little walk-around rooms
// =============================================================================
// Clicking or tapping one of the places' buildings (town.js) opens its room:
// a top-down, tile-by-tile room where a small version of the cartoon walks
// around and looks at what's there. Each item listed under the place's item
// in .planet-list in index.html (its moons) has a station; a board by the
// door introduces the place itself (OFFICE.rooms has each room's look):
//
//   company    - the Trolley Hospitality office: stations themed on the
//                group's businesses (a vending machine piping its sales
//                into a tank for the pipeline, an old and a new
//                micro-market fridge for the migration, a wall of screens
//                for diagnostics, a shelf of binders for the docs, the
//                restaurant counter's till for point of sale), an espresso
//                machine for the office coffee service, a toy trolley
//                running round the rug
//   university - a lecture room in purple and gold: a chalkboard for the
//                studies, rows of desks, a globe, a shelf of textbooks
//   about      - a log cabin room: climbing and paddling gear for the
//                outdoors, a guitar and a chess game for indoors, a cider
//                bar, a writing desk for getting in touch, a fireplace
//
// Walk up to a station and look at it to read about it, page by page, in a
// box at the bottom, ending with its tools and links.
//
//   Walk  - arrow keys or WASD (or the d-pad on touch screens)
//   Look  - Space, Enter or Z (or the A button) while facing something
//   Leave - walk out of the door, Escape, or the x button
//
// Stations you've looked at get a tick; the rest show a "!".
//
// Painted in the site's style: the landscape's palette, lit and shaded
// faces, ink outlines, with the light of the time of day outside.
//
// Uses from sun.js: getPlanetItem, getSunColour, SUN. From town.js:
// getPlaceMood, getPaintRgb, getMixedRgb, getRgbText, getMoodRgb. From
// background.js: BG.
// =============================================================================

const OFFICE = {
  cols: 15,
  rows: 11,
  door: { x: 7, y: 10 },   // the way out (bottom wall)
  start: { x: 7, y: 9 },   // where you come in, facing up
  minTile: 44,             // tile size range, px (the office is scrolled if it doesn't fit)
  maxTile: 72,
  stepTime: 0.17,          // seconds to walk one tile
  typeSpeed: 70,           // letters per second in the text box
  pageLength: 170,         // letters per page, at most (pages break between sentences)
  ink: 0.065,              // outline width, tiles
  touchRoom: 240,          // on tall touch screens, room left below the office for the controls, px
  touchTop: 70,            // ...and the office's top edge there, px
  fallbackIntro: "A desk with something on it.",
  // Each room, by its place's data-icon: the name on the wall and the board,
  // the back wall's colour bands (top to bottom) and windows (tile x), the
  // rug, where its items go in list order (a rectangle of tiles each), the
  // board (the place itself), little extras to look at, the first thing
  // you read at each kind of station, and how a kind of station looks here
  // (looks), if not its own.
  rooms: {
    company: {
      name: "TROLLEY",
      subName: "HOSPITALITY",
      wall: ["INDIGO", "VIOLET", "MAGENTA"],
      windows: [4.4, 9.6],
      rug: "MAGENTA",
      toyTrolley: true,
      slots: [
        { x: 2, y: 2, w: 2, h: 1 },
        { x: 6, y: 2, w: 3, h: 1 },
        { x: 11, y: 2, w: 2, h: 1 },
        { x: 1, y: 5, w: 1, h: 2 },
        { x: 13, y: 5, w: 1, h: 2 },
        { x: 4, y: 7, w: 1, h: 1 },
        { x: 10, y: 7, w: 1, h: 1 },
      ],
      board: { x: 9, y: 8 },
      props: [
        { kind: "plant", x: 1, y: 2 },
        { kind: "plant", x: 13, y: 2 },
        { kind: "plant", x: 1, y: 9 },
        { kind: "plant", x: 13, y: 9 },
        { kind: "coffee", x: 2, y: 9, text: "An espresso machine from the office coffee service. Also the real orchestrator of every pipeline." },
        { kind: "cooler", x: 12, y: 9, text: "Glug glug. The water cooler has nothing to report." },
      ],
      intros: {
        company: "Welcome to Trolley Hospitality! Vending, micro-markets, office coffee and restaurants. Have a look around: every station in here is a project.",
        pipeline: "A vending machine humming away. Every sale it makes drips down the pipe into tonight's data.",
        migrate: "A tired old micro-market fridge and a bright new one. The stock rides across without a single empty shelf.",
        diagnostics: "A wall of screens keeping an eye on every machine, market and run, every night.",
        docs: "A shelf of binders: guides, references and diagrams, so anyone can find their way.",
        pos: "The restaurant's counter, with the new till all set for the switch.",
      },
      looks: {},
    },
    university: {
      name: "JMU",
      subName: "JAMES MADISON UNIVERSITY",
      wall: ["INDIGO", "VIOLET", "VIOLET"],
      windows: [3.4, 10.6],
      rug: null,
      toyTrolley: false,
      slots: [
        { x: 6, y: 2, w: 3, h: 1 },
        { x: 2, y: 2, w: 2, h: 1 },
        { x: 11, y: 2, w: 2, h: 1 },
        { x: 13, y: 5, w: 1, h: 2 },
      ],
      board: { x: 9, y: 8 },
      props: [
        { kind: "plant", x: 1, y: 2 },
        { kind: "plant", x: 13, y: 2 },
        { kind: "desk", x: 3, y: 5, text: "A problem set left on the desk: half physics, half proofs." },
        { kind: "desk", x: 4, y: 5, text: "Someone's carved \"git commit -m 'fix'\" into this desk. Classic." },
        { kind: "desk", x: 10, y: 5, text: "A desk with a well-thumbed linear algebra textbook." },
        { kind: "desk", x: 11, y: 5, text: "A desk with a calculator and three sharpened pencils." },
        { kind: "desk", x: 3, y: 7, text: "A desk. The chair still wobbles." },
        { kind: "desk", x: 4, y: 7, text: "A desk with notes on data structures in very small handwriting." },
        { kind: "desk", x: 11, y: 7, text: "A desk with a lab report on electromagnetism." },
        { kind: "globe", x: 2, y: 9, text: "A globe. Somewhere on it: Harrisonburg, Virginia." },
        { kind: "books", x: 12, y: 9, text: "Textbooks: algorithms, discrete math, quantum mechanics and a very thick calculus book." },
      ],
      intros: {
        university: "Welcome to James Madison University! Have a seat, or have a look around.",
        docs: "A chalkboard covered in code, proofs and a physics diagram or two.",
      },
      looks: { docs: "chalkboard" },
    },
    about: {
      name: "ABOUT ME",
      subName: "",
      wall: ["ROCK_DARK", "ORANGE", "ORANGE"],
      windows: [4.4, 9.6],
      rug: "PINE_LIGHT",
      toyTrolley: false,
      slots: [
        { x: 2, y: 2, w: 2, h: 1 },
        { x: 6, y: 2, w: 3, h: 1 },
        { x: 11, y: 2, w: 2, h: 1 },
        { x: 13, y: 5, w: 1, h: 2 },
        { x: 4, y: 7, w: 1, h: 1 },
      ],
      board: { x: 9, y: 8 },
      props: [
        { kind: "fire", x: 1, y: 5, h: 2, text: "A crackling fire. Exactly as cosy as it looks." },
        { kind: "plant", x: 13, y: 2 },
        { kind: "plant", x: 1, y: 9 },
        { kind: "plant", x: 13, y: 9 },
        { kind: "chair", x: 3, y: 8, text: "A comfy armchair, perfect for staring at a chess puzzle." },
      ],
      intros: {
        about: "Welcome in! Make yourself at home. Everything in here is a bit more about me.",
        outdoors: "A climbing rope, a helmet, skis and a paddle, all a little muddy from the last trip.",
        music: "A guitar on its stand, and a chess game halfway through a big decision.",
        bar: "A little cider bar, set up just like the one at the cidery.",
        contact: "A writing desk with a stack of letters. Pull up a chair and say hello.",
      },
      looks: {},
    },
  },
};

const officeMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const officeTouch = window.matchMedia("(hover: none) and (pointer: coarse)");

// ---------- The overlay ----------

const officeBox = document.createElement("div");
officeBox.className = "office";
officeBox.hidden = true;
officeBox.setAttribute("role", "dialog");
officeBox.setAttribute("aria-label", "Inside the Work building");
officeBox.tabIndex = -1;
officeBox.innerHTML = [
  '<canvas class="office-canvas" aria-hidden="true"></canvas>',
  '<button class="office-close" type="button" aria-label="Leave the building">&times;</button>',
  '<p class="office-help">Arrow keys or WASD to walk &middot; Space or Enter to look &middot; Esc to leave</p>',
  '<div class="office-pad" aria-hidden="true">',
  '  <button class="office-pad-up" type="button" tabindex="-1" data-dir="up">&#9650;</button>',
  '  <button class="office-pad-left" type="button" tabindex="-1" data-dir="left">&#9664;</button>',
  '  <button class="office-pad-right" type="button" tabindex="-1" data-dir="right">&#9654;</button>',
  '  <button class="office-pad-down" type="button" tabindex="-1" data-dir="down">&#9660;</button>',
  '</div>',
  '<button class="office-a" type="button" tabindex="-1" aria-hidden="true">A</button>',
  '<div class="office-dialog" hidden>',
  '  <p class="office-dialog-text" aria-live="polite"></p>',
  '  <div class="office-dialog-links"></div>',
  '  <span class="office-dialog-more" aria-hidden="true">&#9660;</span>',
  '</div>',
].join("");
document.body.appendChild(officeBox);

const officeCanvas = officeBox.querySelector(".office-canvas");
const officeContext = officeCanvas.getContext("2d");
const officeDialog = officeBox.querySelector(".office-dialog");
const officeDialogText = officeBox.querySelector(".office-dialog-text");
const officeDialogLinks = officeBox.querySelector(".office-dialog-links");
const officeDialogMore = officeBox.querySelector(".office-dialog-more");

const officeState = {
  open: false,
  place: "company",        // whose room this is (its data-icon)
  room: null,              // OFFICE.rooms[place]
  things: [],              // stations and props: { kind, x, y, w, h, item, icon, text }
  player: { x: 7, y: 9, fromX: 7, fromY: 9, moveStart: 0, moving: false, facing: "up", steps: 0 },
  held: [],                // direction keys held, most recent last
  seen: new Set(),         // stations looked at (by list index)
  dialog: null,            // { pages, page, shown, startedAt, thing }
  lastTime: 0,
  frame: 0,
  tile: 48,
  mood: { sunset: 1, night: 0, dawn: 0 },   // the time of day outside, and its light and shade
  light: [255, 201, 77],
  shade: [77, 43, 125],
};

const OFFICE_DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OFFICE_KEYS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
  W: "up", S: "down", A: "left", D: "right",
};

// ---------- The office's contents ----------

function setOfficeThings() {
  // The place's items from the list (the moons after its own item) go into
  // the room's slots, then the props and the board (the place itself).
  const room = officeState.room;
  const items = document.querySelectorAll(".planet-list > li");
  let own = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].dataset.icon === officeState.place && items[i].dataset.kind !== "moon") {
      own = i;
      break;
    }
  }
  const things = [];
  if (own >= 0) {
    let slot = 0;
    for (let i = own + 1; i < items.length && items[i].dataset.kind === "moon"; i++) {
      const spot = room.slots[slot];
      if (!spot) {
        break;
      }
      things.push({ kind: "station", icon: items[i].dataset.icon || "", item: i, x: spot.x, y: spot.y, w: spot.w, h: spot.h });
      slot += 1;
    }
    things.push({ kind: "board", icon: officeState.place, item: own, x: room.board.x, y: room.board.y, w: 1, h: 1 });
  }
  for (const prop of room.props) {
    things.push({ kind: prop.kind, x: prop.x, y: prop.y, w: 1, h: prop.h || 1, text: prop.text || null, item: null });
  }
  officeState.things = things;
}

function getOfficeThingAt(x, y) {
  for (const thing of officeState.things) {
    if (x >= thing.x && x < thing.x + thing.w && y >= thing.y && y < thing.y + thing.h) {
      return thing;
    }
  }
  return null;
}

function getIsOfficeWall(x, y) {
  if (x === OFFICE.door.x && y === OFFICE.door.y) {
    return false;
  }
  return y <= 1 || x <= 0 || x >= OFFICE.cols - 1 || y >= OFFICE.rows - 1;
}

function getIsOfficeWalkable(x, y) {
  return !getIsOfficeWall(x, y) && getOfficeThingAt(x, y) === null;
}

// ---------- Opening and leaving ----------

function setOfficeOpen(place) {
  // Steps inside a place's building (by its data-icon; the company's if
  // none is given).
  if (officeState.open) {
    return;
  }
  officeState.place = OFFICE.rooms[place] ? place : "company";
  officeState.room = OFFICE.rooms[officeState.place];
  const own = document.querySelector('.planet-list > li[data-icon="' + officeState.place + '"]');
  const title = own ? own.querySelector(".planet-title") : null;
  officeBox.setAttribute("aria-label", "Inside: " + (title ? title.textContent.trim() : "a building"));
  if (typeof setPanelHidden === "function") {
    setPanelHidden();
  }
  if (typeof setLabelHidden === "function") {
    setLabelHidden();
  }
  setOfficeThings();
  const player = officeState.player;
  player.x = OFFICE.start.x;
  player.y = OFFICE.start.y;
  player.fromX = player.x;
  player.fromY = player.y;
  player.moving = false;
  player.facing = "up";
  officeState.held = [];
  officeState.dialog = null;
  officeDialog.hidden = true;
  officeBox.classList.remove("has-dialog");
  officeState.open = true;
  officeBox.hidden = false;
  document.body.classList.add("is-in-office");
  officeBox.classList.remove("is-entering");
  void officeBox.offsetWidth;
  officeBox.classList.add("is-entering");
  officeBox.focus({ preventScroll: true });
  officeState.lastTime = performance.now();
  cancelAnimationFrame(officeState.frame);
  officeState.frame = requestAnimationFrame(setOfficeFrame);
}

function setOfficeClosed() {
  // Back out to the world.
  if (!officeState.open) {
    return;
  }
  officeState.open = false;
  officeBox.hidden = true;
  officeDialog.hidden = true;
  officeState.dialog = null;
  document.body.classList.remove("is-in-office");
  cancelAnimationFrame(officeState.frame);
}

function getIsInOffice() {
  return officeState.open;
}

// ---------- The text box ----------

function getOfficePages(thing) {
  // What a station says: its intro, the project's name, its description in
  // pages, then its tools (with its links as buttons).
  if (thing.item === null) {
    return [thing.text];
  }
  const item = getPlanetItem(thing.item);
  const pages = [officeState.room.intros[thing.icon] || OFFICE.fallbackIntro];
  if (item.tag || item.title) {
    pages.push((item.tag ? item.tag.toUpperCase() + ": " : "") + item.title);
  }
  for (const paragraph of item.paragraphs) {
    let sentences = paragraph.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g) || [paragraph];
    if (thing.kind === "board") {
      // "The moons circling this planet..." doesn't apply in here.
      sentences = sentences.filter(function (sentence) {
        return !/\b(moons?|planet)\b/i.test(sentence);
      });
    }
    let page = "";
    for (const sentence of sentences) {
      if (page && (page + sentence).length > OFFICE.pageLength) {
        pages.push(page.trim());
        page = "";
      }
      page += sentence;
    }
    if (page.trim()) {
      pages.push(page.trim());
    }
  }
  if (item.tools.length) {
    pages.push("Tools: " + item.tools.join(", ") + ".");
  }
  return pages;
}

function setOfficeDialog(thing) {
  const pages = getOfficePages(thing);
  officeState.dialog = { pages: pages, page: 0, startedAt: performance.now(), thing: thing };
  officeDialog.hidden = false;
  officeBox.classList.add("has-dialog");
  officeDialogLinks.textContent = "";
  if (thing.kind === "station" || thing.kind === "board") {
    officeState.seen.add(thing.item);
  }
  setOfficeDialogText();
}

function getOfficeDialogDone() {
  const dialog = officeState.dialog;
  const text = dialog.pages[dialog.page];
  if (officeMotion.matches) {
    return true;
  }
  return (performance.now() - dialog.startedAt) / 1000 * OFFICE.typeSpeed >= text.length;
}

function setOfficeDialogText() {
  // Types the current page out, letter by letter.
  const dialog = officeState.dialog;
  if (!dialog) {
    return;
  }
  const text = dialog.pages[dialog.page];
  let shown = text.length;
  if (!officeMotion.matches) {
    shown = Math.min(text.length, Math.floor((performance.now() - dialog.startedAt) / 1000 * OFFICE.typeSpeed));
  }
  if (officeDialogText.textContent !== text.slice(0, shown)) {
    officeDialogText.textContent = text.slice(0, shown);
  }
  const last = dialog.page === dialog.pages.length - 1;
  const done = shown >= text.length;
  officeDialogMore.hidden = !done || last;
  if (last && done && officeDialogLinks.childElementCount === 0) {
    setOfficeDialogButtons();
  }
}

function setOfficeDialogButtons() {
  // On the last page: the project's links, and a button to carry on.
  const dialog = officeState.dialog;
  if (dialog.thing.item !== null) {
    for (const link of getPlanetItem(dialog.thing.item).links) {
      const button = document.createElement("a");
      button.textContent = link.label;
      button.href = link.href;
      if (link.href.indexOf("http") === 0) {
        button.target = "_blank";
        button.rel = "noopener";
      }
      officeDialogLinks.appendChild(button);
    }
  }
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Keep exploring";
  close.addEventListener("click", function () {
    setOfficeDialogClosed();
    officeBox.focus({ preventScroll: true });
  });
  officeDialogLinks.appendChild(close);
}

function setOfficeDialogNext() {
  // Space / A: finish typing the page, or go on to the next one, or close.
  const dialog = officeState.dialog;
  if (!getOfficeDialogDone()) {
    dialog.startedAt = -1e9;
    setOfficeDialogText();
    return;
  }
  if (dialog.page < dialog.pages.length - 1) {
    dialog.page += 1;
    dialog.startedAt = performance.now();
    officeDialogLinks.textContent = "";
    setOfficeDialogText();
    return;
  }
  setOfficeDialogClosed();
}

function setOfficeDialogClosed() {
  officeState.dialog = null;
  officeDialog.hidden = true;
  officeBox.classList.remove("has-dialog");
  officeDialogLinks.textContent = "";
}

// ---------- Walking and looking ----------

function setOfficeAction() {
  if (officeState.dialog) {
    setOfficeDialogNext();
    return;
  }
  const player = officeState.player;
  if (player.moving) {
    return;
  }
  const step = OFFICE_DIRECTIONS[player.facing];
  const thing = getOfficeThingAt(player.x + step.x, player.y + step.y);
  if (thing && (thing.item !== null || thing.text)) {
    setOfficeDialog(thing);
  }
}

function setOfficeWalk(now) {
  const player = officeState.player;
  if (player.moving) {
    if ((now - player.moveStart) / 1000 >= OFFICE.stepTime) {
      player.moving = false;
      player.fromX = player.x;
      player.fromY = player.y;
      if (player.x === OFFICE.door.x && player.y === OFFICE.door.y) {
        setOfficeClosed();
        return;
      }
    } else {
      return;
    }
  }
  if (officeState.dialog || officeState.held.length === 0) {
    return;
  }
  const direction = officeState.held[officeState.held.length - 1];
  player.facing = direction;
  const step = OFFICE_DIRECTIONS[direction];
  const x = player.x + step.x;
  const y = player.y + step.y;
  if (getIsOfficeWalkable(x, y)) {
    player.fromX = player.x;
    player.fromY = player.y;
    player.x = x;
    player.y = y;
    player.moving = true;
    player.moveStart = now;
    player.steps += 1;
  }
}

function getOfficePlayerSpot(now) {
  // The player's position in tiles, part way between tiles while walking.
  const player = officeState.player;
  if (!player.moving) {
    return { x: player.x, y: player.y, walking: 0 };
  }
  const t = Math.min(1, (now - player.moveStart) / 1000 / OFFICE.stepTime);
  return {
    x: player.fromX + (player.x - player.fromX) * t,
    y: player.fromY + (player.y - player.fromY) * t,
    walking: t,
  };
}

// ---------- Drawing ----------
// Painted like the rest of the site: flat bands of colour from the
// landscape's palette (BG.paintColours, via town.js's getPaintRgb), lit and
// shaded faces, thick ink outlines and flat ink shadows. The light comes
// from the time of day outside the building (town.js's getPlaceMood).

function getOfficeColour(name, alpha) {
  // A palette colour (SPACE, GOLD, ...) or a site colour (--cream, ...).
  if (name.indexOf("--") === 0) {
    return getSunColour(name, alpha === undefined ? 1 : alpha);
  }
  return getRgbText(getPaintRgb(name), alpha);
}

function getOfficeRgb(name) {
  return getPaintRgb(name);
}

function setOfficeShape(fill) {
  const context = officeContext;
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  context.lineWidth = OFFICE.ink;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = getOfficeColour("INK");
  context.stroke();
}

function setOfficeBox(x, y, w, h, fill, round) {
  officeContext.beginPath();
  if (round) {
    officeContext.roundRect(x, y, w, h, round);
  } else {
    officeContext.rect(x, y, w, h);
  }
  setOfficeShape(fill);
}

function setOfficeShadow(x, y, w, h, round) {
  // A flat ink shadow, down and to the right, like a cut-paper poster.
  officeContext.beginPath();
  officeContext.roundRect(x + 0.08, y + 0.1, w, h, round || 0.06);
  officeContext.fillStyle = getOfficeColour("INK", 0.28);
  officeContext.fill();
}

function setOfficeCel(x, y, w, h, base, options) {
  // A box with a lit face, a shaded band on the side away from the light,
  // a bright rim along the top and inked edges (base is [r, g, b]).
  const context = officeContext;
  const light = officeState.light;
  const shade = officeState.shade;
  const round = options && options.round ? options.round : 0;
  context.beginPath();
  if (round) {
    context.roundRect(x, y, w, h, round);
  } else {
    context.rect(x, y, w, h);
  }
  context.fillStyle = getRgbText(getMixedRgb(base, light, 0.18));
  context.fill();
  context.save();
  context.clip();
  const band = w * (options && options.shadeShare !== undefined ? options.shadeShare : 0.3);
  context.fillStyle = getRgbText(getMixedRgb(base, shade, 0.5));
  context.fillRect(x + w - band, y, band, h);
  context.fillStyle = getRgbText(getMixedRgb(base, light, 0.5));
  context.fillRect(x, y, w, Math.min(0.1, h * 0.18));
  if (band > 0) {
    context.beginPath();
    context.moveTo(x + w - band, y);
    context.lineTo(x + w - band, y + h);
    context.lineWidth = 0.025;
    context.strokeStyle = getOfficeColour("INK", 0.5);
    context.stroke();
  }
  context.restore();
  context.lineWidth = OFFICE.ink;
  context.lineJoin = "round";
  context.strokeStyle = getOfficeColour("INK");
  context.stroke();
}

function setOfficeLabel(text, x, y, size, colour, font, maxWidth) {
  const context = officeContext;
  context.font = (font || "700 ") + size + "px 'Space Grotesk', sans-serif";
  context.fillStyle = getOfficeColour(colour);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x, y, maxWidth || 100);
}

function setOfficeRoom(seconds) {
  // Floor boards with stepped pools of window light, the rug and the toy
  // trolley's track, the banded back wall with arched windows onto the sky
  // outside and the company's name, side walls and the door.
  const context = officeContext;
  const mood = officeState.mood;
  const wood = getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.5);
  for (let y = 2; y < OFFICE.rows - 1; y++) {
    const row = getMixedRgb(wood, officeState.shade, y % 2 === 0 ? 0.08 : 0.2);
    context.fillStyle = getRgbText(getMixedRgb(row, officeState.light, 0.12));
    context.fillRect(1, y, OFFICE.cols - 2, 1);
    context.beginPath();
    context.moveTo(1, y);
    context.lineTo(OFFICE.cols - 1, y);
    for (let x = 1 + (y % 3) * 0.7; x < OFFICE.cols - 1; x += 2.1) {
      context.moveTo(x, y);
      context.lineTo(x, y + 1);
    }
    context.lineWidth = 0.025;
    context.strokeStyle = getOfficeColour("INK", 0.45);
    context.stroke();
  }
  // Light through the windows, in two flat steps.
  for (const wx of officeState.room.windows) {
    for (const [reach, alpha] of [[3.2, 0.14], [1.8, 0.12]]) {
      context.beginPath();
      context.moveTo(wx, 2);
      context.lineTo(wx + 1, 2);
      context.lineTo(wx + 1 + reach * 0.5, 2 + reach);
      context.lineTo(wx + reach * 0.5, 2 + reach);
      context.closePath();
      context.fillStyle = getRgbText(officeState.light, alpha);
      context.fill();
    }
  }
  const room = officeState.room;
  // Rug (with the toy trolley's track round its edge in the office).
  if (room.rug) {
    setOfficeCel(4.5, 4, 6, 2.6, getOfficeRgb(room.rug), { round: 0.3, shadeShare: 0 });
    context.beginPath();
    context.roundRect(4.85, 4.35, 5.3, 1.9, 0.2);
    context.lineWidth = 0.08;
    context.strokeStyle = getOfficeColour("GOLD");
    context.stroke();
  }
  if (room.toyTrolley) {
    context.beginPath();
    context.roundRect(4.2, 3.7, 6.6, 3.2, 0.5);
    context.roundRect(4.05, 3.55, 6.9, 3.5, 0.6);
    context.lineWidth = 0.04;
    context.strokeStyle = getOfficeColour("INK", 0.7);
    context.stroke();
  }
  // Back wall: stepped bands like the painted sky.
  const bands = [[room.wall[0], 0, 0.55], [room.wall[1], 0.55, 1.15], [room.wall[2], 1.15, 1.7]];
  for (const [name, top, bottom] of bands) {
    context.fillStyle = getRgbText(getMixedRgb(getOfficeRgb(name), officeState.light, 0.12));
    context.fillRect(0, top, OFFICE.cols, bottom - top);
    context.beginPath();
    context.moveTo(0, bottom);
    context.lineTo(OFFICE.cols, bottom);
    context.lineWidth = 0.025;
    context.strokeStyle = getOfficeColour("INK", 0.6);
    context.stroke();
  }
  setOfficeCel(0, 1.7, OFFICE.cols, 0.3, getOfficeRgb("ROCK_DARK"), { shadeShare: 0 });
  // Arched windows showing the sky outside (sunset, night or dawn).
  for (const wx of officeState.room.windows) {
    const sky = context.createLinearGradient(0, 0.25, 0, 1.4);
    sky.addColorStop(0, getRgbText(getMoodRgb(mood, "MAGENTA", "SPACE", "PASTEL_MINT")));
    sky.addColorStop(1, getRgbText(getMoodRgb(mood, "GOLD", "NIGHT_BLUE", "PASTEL_PINK")));
    context.beginPath();
    context.moveTo(wx, 1.45);
    context.lineTo(wx, 0.75);
    context.arc(wx + 0.5, 0.75, 0.5, Math.PI, 0);
    context.lineTo(wx + 1, 1.45);
    context.closePath();
    setOfficeShape(sky);
    if (mood.night > 0.4) {
      for (const [sx, sy] of [[0.3, 0.6], [0.7, 0.9], [0.55, 0.45]]) {
        context.fillStyle = getOfficeColour("SNOW", mood.night);
        context.fillRect(wx + sx, sy, 0.05, 0.05);
      }
    }
    context.beginPath();
    context.moveTo(wx + 0.5, 0.25);
    context.lineTo(wx + 0.5, 1.45);
    context.moveTo(wx, 0.9);
    context.lineTo(wx + 1, 0.9);
    setOfficeShape(null);
  }
  // The company's name on the wall.
  setOfficeCel(5.9, 0.08, 3.2, 0.58, getMixedRgb(getOfficeRgb("SNOW"), getOfficeRgb("GOLD"), 0.25), { round: 0.1, shadeShare: 0.12 });
  setOfficeLabel(room.name, 7.5, room.subName ? 0.3 : 0.37, 0.3, "MAGENTA", null, 2.7);
  setOfficeLabel(room.subName, 7.5, 0.54, 0.13, "INDIGO", null, 2.7);
  // Side and bottom walls.
  context.fillStyle = getRgbText(getMixedRgb(getOfficeRgb("ROCK_DARK"), officeState.shade, 0.2));
  context.fillRect(0, 2, 1, OFFICE.rows - 2);
  context.fillRect(OFFICE.cols - 1, 2, 1, OFFICE.rows - 2);
  context.fillRect(0, OFFICE.rows - 1, OFFICE.cols, 1);
  context.beginPath();
  context.moveTo(1, 2);
  context.lineTo(1, OFFICE.rows - 1);
  context.lineTo(OFFICE.cols - 1, OFFICE.rows - 1);
  context.lineTo(OFFICE.cols - 1, 2);
  setOfficeShape(null);
  // The door: a gap in the bottom wall with a welcome mat.
  context.fillStyle = getOfficeColour("SPACE");
  context.fillRect(OFFICE.door.x, OFFICE.door.y, 1, 1);
  setOfficeCel(OFFICE.door.x + 0.1, OFFICE.door.y - 0.8, 0.8, 0.62, getOfficeRgb("GOLD"), { round: 0.1, shadeShare: 0 });
  setOfficeLabel("EXIT", OFFICE.door.x + 0.5, OFFICE.door.y + 0.5, 0.26, "SNOW");
}

function setOfficeToyTrolley(seconds) {
  // A little trolley car going round its track on the rug.
  const track = { x: 4.12, y: 3.62, w: 6.76, h: 3.36 };
  const perimeter = 2 * (track.w + track.h);
  let along = (officeMotion.matches ? 0.1 : seconds * 0.06) % 1 * perimeter;
  let x = 0;
  let y = 0;
  let angle = 0;
  if (along < track.w) {
    x = track.x + along;
    y = track.y;
  } else if ((along -= track.w) < track.h) {
    x = track.x + track.w;
    y = track.y + along;
    angle = Math.PI / 2;
  } else if ((along -= track.h) < track.w) {
    x = track.x + track.w - along;
    y = track.y + track.h;
    angle = Math.PI;
  } else {
    along -= track.w;
    x = track.x;
    y = track.y + track.h - along;
    angle = -Math.PI / 2;
  }
  const context = officeContext;
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  setOfficeShadow(-0.28, -0.13, 0.56, 0.26, 0.08);
  setOfficeCel(-0.28, -0.13, 0.56, 0.26, getOfficeRgb("PINE_LIGHT"), { round: 0.08, shadeShare: 0.25 });
  setOfficeBox(-0.2, -0.07, 0.4, 0.14, getOfficeColour("SNOW"), 0.04);
  context.restore();
}

function setOfficePlant(x, y) {
  setOfficeShadow(x + 0.22, y + 0.5, 0.56, 0.45);
  setOfficeCel(x + 0.22, y + 0.5, 0.56, 0.45, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("MAGENTA"), 0.4), { round: 0.08 });
  for (const [dx, dy, r, name] of [[0.32, 0.4, 0.2, "PINE"], [0.68, 0.4, 0.2, "PINE"], [0.5, 0.2, 0.25, "PINE_LIGHT"]]) {
    officeContext.beginPath();
    officeContext.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    setOfficeShape(getRgbText(getMixedRgb(getOfficeRgb(name), officeState.light, 0.15)));
  }
}

function setOfficeCoffee(x, y, seconds) {
  // The office coffee service's espresso machine, with a cup and steam.
  setOfficeShadow(x + 0.12, y + 0.05, 0.76, 0.9);
  setOfficeCel(x + 0.12, y + 0.05, 0.76, 0.9, getOfficeRgb("ROCK"), { round: 0.1 });
  setOfficeBox(x + 0.22, y + 0.15, 0.56, 0.2, getOfficeColour("GLOW"), 0.04);
  setOfficeBox(x + 0.36, y + 0.6, 0.28, 0.25, getOfficeColour("SNOW"), 0.04);
  if (!officeMotion.matches) {
    const rise = (seconds * 0.6) % 1;
    officeContext.globalAlpha = 1 - rise;
    officeContext.beginPath();
    officeContext.moveTo(x + 0.5, y + 0.55 - rise * 0.4);
    officeContext.quadraticCurveTo(x + 0.62, y + 0.42 - rise * 0.4, x + 0.5, y + 0.3 - rise * 0.4);
    officeContext.lineWidth = 0.05;
    officeContext.strokeStyle = getOfficeColour("SNOW");
    officeContext.stroke();
    officeContext.globalAlpha = 1;
  }
}

function setOfficeCooler(x, y, seconds) {
  setOfficeShadow(x + 0.24, y + 0.45, 0.52, 0.5);
  setOfficeCel(x + 0.24, y + 0.45, 0.52, 0.5, getOfficeRgb("SNOW"), { round: 0.06 });
  setOfficeCel(x + 0.28, y + 0.0, 0.44, 0.5, getOfficeRgb("GLOW"), { round: 0.16 });
  if (!officeMotion.matches) {
    const rise = (seconds * 0.5) % 1;
    officeContext.beginPath();
    officeContext.arc(x + 0.45, y + 0.42 - rise * 0.35, 0.05, 0, Math.PI * 2);
    officeContext.fillStyle = getOfficeColour("SNOW", 0.9);
    officeContext.fill();
  }
}

function setOfficeDesk(x, y) {
  // A student desk and chair.
  setOfficeShadow(x + 0.12, y + 0.15, 0.76, 0.45);
  setOfficeCel(x + 0.12, y + 0.15, 0.76, 0.45, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.45), { round: 0.05 });
  setOfficeBox(x + 0.3, y + 0.25, 0.3, 0.2, getOfficeColour("SNOW"), 0.02);
  setOfficeCel(x + 0.3, y + 0.65, 0.4, 0.28, getOfficeRgb("ROCK_DARK"), { round: 0.06 });
}

function setOfficeGlobe(x, y) {
  setOfficeShadow(x + 0.3, y + 0.75, 0.4, 0.2);
  setOfficeBox(x + 0.3, y + 0.75, 0.4, 0.18, getOfficeColour("ROCK_DARK"), 0.04);
  officeContext.beginPath();
  officeContext.arc(x + 0.5, y + 0.4, 0.3, 0, Math.PI * 2);
  setOfficeShape(getOfficeColour("NIGHT_BLUE"));
  officeContext.beginPath();
  officeContext.ellipse(x + 0.42, y + 0.32, 0.12, 0.08, 0.4, 0, Math.PI * 2);
  officeContext.ellipse(x + 0.6, y + 0.5, 0.08, 0.1, 0, 0, Math.PI * 2);
  officeContext.fillStyle = getOfficeColour("PINE_LIGHT");
  officeContext.fill();
}

function setOfficeBooks(x, y) {
  setOfficeShadow(x + 0.1, y - 0.1, 0.8, 1.0);
  setOfficeCel(x + 0.1, y - 0.1, 0.8, 1.0, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.6), { shadeShare: 0.2 });
  const colours = ["VIOLET", "GOLD", "MAGENTA", "NIGHT_BLUE"];
  for (let shelf = 0; shelf < 2; shelf++) {
    for (let b = 0; b < 4; b++) {
      setOfficeBox(x + 0.18 + b * 0.16, y + shelf * 0.45, 0.12, 0.34, getOfficeColour(colours[(b + shelf) % 4]), 0.02);
    }
  }
}

function setOfficeFire(x, y, h, seconds) {
  // A stone fireplace with a flickering fire.
  setOfficeShadow(x + 0.05, y - 0.1, 0.9, h + 0.05);
  setOfficeCel(x + 0.05, y - 0.1, 0.9, h + 0.05, getMixedRgb(getOfficeRgb("ROCK"), getOfficeRgb("SNOW"), 0.25), { shadeShare: 0.25 });
  setOfficeBox(x + 0.25, y + 0.4, 0.5, h - 0.7, getOfficeColour("INK"), 0.06);
  const flicker = officeMotion.matches ? 0 : Math.sin(seconds * 9) * 0.05;
  officeContext.beginPath();
  officeContext.moveTo(x + 0.32, y + h - 0.35);
  officeContext.quadraticCurveTo(x + 0.4, y + 0.6 - flicker, x + 0.5, y + 0.45 + flicker);
  officeContext.quadraticCurveTo(x + 0.6, y + 0.6 + flicker, x + 0.68, y + h - 0.35);
  officeContext.closePath();
  officeContext.fillStyle = getOfficeColour("ORANGE");
  officeContext.fill();
  officeContext.beginPath();
  officeContext.ellipse(x + 0.5, y + h - 0.45, 0.1, 0.18 + flicker, 0, 0, Math.PI * 2);
  officeContext.fillStyle = getOfficeColour("GOLD");
  officeContext.fill();
}

function setOfficeChair(x, y) {
  setOfficeShadow(x + 0.12, y + 0.1, 0.76, 0.8);
  setOfficeCel(x + 0.12, y + 0.1, 0.76, 0.8, getOfficeRgb("MAGENTA"), { round: 0.18 });
  setOfficeCel(x + 0.24, y + 0.35, 0.52, 0.45, getMixedRgb(getOfficeRgb("MAGENTA"), getOfficeRgb("SNOW"), 0.25), { round: 0.1 });
}

function setOfficeBoard(x, y) {
  // An easel with the company's name.
  officeContext.beginPath();
  officeContext.moveTo(x + 0.2, y + 0.95);
  officeContext.lineTo(x + 0.4, y + 0.2);
  officeContext.moveTo(x + 0.8, y + 0.95);
  officeContext.lineTo(x + 0.6, y + 0.2);
  setOfficeShape(null);
  setOfficeShadow(x - 0.05, y - 0.2, 1.1, 0.78);
  setOfficeCel(x - 0.05, y - 0.2, 1.1, 0.78, getMixedRgb(getOfficeRgb("SNOW"), getOfficeRgb("GOLD"), 0.25), { round: 0.06, shadeShare: 0.15 });
  const room = officeState.room;
  setOfficeLabel(room.name, x + 0.5, room.subName ? 0.08 + y : 0.15 + y, room.name.length > 5 ? 0.17 : 0.22, "MAGENTA", null, 0.9);
  setOfficeLabel(room.subName, x + 0.5, y + 0.32, 0.1, "INDIGO", null, 0.9);
}

function setOfficeStation(thing, seconds) {
  // Each project's station, themed on the group's businesses and drawn to
  // fit its rectangle (back-wall stations reach up onto the wall).
  const context = officeContext;
  const x = thing.x;
  const y = thing.y;
  const w = thing.w;
  const h = thing.h;
  const still = officeMotion.matches;
  const look = officeState.room.looks[thing.icon] || thing.icon;
  if (look === "chalkboard") {
    // A chalkboard with code, a proof and a little circuit.
    setOfficeShadow(x + 0.1, y - 0.9, w - 0.2, 1.5);
    setOfficeCel(x + 0.1, y - 0.9, w - 0.2, 1.5, getMixedRgb(getOfficeRgb("ROCK_DARK"), getOfficeRgb("ORANGE"), 0.3), { shadeShare: 0 });
    setOfficeCel(x + 0.2, y - 0.8, w - 0.4, 1.2, getMixedRgb(getOfficeRgb("PINE"), getOfficeRgb("NIGHT_BLUE"), 0.3), { shadeShare: 0 });
    context.font = "700 0.14px 'JetBrains Mono', monospace";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = getOfficeColour("SNOW", 0.9);
    const lines = ["def solve(n):", "    return n * 2", "e^(i*pi) + 1 = 0", "F = ma"];
    for (let i = 0; i < lines.length; i++) {
      context.fillText(lines[i], x + 0.32, y - 0.6 + i * 0.2, w - 1.2);
    }
    // A little circuit in gold chalk, top right.
    context.beginPath();
    context.moveTo(x + w - 0.85, y - 0.55);
    context.lineTo(x + w - 0.45, y - 0.55);
    context.lineTo(x + w - 0.45, y - 0.15);
    context.lineTo(x + w - 0.85, y - 0.15);
    context.closePath();
    context.moveTo(x + w - 0.7, y - 0.55);
    context.lineTo(x + w - 0.6, y - 0.62);
    context.lineTo(x + w - 0.5, y - 0.48);
    context.lineWidth = 0.03;
    context.strokeStyle = getOfficeColour("GOLD", 0.9);
    context.stroke();
    setOfficeCel(x + 0.3, y + 0.4, w - 0.6, 0.12, getOfficeRgb("ROCK_DARK"), { shadeShare: 0 });
    // A desk in front of it.
    setOfficeShadow(x + 0.5, y + 0.55, w - 1, 0.4);
    setOfficeCel(x + 0.5, y + 0.55, w - 1, 0.4, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.5), { round: 0.05 });
  } else if (look === "outdoors") {
    // Gear on the wall: a coiled rope, a helmet, skis and a paddle.
    setOfficeCel(x + 0.05, y - 0.9, w - 0.1, 1.2, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.6), { shadeShare: 0.15 });
    context.beginPath();
    context.arc(x + 0.45, y - 0.45, 0.25, 0, Math.PI * 2);
    context.arc(x + 0.45, y - 0.45, 0.15, 0, Math.PI * 2);
    context.lineWidth = 0.08;
    context.strokeStyle = getOfficeColour("MAGENTA");
    context.stroke();
    context.beginPath();
    context.arc(x + 1.0, y - 0.35, 0.18, Math.PI, 0);
    context.closePath();
    setOfficeShape(getOfficeColour("GOLD"));
    for (const sx of [1.35, 1.5]) {
      setOfficeBox(x + sx, y - 0.85, 0.09, 1.1, getOfficeColour("GLOW"), 0.04);
    }
    setOfficeBox(x + 1.72, y - 0.8, 0.06, 1.0, getOfficeColour("ROCK"), 0.02);
    setOfficeBox(x + 1.66, y - 0.85, 0.18, 0.28, getOfficeColour("PINE_LIGHT"), 0.06);
    // A bench with boots under it.
    setOfficeShadow(x + 0.2, y + 0.45, w - 0.4, 0.4);
    setOfficeCel(x + 0.2, y + 0.45, w - 0.4, 0.4, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.45), { round: 0.05 });
  } else if (look === "music") {
    // A guitar on its stand, a little amp and a chess table.
    setOfficeShadow(x + 0.2, y - 0.2, 0.7, 1.0);
    context.save();
    context.translate(x + 0.55, y + 0.1);
    context.rotate(-0.15);
    setOfficeBox(-0.04, -1.05, 0.08, 0.7, getOfficeColour("ROCK_DARK"), 0.02);
    context.beginPath();
    context.ellipse(0, -0.2, 0.22, 0.17, 0, 0, Math.PI * 2);
    context.ellipse(0, 0.12, 0.3, 0.24, 0, 0, Math.PI * 2);
    setOfficeShape(getOfficeColour("ORANGE"));
    context.beginPath();
    context.arc(0, -0.02, 0.07, 0, Math.PI * 2);
    setOfficeShape(getOfficeColour("INK"));
    context.restore();
    setOfficeCel(x + 1.0, y + 0.1, 0.5, 0.5, getOfficeRgb("ROCK_DARK"), { round: 0.05 });
    // Chess table with a board on it.
    setOfficeShadow(x + 1.75, y + 0.05, 1.0, 0.85);
    setOfficeCel(x + 1.75, y + 0.05, 1.0, 0.85, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.5), { round: 0.06 });
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        context.fillStyle = getOfficeColour((i + j) % 2 === 0 ? "SNOW" : "INK");
        context.fillRect(x + 1.95 + i * 0.15, y + 0.17 + j * 0.15, 0.15, 0.15);
      }
    }
    context.beginPath();
    context.arc(x + 2.1, y + 0.3, 0.05, 0, Math.PI * 2);
    context.arc(x + 2.4, y + 0.55, 0.05, 0, Math.PI * 2);
    context.fillStyle = getOfficeColour("MAGENTA");
    context.fill();
  } else if (look === "bar") {
    // A cider bar: a counter, taps, glasses and a crate of apples.
    setOfficeCel(x + 0.05, y - 0.85, w - 0.1, 0.9, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.65), { shadeShare: 0.15 });
    for (let k = 0; k < 3; k++) {
      setOfficeBox(x + 0.25 + k * 0.32, y - 0.75, 0.2, 0.3, getOfficeColour(["GOLD", "PASTEL_PINK", "ORANGE"][k], 0.85), 0.04);
    }
    setOfficeShadow(x + 0.05, y + 0.1, w - 0.1, 0.8);
    setOfficeCel(x + 0.05, y + 0.1, w - 0.1, 0.8, getMixedRgb(getOfficeRgb("MAGENTA"), getOfficeRgb("ROCK_DARK"), 0.45), { round: 0.06 });
    for (let k = 0; k < 3; k++) {
      setOfficeBox(x + 0.3 + k * 0.4, y - 0.05, 0.06, 0.25, getOfficeColour("SNOW"), 0.02);
    }
    setOfficeBox(x + 1.4, y + 0.2, 0.16, 0.24, getOfficeColour("GOLD", 0.85), 0.03);
    for (let k = 0; k < 3; k++) {
      officeContext.beginPath();
      officeContext.arc(x + 0.35 + k * 0.17, y + 0.55, 0.08, 0, Math.PI * 2);
      setOfficeShape(getOfficeColour(k === 1 ? "PINE_LIGHT" : "MAGENTA"));
    }
  } else if (look === "contact") {
    // A writing desk with letters and an envelope, and a mail slot.
    setOfficeShadow(x + 0.05, y + 0.1, w - 0.1, h - 0.2);
    setOfficeCel(x + 0.05, y + 0.1, w - 0.1, h - 0.2, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.5), { round: 0.06 });
    for (let k = 0; k < 3; k++) {
      setOfficeBox(x + 0.18 + k * 0.05, y + 0.3 + k * 0.08, 0.55, 0.38, getOfficeColour("SNOW"), 0.03);
    }
    officeContext.beginPath();
    officeContext.moveTo(x + 0.28, y + 0.46);
    officeContext.lineTo(x + 0.55, y + 0.62);
    officeContext.lineTo(x + 0.82, y + 0.46);
    officeContext.lineWidth = 0.03;
    officeContext.strokeStyle = getOfficeColour("INK");
    officeContext.stroke();
    officeContext.beginPath();
    officeContext.arc(x + 0.55, y + 0.62, 0.06, 0, Math.PI * 2);
    officeContext.fillStyle = getOfficeColour("MAGENTA");
    officeContext.fill();
    setOfficeBox(x + 0.3, y + 1.15, 0.4, 0.5, getOfficeColour("NIGHT_BLUE"), 0.05);
  } else if (look === "pipeline") {
    // A vending machine whose sales drip along a pipe into a tank.
    setOfficeShadow(x + 0.08, y - 0.95, 0.95, 1.85);
    setOfficeCel(x + 0.08, y - 0.95, 0.95, 1.85, getOfficeRgb("INDIGO"), { round: 0.1 });
    setOfficeBox(x + 0.16, y - 0.82, 0.58, 1.2, getRgbText(getMixedRgb(getOfficeRgb("GLOW"), officeState.shade, 0.35)), 0.04);
    const snacks = ["GOLD", "MAGENTA", "PINE_LIGHT", "ORANGE", "PASTEL_PINK", "SNOW"];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        setOfficeBox(x + 0.21 + col * 0.17, y - 0.76 + row * 0.28, 0.12, 0.18, getOfficeColour(snacks[(row + col * 2) % snacks.length]), 0.02);
      }
    }
    setOfficeBox(x + 0.8, y - 0.7, 0.14, 0.4, getOfficeColour("ROCK"), 0.03);
    setOfficeBox(x + 0.18, y + 0.5, 0.54, 0.22, getOfficeColour("SPACE"), 0.03);
    // The pipe and the tank.
    context.beginPath();
    context.moveTo(x + 1.03, y - 0.6);
    context.lineTo(x + w - 0.45, y - 0.6);
    context.lineTo(x + w - 0.45, y + 0.2);
    context.lineWidth = 0.17;
    context.strokeStyle = getOfficeColour("INK");
    context.stroke();
    context.lineWidth = 0.09;
    context.strokeStyle = getOfficeColour("ROCK");
    context.stroke();
    setOfficeShadow(x + w - 0.8, y + 0.2, 0.7, 0.7);
    setOfficeCel(x + w - 0.8, y + 0.2, 0.7, 0.7, getOfficeRgb("NIGHT_BLUE"), { round: 0.12 });
    setOfficeBox(x + w - 0.72, y + 0.45, 0.54, 0.12, getOfficeColour("GLOW"), 0.03);
    for (let k = 0; k < 3; k++) {
      const t = ((still ? 0 : seconds * 0.5) + k / 3) % 1;
      const across = w - 1.48;
      const total = across + 0.8;
      let px = x + 1.03 + t * total;
      let py = y - 0.6;
      if (t * total > across) {
        px = x + w - 0.45;
        py = y - 0.6 + (t * total - across);
      }
      context.beginPath();
      context.arc(px, py, 0.055, 0, Math.PI * 2);
      context.fillStyle = getOfficeColour("GOLD");
      context.fill();
    }
  } else if (look === "migrate") {
    // A tired old micro-market fridge, a bright new one, stock riding across.
    context.save();
    context.translate(x + 0.55, y + 0.9);
    context.rotate(-0.05);
    setOfficeShadow(-0.45, -1.75, 0.9, 1.75);
    setOfficeCel(-0.45, -1.75, 0.9, 1.75, getOfficeRgb("ROCK"), { round: 0.08 });
    const flicker = still || Math.sin(seconds * 17) > -0.7;
    setOfficeBox(-0.36, -1.62, 0.6, 1.3, getOfficeColour(flicker ? "PASTEL_MINT" : "ROCK_DARK", 0.55), 0.04);
    context.restore();
    setOfficeShadow(x + w - 1.05, y - 0.9, 0.95, 1.8);
    setOfficeCel(x + w - 1.05, y - 0.9, 0.95, 1.8, getOfficeRgb("SNOW"), { round: 0.08 });
    setOfficeBox(x + w - 0.97, y - 0.8, 0.66, 1.45, getRgbText(getMixedRgb(getOfficeRgb("GLOW"), officeState.light, 0.25)), 0.04);
    const bottles = ["MAGENTA", "GOLD", "PINE_LIGHT", "ORANGE"];
    for (let shelf = 0; shelf < 3; shelf++) {
      for (let b = 0; b < 4; b++) {
        setOfficeBox(x + w - 0.92 + b * 0.15, y - 0.68 + shelf * 0.45, 0.09, 0.28, getOfficeColour(bottles[(b + shelf) % 4]), 0.03);
      }
    }
    setOfficeCel(x + 1.0, y + 0.45, w - 2.05, 0.18, getOfficeRgb("ROCK_DARK"), { shadeShare: 0 });
    for (let k = 0; k < 2; k++) {
      const t = ((still ? 0.3 : seconds * 0.3) + k / 2) % 1;
      setOfficeCel(x + 1.0 + t * (w - 2.35), y + 0.12, 0.32, 0.32, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.3), { round: 0.03 });
    }
  } else if (look === "diagnostics") {
    // A wall of screens watching every machine, market and run.
    for (let i = 0; i < w * 2; i++) {
      const sx = x + 0.05 + i * 0.5;
      setOfficeCel(sx, y - 0.85, 0.45, 0.65, getOfficeRgb("SPACE"), { round: 0.05, shadeShare: 0 });
      context.beginPath();
      for (let k = 0; k <= 6; k++) {
        const gx = sx + 0.06 + k * 0.055;
        const gy = y - 0.52 + Math.sin(k * 1.3 + i * 2 + (still ? 0 : seconds * 2)) * 0.13;
        if (k === 0) {
          context.moveTo(gx, gy);
        } else {
          context.lineTo(gx, gy);
        }
      }
      context.lineWidth = 0.04;
      context.strokeStyle = getOfficeColour(i % 2 === 0 ? "GLOW" : "GOLD");
      context.stroke();
    }
    setOfficeShadow(x + 0.1, y + 0.05, w - 0.2, 0.8);
    setOfficeCel(x + 0.1, y + 0.05, w - 0.2, 0.8, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.55), { round: 0.06 });
    if (still || Math.floor(seconds * 1.5) % 2 === 0) {
      context.beginPath();
      context.moveTo(x + w / 2 - 0.15, y + 0.45);
      context.lineTo(x + w / 2 - 0.03, y + 0.58);
      context.lineTo(x + w / 2 + 0.2, y + 0.3);
      context.lineWidth = 0.08;
      context.strokeStyle = getOfficeColour("PINE_LIGHT");
      context.stroke();
    }
  } else if (look === "docs") {
    // A tall shelf of binders: guides, references and diagrams.
    setOfficeShadow(x + 0.05, y - 0.25, w - 0.1, h + 0.15);
    setOfficeCel(x + 0.05, y - 0.25, w - 0.1, h + 0.15, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.6), { shadeShare: 0.2 });
    const colours = ["MAGENTA", "NIGHT_BLUE", "PINE_LIGHT", "GOLD", "VIOLET", "GLOW", "ORANGE"];
    for (let shelf = 0; shelf < h * 2; shelf++) {
      const sy = y - 0.15 + shelf * 0.5;
      for (let b = 0; b < 4; b++) {
        const bw = (w - 0.3) / 4;
        setOfficeBox(x + 0.15 + b * bw, sy + 0.08, bw * 0.82, 0.34, getOfficeColour(colours[(shelf * 3 + b) % colours.length]), 0.02);
      }
    }
  } else if (look === "pos") {
    // The restaurant's counter: the new till and a plate going out.
    setOfficeShadow(x + 0.05, y + 0.1, w - 0.1, h - 0.15);
    setOfficeCel(x + 0.05, y + 0.1, w - 0.1, h - 0.15, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.45), { round: 0.06 });
    setOfficeCel(x + 0.15, y + 0.3, w - 0.3, 0.55, getOfficeRgb("SNOW"), { round: 0.05 });
    const blink = still || Math.floor(seconds * 2) % 2 === 0;
    setOfficeBox(x + 0.22, y + 0.38, w - 0.44, 0.24, getOfficeColour(blink ? "GLOW" : "NIGHT_BLUE"), 0.03);
    // A burger on a plate.
    const plateY = y + 1.35;
    officeContext.beginPath();
    officeContext.ellipse(x + 0.5, plateY, 0.3, 0.12, 0, 0, Math.PI * 2);
    setOfficeShape(getOfficeColour("SNOW"));
    setOfficeBox(x + 0.32, plateY - 0.2, 0.36, 0.12, getOfficeColour("GOLD"), 0.06);
    setOfficeBox(x + 0.3, plateY - 0.1, 0.4, 0.06, getOfficeColour("PINE_LIGHT"), 0.02);
    setOfficeBox(x + 0.32, plateY - 0.05, 0.36, 0.07, getOfficeColour("ROCK_DARK"), 0.03);
  } else {
    // Anything else: a desk with a laptop.
    setOfficeShadow(x + 0.05, y + 0.2, w - 0.1, h - 0.3);
    setOfficeCel(x + 0.05, y + 0.2, w - 0.1, h - 0.3, getMixedRgb(getOfficeRgb("ORANGE"), getOfficeRgb("ROCK_DARK"), 0.55), { round: 0.06 });
    setOfficeBox(x + w / 2 - 0.25, y + 0.05, 0.5, 0.35, getOfficeColour("ROCK_DARK"), 0.04);
  }
}

function setOfficeMarker(thing, seconds) {
  // A bobbing "!" over stations you haven't looked at yet, a tick over the rest.
  if (thing.item === null) {
    return;
  }
  const context = officeContext;
  const top = thing.kind === "station" && thing.y <= 2 ? thing.y - 1.12 : thing.y - 0.45;
  const bob = officeMotion.matches ? 0 : Math.sin(seconds * 4 + thing.x) * 0.06;
  const cx = thing.x + thing.w / 2;
  const cy = top + bob;
  const seen = officeState.seen.has(thing.item);
  context.beginPath();
  context.arc(cx, cy, 0.2, 0, Math.PI * 2);
  setOfficeShape(getOfficeColour(seen ? "PINE_LIGHT" : "SNOW"));
  context.fillStyle = getOfficeColour(seen ? "PINE" : "MAGENTA");
  if (seen) {
    context.beginPath();
    context.moveTo(cx - 0.09, cy);
    context.lineTo(cx - 0.02, cy + 0.08);
    context.lineTo(cx + 0.1, cy - 0.08);
    context.lineWidth = 0.05;
    context.strokeStyle = getOfficeColour("PINE");
    context.stroke();
  } else {
    context.font = "700 0.3px 'Space Grotesk', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("!", cx, cy + 0.01);
  }
}

function setOfficePlayer(spot, seconds) {
  // The cartoon, small and seen from above: curly hair, sunglasses, green
  // flannel and brown trousers, legs and arms swinging as it walks.
  const context = officeContext;
  const look = SUN.avatar;
  const facing = officeState.player.facing;
  const cx = spot.x + 0.5;
  const cy = spot.y + 0.5;
  const stride = spot.walking > 0 ? Math.sin(spot.walking * Math.PI) * (officeState.player.steps % 2 === 0 ? 1 : -1) : 0;
  context.save();
  context.translate(cx, cy);
  // Shadow.
  context.beginPath();
  context.ellipse(0, 0.4, 0.28, 0.09, 0, 0, Math.PI * 2);
  context.fillStyle = "rgba(0, 0, 0, 0.25)";
  context.fill();
  const side = facing === "left" || facing === "right";
  if (facing === "left") {
    context.scale(-1, 1);
  }
  // Legs.
  if (side) {
    setOfficeBox(-0.08 + stride * 0.1, 0.12, 0.12, 0.28, look.pants, 0.04);
    setOfficeBox(-0.04 - stride * 0.1, 0.12, 0.12, 0.28, look.pantsShade, 0.04);
  } else {
    setOfficeBox(-0.16, 0.12 + Math.max(0, stride) * 0.06, 0.13, 0.28, look.pants, 0.04);
    setOfficeBox(0.03, 0.12 + Math.max(0, -stride) * 0.06, 0.13, 0.28, look.pants, 0.04);
  }
  // Body: the green flannel.
  setOfficeBox(-0.2, -0.12, 0.4, 0.32, look.flannel, 0.08);
  context.beginPath();
  context.moveTo(-0.08, -0.12);
  context.lineTo(-0.08, 0.2);
  context.moveTo(0.08, -0.12);
  context.lineTo(0.08, 0.2);
  context.lineWidth = 0.02;
  context.strokeStyle = look.flannelLine;
  context.stroke();
  // Arms.
  if (side) {
    setOfficeBox(-0.05 - stride * 0.08, -0.08, 0.11, 0.26, look.flannelDark, 0.05);
  } else {
    setOfficeBox(-0.29, -0.08 + stride * 0.04, 0.1, 0.24, look.flannelDark, 0.05);
    setOfficeBox(0.19, -0.08 - stride * 0.04, 0.1, 0.24, look.flannelDark, 0.05);
  }
  // Head and hair.
  context.beginPath();
  context.arc(0, -0.3, 0.2, 0, Math.PI * 2);
  setOfficeShape(look.skin);
  const curls = facing === "up"
    ? [[-0.15, -0.36], [0, -0.42], [0.15, -0.36], [-0.12, -0.24], [0.12, -0.24], [0, -0.28]]
    : [[-0.16, -0.38], [-0.05, -0.46], [0.07, -0.45], [0.17, -0.37]];
  for (const [hx, hy] of curls) {
    context.beginPath();
    context.arc(hx, hy, 0.09, 0, Math.PI * 2);
    setOfficeShape(look.hair);
  }
  // Sunglasses.
  if (facing === "down") {
    setOfficeBox(-0.14, -0.31, 0.12, 0.07, look.lens, 0.02);
    setOfficeBox(0.02, -0.31, 0.12, 0.07, look.lens, 0.02);
  } else if (side) {
    setOfficeBox(0.06, -0.31, 0.12, 0.07, look.lens, 0.02);
  }
  context.restore();
}

function setOfficeDrawn(now) {
  const seconds = officeMotion.matches ? 0 : now / 1000;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (officeCanvas.width !== Math.round(width * ratio) || officeCanvas.height !== Math.round(height * ratio)) {
    officeCanvas.width = Math.round(width * ratio);
    officeCanvas.height = Math.round(height * ratio);
  }
  // Tile size: fit the office if possible, within the range. On a tall
  // phone screen, use the height (the office scrolls sideways) and keep
  // room at the bottom for the controls.
  const touchTall = officeTouch.matches && height > width * 1.2;
  let fit = Math.min(width / OFFICE.cols, (height - 40) / OFFICE.rows);
  if (touchTall) {
    fit = Math.max(fit, (height - OFFICE.touchRoom) / OFFICE.rows);
  }
  const tile = Math.max(OFFICE.minTile, Math.min(OFFICE.maxTile, Math.floor(fit)));
  officeState.tile = tile;
  const spot = getOfficePlayerSpot(now);
  // The camera: centre on the player, kept inside the office (or the whole
  // office centred, if it fits).
  const mapWidth = OFFICE.cols * tile;
  const mapHeight = OFFICE.rows * tile;
  let left = (width - mapWidth) / 2;
  let top = (height - mapHeight) / 2;
  if (mapWidth > width) {
    left = Math.min(0, Math.max(width - mapWidth, width / 2 - (spot.x + 0.5) * tile));
  }
  if (mapHeight > height) {
    top = Math.min(0, Math.max(height - mapHeight, height / 2 - (spot.y + 0.5) * tile));
  } else if (touchTall) {
    top = Math.min(top, OFFICE.touchTop);   // up top, with the controls below
  }
  const context = officeContext;
  // The light inside follows the time of day outside the building.
  let mood = { sunset: 1, night: 0, dawn: 0 };
  if (typeof getPlaceMood === "function") {
    mood = getPlaceMood(officeState.place);
  }
  officeState.mood = mood;
  officeState.light = getMoodRgb(mood, "GOLD", "GLOW", "PASTEL_PINK");
  officeState.shade = getMoodRgb(mood, "VIOLET", "INDIGO", "VIOLET");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = getOfficeColour("SPACE");
  context.fillRect(0, 0, officeCanvas.width, officeCanvas.height);
  context.setTransform(tile * ratio, 0, 0, tile * ratio, left * ratio, top * ratio);
  setOfficeRoom(seconds);
  if (officeState.room.toyTrolley) {
    setOfficeToyTrolley(seconds);
  }
  // Things and the player, back to front so nearer ones overlap.
  const drawn = officeState.things.slice().sort(function (a, b) {
    return (a.y + a.h) - (b.y + b.h);
  });
  let playerDrawn = false;
  for (const thing of drawn) {
    if (!playerDrawn && thing.y + thing.h - 1 > spot.y) {
      setOfficePlayer(spot, seconds);
      playerDrawn = true;
    }
    if (thing.kind === "station") {
      setOfficeStation(thing, seconds);
    } else if (thing.kind === "board") {
      setOfficeBoard(thing.x, thing.y);
    } else if (thing.kind === "plant") {
      setOfficePlant(thing.x, thing.y);
    } else if (thing.kind === "coffee") {
      setOfficeCoffee(thing.x, thing.y, seconds);
    } else if (thing.kind === "cooler") {
      setOfficeCooler(thing.x, thing.y, seconds);
    } else if (thing.kind === "desk") {
      setOfficeDesk(thing.x, thing.y);
    } else if (thing.kind === "globe") {
      setOfficeGlobe(thing.x, thing.y);
    } else if (thing.kind === "books") {
      setOfficeBooks(thing.x, thing.y);
    } else if (thing.kind === "fire") {
      setOfficeFire(thing.x, thing.y, thing.h, seconds);
    } else if (thing.kind === "chair") {
      setOfficeChair(thing.x, thing.y);
    }
  }
  if (!playerDrawn) {
    setOfficePlayer(spot, seconds);
  }
  for (const thing of officeState.things) {
    setOfficeMarker(thing, seconds);
  }
}

function setOfficeFrame(now) {
  if (!officeState.open) {
    return;
  }
  officeState.frame = requestAnimationFrame(setOfficeFrame);
  setOfficeWalk(now);
  if (!officeState.open) {
    return;
  }
  setOfficeDialogText();
  setOfficeDrawn(now);
}

// ---------- Input ----------

function setOfficeHeld(direction, down) {
  const held = officeState.held;
  const at = held.indexOf(direction);
  if (at >= 0) {
    held.splice(at, 1);
  }
  if (down) {
    held.push(direction);
  }
}

window.addEventListener("keydown", function (event) {
  // While inside, the keys belong to the office (flying, boosting and the
  // rest of the page don't hear them).
  if (!officeState.open) {
    return;
  }
  if (event.target && event.target.closest && event.target.closest(".office-dialog-links") && (event.key === "Enter" || event.key === " " || event.key === "Tab")) {
    return;   // let the link buttons work from the keyboard
  }
  const direction = OFFICE_KEYS[event.key];
  if (direction) {
    setOfficeHeld(direction, true);
  } else if (event.key === " " || event.key === "Enter" || event.key === "z" || event.key === "Z") {
    if (!event.repeat) {
      setOfficeAction();
    }
  } else if (event.key === "Escape" || event.key === "x" || event.key === "X") {
    if (officeState.dialog) {
      setOfficeDialogClosed();
    } else {
      setOfficeClosed();
    }
  } else if (event.key === "Tab") {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

window.addEventListener("keyup", function (event) {
  const direction = OFFICE_KEYS[event.key];
  if (direction) {
    setOfficeHeld(direction, false);
  }
});

window.addEventListener("blur", function () {
  officeState.held = [];
});

// The overlay keeps its pointer events to itself, so the world underneath
// doesn't fly or ripple.
for (const type of ["pointerdown", "pointermove", "pointerup", "click", "wheel", "touchstart"]) {
  officeBox.addEventListener(type, function (event) {
    event.stopPropagation();
  }, { passive: type === "wheel" || type === "touchstart" });
}

officeBox.querySelector(".office-close").addEventListener("click", setOfficeClosed);

for (const button of officeBox.querySelectorAll(".office-pad button")) {
  const direction = button.dataset.dir;
  button.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    setOfficeHeld(direction, true);
    try {
      button.setPointerCapture(event.pointerId);   // keep walking if the thumb slides off
    } catch (error) {
      // (no capture for this pointer: it still walks until released)
    }
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    button.addEventListener(type, function () {
      setOfficeHeld(direction, false);
    });
  }
}

officeBox.querySelector(".office-a").addEventListener("pointerdown", function (event) {
  event.preventDefault();
  setOfficeAction();
});

// Tapping the text box moves it on too.
officeDialog.addEventListener("click", function (event) {
  if (event.target.closest("a, button")) {
    return;
  }
  setOfficeDialogNext();
});

officeBox.classList.toggle("is-touch", officeTouch.matches);
officeTouch.addEventListener("change", function () {
  officeBox.classList.toggle("is-touch", officeTouch.matches);
});
