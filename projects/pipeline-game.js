// =============================================================================
// Run the night: the nightly pipeline project as a mini-game
// =============================================================================
// Six short levels, each teaching one part of the project, then a "What I
// did" card on how it really works (the facts match nightly-pipeline.html):
//
//   1. The tangle    - check 46 separately scheduled jobs by hand, then merge
//                      them into one nightly run. (The problem.)
//   2. Bronze        - move the orb to catch report downloads from the API.
//                      Missed ones become gaps that level 5 fills; empty ones
//                      become warnings in level 5's log. (canvas)
//   3. Silver        - pick the right fix for each messy raw field.
//   4. Classes       - write a new report class: pick only what's new, the
//                      rest is inherited from the base class.
//   5. The night     - watch a run, decide what happens when a download
//                      fails, read the diagnostics, then let the next night
//                      fill the gaps.
//   6. Switch over   - spot the value that differs between the old and new
//                      tables.
//
// Every level can be skipped straight to its card, and the route at the top
// jumps back to any level already reached. Settings are in GAME; most words
// are in the HTML, except the ones that depend on how the visitor played and
// the level data below (SILVER_ROWS, CLASS_PARTS, NIGHT_CHOICES,
// SWITCH_ROUNDS). The painted panorama behind it all is the home page's
// (../background.js).
// =============================================================================

const GAME = {
  // 1. The tangle
  jobCount: 46,
  failedJobs: [7, 31],        // which jobs failed last night (positions)
  checksBeforeMerge: 8,       // the merge button shows after this many checks...
  mergeButtonAfter: 20,       // ...or after this many seconds

  // 2. Bronze
  catchGoal: 12,              // downloads to save
  packetEvery: 0.95,          // seconds between downloads at the start
  packetEveryMin: 0.5,        // ...never closer together than this
  packetSpeed: 95,            // px per second at the start
  speedGain: 7,               // px per second faster for each one saved
  emptyShare: 0.18,           // share of downloads that come back empty
  catchReach: 38,             // px between the orb and a download to catch it
  orbEase: 10,                // how quickly the orb follows the pointer
  orbKeySpeed: 460,           // px per second with the arrow keys
  saveSeconds: 0.45,          // how long a caught download takes to reach bronze

  // 5. The night
  gapFillMax: 14,             // missing days fetched per night
  stageSeconds: 1.4,          // how long each stage takes to fill
};

// The pieces of the game, in order. The route buttons use these positions.
const LEVELS = ["start", "tangle", "bronze", "silver", "classes", "night", "switch", "finale"];

const REPORT_NAMES = [
  "sales", "markets", "coffee", "restocks", "waste", "items",
  "routes", "invoices", "shrink", "par levels", "locations", "commission",
];
const JOB_STEPS = ["download", "clean", "reshape", "history"];

// 3. Silver: one raw field per row, with the fixes to choose from.
const SILVER_ROWS = [
  {
    raw: '{ "SoldOn": "11/03/2026" }',
    problem: "The date arrives as text, written month first.",
    clean: "sold_on: 2026-11-03        -- a real date",
    choices: [
      { label: "Keep it as text", why: "Text dates sort wrong (\"11/03\" comes before \"2/01\") and can't be used for date maths." },
      { label: "Parse it into a real date", correct: true, why: "Right: a typed date sorts, filters and joins correctly." },
      { label: "Drop the column", why: "Then nobody knows which day the sale was." },
    ],
  },
  {
    raw: '{ "Price": 0.1, "Deposit": 0.2 }\n-- as floats: 0.1 + 0.2 = 0.30000000000000004',
    problem: "Money arrives as floating-point numbers, which can't store most cents exactly.",
    clean: "price: 0.100000            -- decimal(18,6)\ndeposit: 0.200000          -- 0.1 + 0.2 = 0.300000",
    choices: [
      { label: "Round everything to whole dollars", why: "That throws away the cents people need to see." },
      { label: "Leave them as floats", why: "Tiny errors add up across millions of rows, and totals stop matching the source." },
      { label: "Store exact decimals", correct: true, why: "Right: exact decimal money adds up to the cent." },
    ],
  },
  {
    raw: '{ "ItmDesc": "Chips, BBQ" }',
    problem: "Every report names things its own way: ItmDesc here, Item_Name in the next one.",
    clean: 'item_description: "Chips, BBQ"',
    choices: [
      { label: "Rename it to a consistent name", correct: true, why: "Right: one naming style across all 58 tables, so joins and reports are predictable." },
      { label: "Leave each report's own names", why: "Then every analyst has to learn every report's spelling." },
      { label: "Number the columns instead", why: "col_7 tells nobody anything." },
    ],
  },
  {
    raw: '{ "Qty": "12" }',
    problem: "A count arrives as text.",
    clean: "quantity: 12               -- an integer",
    choices: [
      { label: "Add it up as text", why: "\"12\" + \"3\" is \"123\", not 15." },
      { label: "Convert it to a whole number", correct: true, why: "Right: typed numbers can be summed and checked." },
      { label: "Drop rows with text numbers", why: "That would quietly lose real sales." },
    ],
  },
  {
    raw: '{ "Location": "Market 12", "Total": 1204.50 }\n-- where did this row come from?',
    problem: "If a total looks wrong next month, how do you trace it back?",
    clean: 'location: "Market 12"   total: 1204.500000\n_source_file: sales/2026-11-03.json\n_loaded_on: 2026-11-04',
    choices: [
      { label: "Ask the vendor again", why: "Slow, and the vendor's data may have changed since." },
      { label: "Search the old files by hand", why: "Possible, but slow every single time." },
      { label: "Add lineage columns", correct: true, why: "Right: every row says which raw file and day it came from." },
    ],
  },
];

// 4. Classes: the parts a report class could have. Only the needed ones are
// written in the new class; the rest come from Endpoint.
const CLASS_PARTS = [
  { label: "Its API path", needed: true, why: "Endpoint can't guess where the new report lives, so the class says its path." },
  { label: "Downloading and paging", why: "get_report() is already in Endpoint, so every report inherits it." },
  { label: "Its columns and types", needed: true, why: "Only this report knows its own columns, so the class lists them." },
  { label: "Saving the raw JSON", why: "save_raw_json() is inherited, so bronze works the same for every report." },
  { label: "Finding missing days", why: "get_missing_days() is inherited, so gap-filling comes free." },
  { label: "Logging and warnings", why: "log_run() is inherited, so the new report shows up in diagnostics automatically." },
];

