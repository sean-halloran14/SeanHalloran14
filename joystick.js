// =============================================================================
// Thumb joystick (touch screens only)
// =============================================================================
// On a phone the orb can't easily be flown past the edge of the screen by
// holding, because a finger can't go further than the glass. This stick sits
// in the bottom corner under the thumb of the hand holding the phone: drag
// the knob and the orb flies that way, faster the further it's pushed
// (flight.js, setFlightStick). The small arrows button swaps it to the other
// side for left-handed use (the stardust meter swaps over too); the choice is
// remembered on this device.
// CSS shows it only on touch screens (styles.css, .joystick).
// =============================================================================

const STICK = {
  deadZone: 0.12,          // share of the reach the knob must move before the orb does
  storageKey: "joystick-side",
};

const joystick = document.querySelector(".joystick");
const joystickBase = document.querySelector(".joystick-base");
const joystickKnob = document.querySelector(".joystick-knob");
const joystickSwap = document.querySelector(".joystick-swap");

const stickState = {
  pointerId: null,         // the finger on the stick, if any
  centreX: 0,              // the base's middle (client px)
  centreY: 0,
  reach: 1,                // how far the knob can travel from the middle, px
  isHidden: false,
};

function setStickPush(clientX, clientY) {
  // Moves the knob under the finger (kept inside the base) and tells
  // flight.js how far it's pushed.
  let dx = clientX - stickState.centreX;
  let dy = clientY - stickState.centreY;
  const distance = Math.hypot(dx, dy);
  if (distance > stickState.reach) {
    dx = dx / distance * stickState.reach;
    dy = dy / distance * stickState.reach;
  }
  joystickKnob.style.transform = "translate(" + dx + "px, " + dy + "px)";

  const push = Math.min(1, distance / stickState.reach);
  if (push < STICK.deadZone) {
    setFlightStick(0, 0);
    return;
  }
  // Rescale so the push starts from 0 just past the dead zone.
  const scaled = (push - STICK.deadZone) / (1 - STICK.deadZone);
  setFlightStick(dx / Math.hypot(dx, dy) * scaled, dy / Math.hypot(dx, dy) * scaled);
}

function setStickStart(event) {
  if (stickState.pointerId !== null || getIsPlainView()) {
    return;
  }
  event.preventDefault();
  const box = joystickBase.getBoundingClientRect();
  stickState.pointerId = event.pointerId;
  stickState.centreX = box.left + box.width / 2;
  stickState.centreY = box.top + box.height / 2;
  stickState.reach = box.width / 2 - joystickKnob.offsetWidth / 4;
  joystickBase.setPointerCapture(event.pointerId);
  joystick.classList.add("is-held");
  setStickPush(event.clientX, event.clientY);
}

function setStickMove(event) {
  if (event.pointerId !== stickState.pointerId) {
    return;
  }
  setStickPush(event.clientX, event.clientY);
}

function setStickEnd(event) {
  if (event.pointerId !== stickState.pointerId) {
    return;
  }
  stickState.pointerId = null;
  joystick.classList.remove("is-held");
  joystickKnob.style.transform = "";
  setFlightStick(0, 0);
}

// ---------- Which hand ----------

function getStoredSide() {
  try {
    return window.localStorage.getItem(STICK.storageKey);
  } catch (error) {
    return null;
  }
}

function setStickSide(side) {
  document.body.classList.toggle("is-stick-left", side === "left");
  joystickSwap.setAttribute("aria-label", side === "left" ? "Move the joystick to the right" : "Move the joystick to the left");
  try {
    window.localStorage.setItem(STICK.storageKey, side);
  } catch (error) {
    // Private browsing, say: it just won't be remembered.
  }
}

function setStickSwapped() {
  const isLeft = document.body.classList.contains("is-stick-left");
  setStickSide(isLeft ? "right" : "left");
}

// ---------- Out of the way when a panel is open ----------

function setStickVisibility() {
  // The planet panel covers the bottom of a phone screen, so the stick
  // steps aside while it's open (and lets go if it was held).
  const hide = typeof getIsPanelOpen === "function" && getIsPanelOpen();
  if (hide !== stickState.isHidden) {
    stickState.isHidden = hide;
    joystick.classList.toggle("is-tucked", hide);
    if (hide && stickState.pointerId !== null) {
      setStickEnd({ pointerId: stickState.pointerId });
    }
  }
  requestAnimationFrame(setStickVisibility);
}

setStickSide(getStoredSide() === "left" ? "left" : "right");
joystickBase.addEventListener("pointerdown", setStickStart);
joystickBase.addEventListener("pointermove", setStickMove);
joystickBase.addEventListener("pointerup", setStickEnd);
joystickBase.addEventListener("pointercancel", setStickEnd);
joystickBase.addEventListener("lostpointercapture", setStickEnd);
joystickBase.addEventListener("contextmenu", function (event) {
  event.preventDefault();
});
joystickSwap.addEventListener("click", setStickSwapped);
requestAnimationFrame(setStickVisibility);
