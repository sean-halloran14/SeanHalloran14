// =============================================================================
// Plain one-page view
// =============================================================================
// "Just show me the work" hides the game and shows every planet's content as
// plain cards on an ordinary scrolling page (styles.css, html.is-plain). The
// cards are the hidden planet list itself, so there is one copy of the words.
// The view can be linked to directly with #work. The game pauses while it's
// shown (getIsPlainView in background.js).
// =============================================================================

const plainButton = document.querySelector(".plain-button");

function setPlainView(plain) {
  document.documentElement.classList.toggle("is-plain", plain);
  if (plain) {
    plainButton.textContent = "Back to the planets";
    window.scrollTo(0, 0);
    history.replaceState(null, "", "#work");
    if (typeof setPanelHidden === "function") {
      setPanelHidden();
    }
  } else {
    plainButton.textContent = "Just show me the work";
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (typeof setCameraOnOrb === "function") {
      setCameraOnOrb(false);   // back to the orb at once
    }
  }
}

plainButton.addEventListener("click", function () {
  setPlainView(!getIsPlainView());
});
if (window.location.hash === "#work") {
  setPlainView(true);
}