// 5. The night: what to do when a download fails.
const NIGHT_CHOICES = [
  { label: "Rebuild Waste & shrink from what downloaded", why: "That would publish totals missing a day of waste, and nobody would know." },
  { label: "Stop the whole run", why: "Then 55 good reports and every other table go stale too." },
  { label: "Keep yesterday's Waste & shrink, build the rest, and flag it", correct: true, why: "Right: tables wait for complete inputs. Nothing wrong gets published, and the gap is fixed tomorrow." },
];

// 6. Switch over: example rows, and the one value that differs in each round.
const SWITCH_COLUMNS = ["Day", "Location", "Sales"];
const SWITCH_ROWS = [
  ["Nov 3", "Market 12", "$1,204.50"],
  ["Nov 3", "Market 15", "$886.10"],
  ["Nov 3", "Office 4", "$312.00"],
  ["Nov 4", "Market 12", "$1,177.25"],
  ["Nov 4", "Market 15", "$902.40"],
];
const SWITCH_ROUNDS = [
  {
    row: 1,
    column: 2,
    newValue: "$886.09",
    why: "Found it: one cent off. That's rounding in one of the old steps. Every difference like this was traced to its cause, then fixed or documented, before any report switched over.",
  },
  {
    row: 3,
    column: 0,
    newValue: "Nov 5",
    why: "Found it: a sale just after midnight landed on a different day. The two used different cut-off rules, so the original's rule was kept in the new tables.",
  },
];

const gameMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const levelSections = document.querySelectorAll(".level");
const routeButtons = document.querySelectorAll(".route-stop");

// What the visitor did, carried between levels.
const gameState = {
  current: 0,
  reached: 0,
  missedDownloads: 0,
  emptyWarnings: 0,
};

// ---------- Helpers ----------

