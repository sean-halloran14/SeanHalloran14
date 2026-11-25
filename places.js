// =============================================================================
// Places: the Contents list, for finding your way round the world
// =============================================================================
// The Contents button (top left) opens a list of the places in the world
// (town.js): the company, the university and About me, left to right along
// the shore. Clicking a place flies the orb to its door (flight.js,
// setOrbFlownTo), where the invitation to go inside pops up. Under each
// place are the things inside it; clicking one opens its panel straight
// away (sun.js).
//
// Uses from town.js: townState, getPlaceWorldPoint. From sun.js:
// getPlanetItem, setPanelShown. From flight.js: setOrbFlownTo.
// =============================================================================

const contentsButton = document.querySelector(".contents-button");
const contentsPanel = document.querySelector(".contents");
const contentsList = document.querySelector(".contents-list");

function getContentsButton(index, isInside, onClick) {
  // One entry: its tag and title.
  const item = getPlanetItem(index);
  const button = document.createElement("button");
  button.type = "button";
  button.className = isInside ? "contents-item contents-moon" : "contents-item";
  const tag = document.createElement("small");
  tag.textContent = item.tag;
  button.appendChild(tag);
  button.appendChild(document.createTextNode(item.title));
  button.addEventListener("click", onClick);
  return button;
}

function getPlaceInsides(index) {
  // The items listed under a place's item (its moons).
  const items = document.querySelectorAll(".planet-list > li");
  const insides = [];
  for (let i = index + 1; i < items.length && items[i].dataset.kind === "moon"; i++) {
    insides.push(i);
  }
  return insides;
}

function setContentsList() {
  // Each place, left to right, with what's inside it underneath.
  contentsList.textContent = "";
  const places = townState.places.slice().sort(function (a, b) {
    return a.x - b.x;
  });
  for (const place of places) {
    const row = document.createElement("li");
    const go = getContentsButton(place.item, false, function () {
      setContentsShown(false);
      const point = getPlaceWorldPoint(place);
      if (typeof setOrbFlownTo === "function") {
        setOrbFlownTo(point.x, point.y);
      }
    });
    go.setAttribute("aria-label", "Fly to: " + getPlanetItem(place.item).title);
    const hint = document.createElement("small");
    hint.className = "contents-go";
    hint.textContent = "Fly there";
    go.appendChild(hint);
    row.appendChild(go);
    for (const inside of getPlaceInsides(place.item)) {
      row.appendChild(getContentsButton(inside, true, function () {
        setPanelShown(inside);
      }));
    }
    contentsList.appendChild(row);
  }
}

function setContentsShown(shown) {
  contentsPanel.hidden = !shown;
  contentsButton.setAttribute("aria-expanded", String(shown));
  contentsButton.textContent = shown ? "Hide contents" : "Contents";
  if (shown) {
    setContentsList();
  }
}

contentsButton.addEventListener("click", function () {
  setContentsShown(contentsPanel.hidden);
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && !contentsPanel.hidden) {
    setContentsShown(false);
  }
});