function getGameColour(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getLevelRandom(seed) {
  let value = seed;
  return function () {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function getScrollBehaviour() {
  if (gameMotion.matches) {
    return "auto";
  }
  return "smooth";
}

function getLevelSection(name) {
  return document.querySelector('.level[data-level="' + name + '"]');
}

function getClockText(minutesAfterOne) {
  const minutes = String(minutesAfterOne).padStart(2, "0");
  return "1:" + minutes + " AM";
}

function getPause(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}

function setShaken(element) {
  element.classList.remove("is-shaking");
  void element.offsetWidth;   // restarts the animation
  element.classList.add("is-shaking");
}

// ---------- Moving between levels ----------

function setRouteState() {
  for (const button of routeButtons) {
    const index = Number(button.dataset.index);
    button.disabled = index > gameState.reached;
    button.classList.toggle("is-current", index === gameState.current);
    button.classList.toggle("is-done", index < gameState.reached && index !== gameState.current);
    if (index === gameState.current) {
      button.setAttribute("aria-current", "step");
    } else {
      button.removeAttribute("aria-current");
    }
  }
}

function setLevelShown(index) {
  setBronzeStopped();
  setNightStopped();
  gameState.current = index;
  if (index > gameState.reached) {
    gameState.reached = index;
  }

  const name = LEVELS[index];
  for (const section of levelSections) {
    section.hidden = section.dataset.level !== name;
  }
  const section = getLevelSection(name);
  const lesson = section.querySelector(".lesson");
  if (lesson) {
    lesson.hidden = true;
  }
  const skip = section.querySelector(".skip-level");
  if (skip) {
    skip.hidden = false;
  }
  setRouteState();
  setLevelStarted(name);

  if (index > 0) {
    document.querySelector(".route").scrollIntoView({ behavior: getScrollBehaviour(), block: "start" });
  }
  section.querySelector("h2").focus({ preventScroll: true });
}

function setLevelStarted(name) {
  if (name === "tangle") {
    setTangleLevel();
  } else if (name === "bronze") {
    setBronzeLevel();
  } else if (name === "silver") {
    setSilverLevel();
  } else if (name === "classes") {
    setClassesLevel();
  } else if (name === "night") {
    setNightLevel();
  } else if (name === "switch") {
    setSwitchLevel();
  }
}

function setLessonShown(name) {
  const section = getLevelSection(name);
  const lesson = section.querySelector(".lesson");
  const skip = section.querySelector(".skip-level");
  if (skip) {
    skip.hidden = true;
  }
  lesson.hidden = false;
  lesson.scrollIntoView({ behavior: getScrollBehaviour(), block: "nearest" });
  lesson.querySelector("h3").focus({ preventScroll: true });
}

function setLevelSkipped(name) {
  if (name === "bronze") {
    setBronzeStopped();
    setBronzeResult(true);
  } else if (name === "night") {
    setNightStopped();
  } else if (name === "tangle") {
    clearInterval(tangleState.timer);
  }
  setLessonShown(name);
}

function setNavigationHandlers() {
  for (const button of document.querySelectorAll("[data-next]")) {
    button.addEventListener("click", function () {
      setLevelShown(gameState.current + 1);
    });
  }
  for (const button of document.querySelectorAll(".skip-level")) {
    button.addEventListener("click", function () {
      setLevelSkipped(button.closest(".level").dataset.level);
    });
  }
  for (const button of routeButtons) {
    button.addEventListener("click", function () {
      setLevelShown(Number(button.dataset.index));
    });
  }
  document.querySelector(".game-replay").addEventListener("click", function () {
    gameState.missedDownloads = 0;
    gameState.emptyWarnings = 0;
    setLevelShown(1);
  });
}

// =============================================================================
// 1. The tangle
// =============================================================================

const tangleField = document.querySelector(".tangle-field");
const tangleStatus = document.querySelector(".tangle-status");
const tangleMerge = document.querySelector(".tangle-merge");
const tangleState = { checked: 0, failuresFound: 0, started: 0, timer: 0 };

function getTangleJobs() {
  const jobs = [];
  for (const step of JOB_STEPS) {
    for (const report of REPORT_NAMES) {
      if (jobs.length < GAME.jobCount) {
        jobs.push({ name: report, step: step });
      }
    }
  }
  return jobs;
}

function getScheduleText(index) {
  // Jobs start every few minutes from midnight to about 5:30 a.m.
  const minutes = 10 + index * 7;
  const hours = Math.floor(minutes / 60);
  let hourText = String(hours);
  if (hours === 0) {
    hourText = "12";
  }
  return hourText + ":" + String(minutes % 60).padStart(2, "0") + " AM";
}

function setTangleLevel() {
  const random = getLevelRandom(46);
  const jobs = getTangleJobs();
  clearInterval(tangleState.timer);
  tangleField.textContent = "";
  tangleField.classList.remove("is-merging", "is-merged");
  tangleState.checked = 0;
  tangleState.failuresFound = 0;
  tangleState.started = performance.now();
  tangleMerge.hidden = true;

  for (let i = 0; i < jobs.length; i++) {
    const job = document.createElement("button");
    const time = getScheduleText(i);
    job.type = "button";
    job.className = "job";
    job.dataset.failed = String(GAME.failedJobs.includes(i));
    job.style.setProperty("--tilt", ((random() - 0.5) * 9).toFixed(1) + "deg");
    job.style.setProperty("--delay", (random() * -3).toFixed(2) + "s");
    job.innerHTML = '<span class="job-name"></span><span class="job-time"></span>';
    job.querySelector(".job-name").textContent = jobs[i].name + " " + jobs[i].step;
    job.querySelector(".job-time").textContent = "ran " + time + "?";
    job.setAttribute("aria-label", "Check the " + jobs[i].name + " " + jobs[i].step + " job, scheduled " + time);
    job.addEventListener("click", function () {
      setJobChecked(job);
    });
    tangleField.appendChild(job);
  }

  setTangleStatus();
  tangleState.timer = setInterval(setTangleStatus, 500);
}

function setJobChecked(job) {
  if (job.classList.contains("is-checked")) {
    return;
  }
  job.classList.add("is-checked");
  tangleState.checked += 1;
  if (job.dataset.failed === "true") {
    job.classList.add("is-failed");
    job.querySelector(".job-time").textContent = "FAILED";
    tangleState.failuresFound += 1;
  } else {
    job.classList.add("is-ok");
    job.querySelector(".job-time").textContent = "ran ✓";
  }
  setTangleStatus();
}

function setTangleStatus() {
  const seconds = Math.floor((performance.now() - tangleState.started) / 1000);
  let text = "Checked " + tangleState.checked + " of " + GAME.jobCount + " run histories · " + seconds + " s so far";
  if (tangleState.failuresFound === 1) {
    text += " · 1 failure found";
  } else if (tangleState.failuresFound > 1) {
    text += " · " + tangleState.failuresFound + " failures found";
  }
  if (tangleState.checked >= GAME.checksBeforeMerge) {
    text = "That's " + tangleState.checked + " of " + GAME.jobCount + " run histories, and this was every morning. There has to be a better way.";
  }
  tangleStatus.textContent = text;

  const isReady = tangleState.checked >= GAME.checksBeforeMerge || seconds >= GAME.mergeButtonAfter;
  if (isReady && tangleMerge.hidden) {
    tangleMerge.hidden = false;
  }
}

function setTangleMerged() {
  clearInterval(tangleState.timer);
  tangleMerge.hidden = true;
  tangleStatus.textContent = "One job, one schedule, one place to look.";

  const fieldBox = tangleField.getBoundingClientRect();
  const centreX = fieldBox.left + fieldBox.width / 2;
  const centreY = fieldBox.top + fieldBox.height / 2;
  const jobs = tangleField.querySelectorAll(".job");
  tangleField.classList.add("is-merging");
  for (let i = 0; i < jobs.length; i++) {
    const box = jobs[i].getBoundingClientRect();
    const dx = centreX - (box.left + box.width / 2);
    const dy = centreY - (box.top + box.height / 2);
    if (!gameMotion.matches) {
      jobs[i].style.transitionDelay = (i * 0.012).toFixed(3) + "s";
    }
    jobs[i].style.transform = "translate(" + dx + "px, " + dy + "px) scale(0.2)";
    jobs[i].style.opacity = "0";
  }

  let wait = 1300;
  if (gameMotion.matches) {
    wait = 50;
  }
  setTimeout(function () {
    tangleField.classList.add("is-merged");
    const orb = document.createElement("div");
    orb.className = "merged-orb";
    orb.textContent = "1 nightly run";
    tangleField.appendChild(orb);
    setTimeout(function () {
      setLessonShown("tangle");
    }, 700);
  }, wait);
}

tangleMerge.addEventListener("click", setTangleMerged);

// =============================================================================
// 2. Bronze: catch the downloads
// =============================================================================

const bronzeCanvas = document.querySelector(".bronze-canvas");
const bronzeContext = bronzeCanvas.getContext("2d");
const bronzeScore = document.querySelector(".bronze-score");
const bronzeState = {
  running: false,
  frame: 0,
  lastTime: 0,
  width: 0,
  height: 0,
  random: getLevelRandom(7),
  packets: [],
  floaters: [],
  orb: { x: 0, y: 0 },
  target: { x: 0, y: 0 },
  keys: { up: false, down: false, left: false, right: false },
  untilNext: 0,
  nameIndex: 0,
  saved: 0,
  missed: 0,
  empty: 0,
  vaultPop: 0,
  done: false,
};

function getApiPoint() {
  // Centred, but kept clear of the bronze vault on narrow screens.
  const vault = getVaultBox();
  const x = Math.max(bronzeState.width / 2, vault.x + vault.width + 50);
  return { x: x, y: 50 };
}

function getVaultBox() {
  return { x: 14, y: 14, width: 132, height: 62 };
}

function setBronzeSize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  bronzeState.width = bronzeCanvas.clientWidth;
  bronzeState.height = bronzeCanvas.clientHeight;
  bronzeCanvas.width = Math.round(bronzeState.width * ratio);
  bronzeCanvas.height = Math.round(bronzeState.height * ratio);
  bronzeContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setBronzeLevel() {
  setBronzeSize();
  bronzeState.packets = [];
  bronzeState.floaters = [];
  bronzeState.untilNext = 0.4;
  bronzeState.nameIndex = 0;
  bronzeState.saved = 0;
  bronzeState.missed = 0;
  bronzeState.empty = 0;
  bronzeState.vaultPop = 0;
  bronzeState.done = false;
  bronzeState.orb.x = bronzeState.width / 2;
  bronzeState.orb.y = bronzeState.height * 0.72;
  bronzeState.target.x = bronzeState.orb.x;
  bronzeState.target.y = bronzeState.orb.y;
  setBronzeScore();
  document.querySelector(".bronze-result").textContent = "";

  bronzeState.running = true;
  bronzeState.lastTime = performance.now();
  cancelAnimationFrame(bronzeState.frame);
  bronzeState.frame = requestAnimationFrame(setBronzeFrame);
}

function setBronzeStopped() {
  bronzeState.running = false;
  cancelAnimationFrame(bronzeState.frame);
  for (const key of Object.keys(bronzeState.keys)) {
    bronzeState.keys[key] = false;
  }
}

function setBronzeScore() {
  let text = "Saved " + bronzeState.saved + " / " + GAME.catchGoal;
  text += " · missed " + bronzeState.missed;
  text += " · empty caught " + bronzeState.empty;
  bronzeScore.textContent = text;
}

function setBronzeResult(skipped) {
  const result = document.querySelector(".bronze-result");
  gameState.missedDownloads = bronzeState.missed;
  gameState.emptyWarnings = bronzeState.empty;
  if (skipped) {
    result.textContent = "";
    return;
  }
  let text = "You saved " + bronzeState.saved + " downloads to bronze";
  if (bronzeState.missed === 0) {
    text += " and missed none.";
  } else if (bronzeState.missed === 1) {
    text += " and missed 1. Don't worry: the next night fetches it.";
  } else {
    text += " and missed " + bronzeState.missed + ". Don't worry: the next night fetches them.";
  }
  if (bronzeState.empty > 0) {
    text += " You also caught " + bronzeState.empty + " empty download(s), and they'll show up as warnings in the run log.";
  }
  result.textContent = text;
}

function setBronzeWon() {
  setBronzeStopped();
  setBronzeResult(false);
  setLessonShown("bronze");
}

function setBronzePacket() {
  const random = bronzeState.random;
  const api = getApiPoint();
  const speed = GAME.packetSpeed + bronzeState.saved * GAME.speedGain;
  const packet = {
    x: api.x + (random() - 0.5) * 30,
    y: api.y + 24,
    vx: (random() - 0.5) * 1.3 * speed,
    vy: speed * (0.75 + random() * 0.4),
    label: REPORT_NAMES[bronzeState.nameIndex % REPORT_NAMES.length],
    empty: random() < GAME.emptyShare,
    saving: false,
    progress: 0,
    fromX: 0,
    fromY: 0,
  };
  bronzeState.nameIndex += 1;
  bronzeState.packets.push(packet);
}

function setFloater(x, y, text, colour) {
  bronzeState.floaters.push({ x: x, y: y, text: text, colour: colour, age: 0 });
}

function setBronzeOrbMoved(seconds) {
  const keys = bronzeState.keys;
  const step = GAME.orbKeySpeed * seconds;
  if (keys.left) {
    bronzeState.target.x -= step;
  }
  if (keys.right) {
    bronzeState.target.x += step;
  }
  if (keys.up) {
    bronzeState.target.y -= step;
  }
  if (keys.down) {
    bronzeState.target.y += step;
  }
  bronzeState.target.x = Math.min(Math.max(bronzeState.target.x, 24), bronzeState.width - 24);
  bronzeState.target.y = Math.min(Math.max(bronzeState.target.y, 96), bronzeState.height - 24);

  const ease = 1 - Math.exp(-GAME.orbEase * seconds);
  bronzeState.orb.x += (bronzeState.target.x - bronzeState.orb.x) * ease;
  bronzeState.orb.y += (bronzeState.target.y - bronzeState.orb.y) * ease;
}

function setBronzePackets(seconds) {
  if (!bronzeState.done) {
    bronzeState.untilNext -= seconds;
    if (bronzeState.untilNext <= 0) {
      setBronzePacket();
      bronzeState.untilNext = Math.max(GAME.packetEveryMin, GAME.packetEvery - bronzeState.saved * 0.03);
    }
  }

  const kept = [];
  for (const packet of bronzeState.packets) {
    let keep = true;
    if (packet.saving) {
      packet.progress += seconds / GAME.saveSeconds;
      if (packet.progress >= 1) {
        keep = false;
        bronzeState.saved += 1;
        bronzeState.vaultPop = 1;
        setBronzeScore();
        if (bronzeState.saved >= GAME.catchGoal && !bronzeState.done) {
          bronzeState.done = true;
          setTimeout(setBronzeWon, 700);
        }
      }
    } else {
      packet.x += packet.vx * seconds;
      packet.y += packet.vy * seconds;
      if (packet.x < 36) {
        packet.vx = Math.abs(packet.vx);
      } else if (packet.x > bronzeState.width - 36) {
        packet.vx = -Math.abs(packet.vx);
      }

      const distance = Math.hypot(packet.x - bronzeState.orb.x, packet.y - bronzeState.orb.y);
      if (distance < GAME.catchReach) {
        if (packet.empty) {
          keep = false;
          bronzeState.empty += 1;
          setFloater(packet.x, packet.y, "empty: warning logged", getGameColour("--sun-glow"));
          setBronzeScore();
        } else {
          packet.saving = true;
          packet.fromX = packet.x;
          packet.fromY = packet.y;
          setFloater(packet.x, packet.y - 10, "saved raw", getGameColour("--sky-light"));
        }
      } else if (packet.y > bronzeState.height + 20) {
        keep = false;
        if (!packet.empty) {
          bronzeState.missed += 1;
          const x = Math.min(Math.max(packet.x, 80), bronzeState.width - 80);
          setFloater(x, bronzeState.height - 14, "missed: fetched next night", "#f0a58f");
          setBronzeScore();
        }
      }
    }
    if (keep) {
      kept.push(packet);
    }
  }
  bronzeState.packets = kept;

  const floaters = [];
  for (const floater of bronzeState.floaters) {
    floater.age += seconds;
    floater.y -= 22 * seconds;
    if (floater.age < 1.6) {
      floaters.push(floater);
    }
  }
  bronzeState.floaters = floaters;
  bronzeState.vaultPop = Math.max(0, bronzeState.vaultPop - seconds * 3);
}

function getSavingPoint(packet) {
  const vault = getVaultBox();
  const endX = vault.x + vault.width / 2;
  const endY = vault.y + vault.height / 2;
  const t = packet.progress;
  const eased = t * t * (3 - 2 * t);
  return {
    x: packet.fromX + (endX - packet.fromX) * eased,
    y: packet.fromY + (endY - packet.fromY) * eased - Math.sin(t * Math.PI) * 60,
    scale: 1 - t * 0.6,
  };
}

function setRoundedBox(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function setApiDrawn(context, seconds) {
  const api = getApiPoint();
  const ink = getGameColour("--brown-deep");
  const glow = context.createRadialGradient(api.x, api.y, 4, api.x, api.y, 60);
  glow.addColorStop(0, "rgba(156, 198, 228, 0.55)");
  glow.addColorStop(1, "rgba(156, 198, 228, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(api.x, api.y, 60, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = getGameColour("--sky");
  context.strokeStyle = ink;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(api.x, api.y, 24 + Math.sin(seconds * 3) * 1.5, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = getGameColour("--sky-light");
  context.beginPath();
  context.ellipse(api.x, api.y, 24, 7, seconds * 0.6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = getGameColour("--cream");
  context.font = "600 12px 'JetBrains Mono', monospace";
  context.textBaseline = "middle";
  const label = "vendor API";
  if (api.x + 34 + context.measureText(label).width < bronzeState.width - 8) {
    context.textAlign = "left";
    context.fillText(label, api.x + 34, api.y);
  } else {
    // No room beside it on narrow screens: above it instead.
    context.textAlign = "center";
    context.fillText(label, api.x, api.y - 33);
  }
}

function setVaultDrawn(context) {
  const vault = getVaultBox();
  const ink = getGameColour("--brown-deep");
  const grow = bronzeState.vaultPop * 6;
  context.fillStyle = getGameColour("--tan-dark");
  context.strokeStyle = ink;
  context.lineWidth = 3;
  setRoundedBox(context, vault.x - grow / 2, vault.y - grow / 2, vault.width + grow, vault.height + grow, 12);
  context.fill();
  context.stroke();

  context.fillStyle = getGameColour("--ink");
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 14px 'Space Grotesk', sans-serif";
  context.fillText("BRONZE", vault.x + vault.width / 2, vault.y + 20);
  context.font = "500 11px 'JetBrains Mono', monospace";
  context.fillText(bronzeState.saved + " / " + GAME.catchGoal + " raw JSON", vault.x + vault.width / 2, vault.y + 42);
}

function setPacketDrawn(context, x, y, scale, packet) {
  const width = 78 * scale;
  const height = 26 * scale;
  context.save();
  context.lineWidth = 2;
  context.strokeStyle = getGameColour("--brown-deep");
  if (packet.empty) {
    context.fillStyle = "#8d949e";
    context.setLineDash([4, 3]);
  } else {
    context.fillStyle = getGameColour("--cream");
  }
  setRoundedBox(context, x - width / 2, y - height / 2, width, height, 8 * scale);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = getGameColour("--ink");
  context.font = "600 " + Math.round(11 * scale) + "px 'JetBrains Mono', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  let label = "{ } " + packet.label;
  if (packet.empty) {
    label = "{ } empty";
  }
  context.fillText(label, x, y + 1);
  context.restore();
}

function setBronzeOrbDrawn(context, seconds) {
  const orb = bronzeState.orb;
  const glow = context.createRadialGradient(orb.x, orb.y, 6, orb.x, orb.y, 70);
  glow.addColorStop(0, "rgba(246, 165, 94, 0.55)");
  glow.addColorStop(1, "rgba(246, 165, 94, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(orb.x, orb.y, 70, 0, Math.PI * 2);
  context.fill();

  // The catch reach, faintly.
  context.strokeStyle = "rgba(246, 165, 94, 0.35)";
  context.setLineDash([5, 6]);
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(orb.x, orb.y, GAME.catchReach, seconds * 0.8, seconds * 0.8 + Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  const layers = [
    { colour: "--ember", radius: 22, speed: 2.1 },
    { colour: "--sunset", radius: 17, speed: -2.6 },
    { colour: "--sun-glow", radius: 12, speed: 3.1 },
    { colour: "--sun-core", radius: 6, speed: 4 },
  ];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    context.fillStyle = getGameColour(layer.colour);
    context.beginPath();
    for (let step = 0; step <= 24; step++) {
      const angle = (step / 24) * Math.PI * 2;
      const lump = 1 + Math.sin(angle * 3 + seconds * layer.speed) * 0.07;
      const px = orb.x + Math.cos(angle) * layer.radius * lump;
      const py = orb.y + Math.sin(angle) * layer.radius * lump;
      if (step === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    }
    context.closePath();
    context.fill();
    if (i === 0) {
      context.strokeStyle = getGameColour("--brown-deep");
      context.lineWidth = 2.5;
      context.stroke();
    }
  }
}

function setBronzeDrawn(seconds) {
  const context = bronzeContext;
  context.clearRect(0, 0, bronzeState.width, bronzeState.height);

  // The edge downloads are lost over.
  context.strokeStyle = "rgba(240, 165, 143, 0.4)";
  context.setLineDash([8, 8]);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, bronzeState.height - 3);
  context.lineTo(bronzeState.width, bronzeState.height - 3);
  context.stroke();
  context.setLineDash([]);

  setVaultDrawn(context);
  setApiDrawn(context, seconds);
  for (const packet of bronzeState.packets) {
    if (packet.saving) {
      const point = getSavingPoint(packet);
      setPacketDrawn(context, point.x, point.y, point.scale, packet);
    } else {
      setPacketDrawn(context, packet.x, packet.y, 1, packet);
    }
  }
  setBronzeOrbDrawn(context, seconds);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "600 12px 'Inter', sans-serif";
  for (const floater of bronzeState.floaters) {
    context.globalAlpha = Math.max(0, 1 - floater.age / 1.6);
    context.fillStyle = floater.colour;
    context.fillText(floater.text, floater.x, floater.y);
  }
  context.globalAlpha = 1;
}

function setBronzeFrame(now) {
  if (!bronzeState.running) {
    return;
  }
  bronzeState.frame = requestAnimationFrame(setBronzeFrame);
  const seconds = Math.min((now - bronzeState.lastTime) / 1000, 0.05);
  bronzeState.lastTime = now;
  setBronzeOrbMoved(seconds);
  setBronzePackets(seconds);
  setBronzeDrawn(now / 1000);
}

function setBronzeTarget(event) {
  if (!bronzeState.running) {
    return;
  }
  const box = bronzeCanvas.getBoundingClientRect();
  bronzeState.target.x = event.clientX - box.left;
  bronzeState.target.y = event.clientY - box.top;
}

function getBronzeKey(event) {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    return "left";
  }
  if (key === "arrowright" || key === "d") {
    return "right";
  }
  if (key === "arrowup" || key === "w") {
    return "up";
  }
  if (key === "arrowdown" || key === "s") {
    return "down";
  }
  return null;
}

bronzeCanvas.addEventListener("pointermove", setBronzeTarget);
bronzeCanvas.addEventListener("pointerdown", setBronzeTarget);
window.addEventListener("keydown", function (event) {
  const key = getBronzeKey(event);
  if (key && bronzeState.running) {
    bronzeState.keys[key] = true;
    event.preventDefault();   // the arrows steer the orb, not the page
  }
});
window.addEventListener("keyup", function (event) {
  const key = getBronzeKey(event);
  if (key) {
    bronzeState.keys[key] = false;
  }
});
window.addEventListener("resize", function () {
  if (bronzeState.running) {
    setBronzeSize();
  }
});

// =============================================================================
// 3. Silver: clean the rows
// =============================================================================

const silverRaw = document.querySelector(".silver-raw");
const silverChoices = document.querySelector(".silver-choices");
const silverWhy = document.querySelector(".silver-why");
const silverNext = document.querySelector(".silver-next");
const silverState = { index: 0 };

function setSilverLevel() {
  silverState.index = 0;
  setSilverRowShown();
}

function setSilverRowShown() {
  const row = SILVER_ROWS[silverState.index];
  document.querySelector(".silver-count").textContent = "Field " + (silverState.index + 1) + " of " + SILVER_ROWS.length + " · raw, from bronze";
  silverRaw.textContent = row.raw;
  silverRaw.classList.remove("is-clean");
  document.querySelector(".silver-problem").textContent = row.problem;
  silverWhy.textContent = "";
  silverWhy.className = "why silver-why";
  silverNext.hidden = true;

  silverChoices.textContent = "";
  for (const choice of row.choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = choice.label;
    button.addEventListener("click", function () {
      setSilverChoice(button, choice, row);
    });
    silverChoices.appendChild(button);
  }
}

function setSilverChoice(button, choice, row) {
  silverWhy.textContent = choice.why;
  if (!choice.correct) {
    button.disabled = true;
    button.classList.add("is-wrong");
    silverWhy.className = "why silver-why is-wrong";
    setShaken(silverRaw);
    return;
  }
  button.classList.add("is-right");
  for (const other of silverChoices.querySelectorAll(".choice")) {
    other.disabled = true;
  }
  silverWhy.className = "why silver-why is-right";
  silverRaw.textContent = row.clean;
  silverRaw.classList.add("is-clean");
  document.querySelector(".silver-count").textContent = "Field " + (silverState.index + 1) + " of " + SILVER_ROWS.length + " · clean, in silver";
  if (silverState.index === SILVER_ROWS.length - 1) {
    silverNext.textContent = "See how it really works";
  } else {
    silverNext.textContent = "Next field";
  }
  silverNext.hidden = false;
  silverNext.focus({ preventScroll: true });
}

silverNext.addEventListener("click", function () {
  silverState.index += 1;
  if (silverState.index >= SILVER_ROWS.length) {
    silverNext.hidden = true;
    setLessonShown("silver");
  } else {
    setSilverRowShown();
  }
});

// =============================================================================
// 4. Classes: add a new report
// =============================================================================

const classesChips = document.querySelector(".classes-chips");
const classesWhy = document.querySelector(".classes-why");
const classesWrite = document.querySelector(".classes-write");
const classesResult = document.querySelector(".classes-result");

function setClassesLevel() {
  classesChips.textContent = "";
  classesWhy.textContent = "";
  classesResult.hidden = true;
  classesWrite.hidden = false;
  for (let i = 0; i < CLASS_PARTS.length; i++) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.part = String(i);
    chip.setAttribute("aria-pressed", "false");
    chip.textContent = CLASS_PARTS[i].label;
    chip.addEventListener("click", function () {
      const pressed = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!pressed));
    });
    classesChips.appendChild(chip);
  }
}

function setClassWritten() {
  const chips = classesChips.querySelectorAll(".chip");
  const notes = [];
  for (const chip of chips) {
    const part = CLASS_PARTS[Number(chip.dataset.part)];
    const picked = chip.getAttribute("aria-pressed") === "true";
    if (picked && !part.needed) {
      notes.push({ text: "Not needed: " + part.why, kind: "is-wrong" });
    } else if (!picked && part.needed) {
      notes.push({ text: "Missing: " + part.why, kind: "is-wrong" });
    }
  }

  classesWhy.textContent = "";
  if (notes.length > 0) {
    for (const note of notes) {
      const item = document.createElement("li");
      item.className = note.kind;
      item.textContent = note.text;
      classesWhy.appendChild(item);
    }
    setShaken(classesChips);
    return;
  }

  for (const chip of chips) {
    chip.disabled = true;
  }
  const item = document.createElement("li");
  item.className = "is-right";
  item.textContent = "Exactly: a path and the columns. Downloading, saving, gap-filling and logging all come from Endpoint.";
  classesWhy.appendChild(item);
  classesWrite.hidden = true;
  classesResult.hidden = false;
  setTimeout(function () {
    setLessonShown("classes");
  }, 1400);
}

classesWrite.addEventListener("click", setClassWritten);

// =============================================================================
// 5. The night
// =============================================================================

const nightClock = document.querySelector(".night-clock");
const nightDecision = document.querySelector(".night-decision");
const nightChoices = document.querySelector(".night-choices");
const nightWhy = document.querySelector(".night-why");
const nightLog = document.querySelector(".night-log");
const nightStart = document.querySelector(".night-start");
const nightAgain = document.querySelector(".night-again");
// runId changes whenever a run is stopped, so a run still waiting on a pause
// knows to give up.
const nightState = { runId: 0, resolveDecision: null };

function getNightStage(name) {
  return document.querySelector('.night-stage[data-stage="' + name + '"]');
}

function setStageState(name, percent, kind, detail) {
  const stage = getNightStage(name);
  stage.querySelector(".stage-fill").style.width = percent + "%";
  stage.classList.remove("is-ok", "is-warn", "is-failed");
  if (kind) {
    stage.classList.add(kind);
  }
  if (detail) {
    stage.querySelector(".stage-detail").textContent = detail;
  }
}

function setNightLogLine(text, kind) {
  const item = document.createElement("li");
  item.className = kind;
  item.textContent = text;
  nightLog.appendChild(item);
}

function setNightBoardReset(showGaps) {
  const names = ["gaps", "bronze", "silver", "gold", "diagnostics"];
  for (const name of names) {
    setStageState(name, 0, null, "waiting");
  }
  getNightStage("gaps").hidden = !showGaps;
  nightClock.textContent = getClockText(0);
  nightLog.textContent = "";
  nightDecision.hidden = true;
}

function setNightLevel() {
  setNightBoardReset(false);
  nightStart.hidden = false;
  nightAgain.hidden = true;
}

function setNightStopped() {
  nightState.runId += 1;
  nightState.resolveDecision = null;
}

function getStagePause() {
  if (gameMotion.matches) {
    return 60;
  }
  return GAME.stageSeconds * 1000 / 8;
}

// Fills a stage in eight steps, moving the clock on. Returns false if the run
// was stopped part way.
async function getStageFilled(runId, name, fromPercent, toPercent, clockFrom, clockTo, getDetail) {
  for (let step = 1; step <= 8; step++) {
    await getPause(getStagePause());
    if (runId !== nightState.runId) {
      return false;
    }
    const percent = fromPercent + (toPercent - fromPercent) * step / 8;
    let detail = null;
    if (getDetail) {
      detail = getDetail(percent);
    }
    setStageState(name, percent, null, detail);
    nightClock.textContent = getClockText(Math.round(clockFrom + (clockTo - clockFrom) * step / 8));
  }
  return true;
}

function getNightDecision() {
  nightDecision.hidden = false;
  nightWhy.textContent = "";
  nightWhy.className = "why night-why";
  nightChoices.textContent = "";
  for (const choice of NIGHT_CHOICES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = choice.label;
    button.addEventListener("click", function () {
      setNightChoice(button, choice);
    });
    nightChoices.appendChild(button);
  }
  nightDecision.scrollIntoView({ behavior: getScrollBehaviour(), block: "nearest" });
  nightChoices.querySelector(".choice").focus({ preventScroll: true });
  return new Promise(function (resolve) {
    nightState.resolveDecision = resolve;
  });
}

function setNightChoice(button, choice) {
  nightWhy.textContent = choice.why;
  if (!choice.correct) {
    button.disabled = true;
    button.classList.add("is-wrong");
    nightWhy.className = "why night-why is-wrong";
    return;
  }
  button.classList.add("is-right");
  for (const other of nightChoices.querySelectorAll(".choice")) {
    other.disabled = true;
  }
  nightWhy.className = "why night-why is-right";
  if (nightState.resolveDecision) {
    nightState.resolveDecision();
    nightState.resolveDecision = null;
  }
}

async function setFirstNightRun() {
  const runId = nightState.runId;
  nightStart.hidden = true;
  setNightBoardReset(false);

  // Bronze: downloads count up until the waste report fails.
  const failAt = 60;
  const reached = await getStageFilled(runId, "bronze", 0, failAt, 0, 4, function (percent) {
    return Math.round(56 * percent / 100) + " / 56 downloaded";
  });
  if (!reached) {
    return;
  }
  setStageState("bronze", failAt, "is-warn", "34 / 56 · waste report: download FAILED");
  await getNightDecision();
  if (runId !== nightState.runId) {
    return;
  }
  await getPause(600);

  if (!await getStageFilled(runId, "bronze", failAt, 100, 4, 6, function (percent) {
    return Math.round(56 * percent / 100) - 1 + " / 56 downloaded";
  })) {
    return;
  }
  setStageState("bronze", 100, "is-warn", "55 loaded · 1 failed (waste)");

  if (!await getStageFilled(runId, "silver", 0, 100, 6, 9, null)) {
    return;
  }
  setStageState("silver", 100, "is-warn", "57 rebuilt · waste kept yesterday's data");

  if (!await getStageFilled(runId, "gold", 0, 100, 9, 12, null)) {
    return;
  }
  setStageState("gold", 100, "is-warn", "14 rebuilt · Waste & shrink kept yesterday's, flagged");

  if (!await getStageFilled(runId, "diagnostics", 0, 100, 12, 13, null)) {
    return;
  }
  setStageState("diagnostics", 100, "is-failed", "run log written");

  const lines = [
    { text: "Reports: 55 of 56 downloaded and saved to bronze", kind: "is-ok" },
    { text: "waste: download failed; its silver and gold tables kept yesterday's data", kind: "is-warn" },
  ];
  if (gameState.emptyWarnings > 0) {
    lines.push({ text: gameState.emptyWarnings + " empty download(s) flagged (the ones you caught)", kind: "is-warn" });
  }
  lines.push({ text: "Row counts and freshness logged for all 73 tables", kind: "is-ok" });
  lines.push({ text: "Run marked FAILED, so nobody can miss it in the morning", kind: "is-failed" });
  for (const line of lines) {
    await getPause(getStagePause() * 2);
    if (runId !== nightState.runId) {
      return;
    }
    setNightLogLine(line.text, line.kind);
  }
  nightAgain.hidden = false;
  nightAgain.focus({ preventScroll: true });
}

async function setSecondNightRun() {
  const runId = nightState.runId;
  nightAgain.hidden = true;
  setNightBoardReset(true);

  // The waste day plus anything missed in level 2.
  const missing = 1 + gameState.missedDownloads;
  let fetched = missing;
  if (fetched > GAME.gapFillMax) {
    fetched = GAME.gapFillMax;
  }

  if (!await getStageFilled(runId, "gaps", 0, 100, 0, 1, function () {
    return "looking back to January 2024...";
  })) {
    return;
  }
  let gapText = "found " + missing + " missing day(s) · fetching " + fetched;
  if (missing > fetched) {
    gapText += " tonight, the rest tomorrow";
  }
  setStageState("gaps", 100, "is-ok", gapText);

  if (!await getStageFilled(runId, "bronze", 0, 100, 1, 6, function (percent) {
    return Math.round(56 * percent / 100) + " / 56 downloaded + " + fetched + " missing day(s)";
  })) {
    return;
  }
  setStageState("bronze", 100, "is-ok", "56 / 56 loaded · " + fetched + " missing day(s) filled");

  if (!await getStageFilled(runId, "silver", 0, 100, 6, 9, null)) {
    return;
  }
  setStageState("silver", 100, "is-ok", "58 / 58 rebuilt");

  if (!await getStageFilled(runId, "gold", 0, 100, 9, 12, null)) {
    return;
  }
  setStageState("gold", 100, "is-ok", "15 / 15 rebuilt · Waste & shrink caught up");

  if (!await getStageFilled(runId, "diagnostics", 0, 100, 12, 13, null)) {
    return;
  }
  setStageState("diagnostics", 100, "is-ok", "run log written");

  const lines = [
    { text: "Gap check: " + fetched + " missing day(s) fetched and rebuilt", kind: "is-ok" },
    { text: "Reports: 56 of 56 downloaded and saved to bronze", kind: "is-ok" },
    { text: "All 73 tables rebuilt; row counts and freshness logged", kind: "is-ok" },
    { text: "Run SUCCEEDED in 13 minutes", kind: "is-ok" },
  ];
  for (const line of lines) {
    await getPause(getStagePause() * 2);
    if (runId !== nightState.runId) {
      return;
    }
    setNightLogLine(line.text, line.kind);
  }
  await getPause(900);
  if (runId === nightState.runId) {
    setLessonShown("night");
  }
}

nightStart.addEventListener("click", setFirstNightRun);
nightAgain.addEventListener("click", setSecondNightRun);

// =============================================================================
// 6. Switch over: spot the difference
// =============================================================================

const switchOld = document.querySelector(".switch-old");
const switchNew = document.querySelector(".switch-new");
const switchWhy = document.querySelector(".switch-why");
const switchNext = document.querySelector(".switch-next");
const switchState = { round: 0 };

function setSwitchTableHead(table) {
  const head = document.createElement("tr");
  for (const name of SWITCH_COLUMNS) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = name;
    head.appendChild(cell);
  }
  table.appendChild(head);
}

function setSwitchRoundShown() {
  const round = SWITCH_ROUNDS[switchState.round];
  const valueCount = SWITCH_ROWS.length * SWITCH_COLUMNS.length;
  document.querySelector(".switch-count").textContent = "Comparison " + (switchState.round + 1) + " of " + SWITCH_ROUNDS.length + " · " + valueCount + " values";
  switchWhy.textContent = "";
  switchWhy.className = "why switch-why";
  switchNext.hidden = true;
  switchOld.textContent = "";
  switchNew.textContent = "";
  setSwitchTableHead(switchOld);
  setSwitchTableHead(switchNew);

  for (let row = 0; row < SWITCH_ROWS.length; row++) {
    const oldRow = document.createElement("tr");
    const newRow = document.createElement("tr");
    for (let column = 0; column < SWITCH_COLUMNS.length; column++) {
      const oldCell = document.createElement("td");
      const oldValue = document.createElement("span");
      oldValue.textContent = SWITCH_ROWS[row][column];
      oldCell.appendChild(oldValue);
      oldRow.appendChild(oldCell);

      const isChanged = row === round.row && column === round.column;
      const newCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "switch-cell";
      if (isChanged) {
        button.textContent = round.newValue;
      } else {
        button.textContent = SWITCH_ROWS[row][column];
      }
      button.addEventListener("click", function () {
        setSwitchCellPicked(button, oldValue, isChanged);
      });
      newCell.appendChild(button);
      newRow.appendChild(newCell);
    }
    switchOld.appendChild(oldRow);
    switchNew.appendChild(newRow);
  }
}

function setSwitchCellPicked(button, oldValue, isChanged) {
  if (!isChanged) {
    button.classList.add("is-same");
    switchWhy.textContent = "That one matches the old table. Keep looking.";
    switchWhy.className = "why switch-why";
    return;
  }
  button.classList.add("is-diff");
  oldValue.classList.add("is-diff");
  for (const cell of switchNew.querySelectorAll(".switch-cell")) {
    cell.disabled = true;
  }
  switchWhy.textContent = SWITCH_ROUNDS[switchState.round].why;
  switchWhy.className = "why switch-why is-right";
  if (switchState.round === SWITCH_ROUNDS.length - 1) {
    switchNext.textContent = "See how it really works";
  } else {
    switchNext.textContent = "Next comparison";
  }
  switchNext.hidden = false;
  switchNext.focus({ preventScroll: true });
}

function setSwitchLevel() {
  switchState.round = 0;
  setSwitchRoundShown();
}

switchNext.addEventListener("click", function () {
  switchState.round += 1;
  if (switchState.round >= SWITCH_ROUNDS.length) {
    switchNext.hidden = true;
    setLessonShown("switch");
  } else {
    setSwitchRoundShown();
  }
});

// ---------- Start ----------

setNavigationHandlers();
setRouteState();
