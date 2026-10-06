const header = document.querySelector(".header");
const story = document.querySelector(".story");
const stage = document.querySelector(".story__stage");
const reveals = document.querySelectorAll(".reveal");
const form = document.querySelector("#contact-form");
const status = form.querySelector(".form__status");
const toTop = document.querySelector(".to-top");
const facts = document.querySelector(".facts");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const narrowScreen = window.matchMedia("(max-width: 800px)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const house = document.querySelector(".house");
const turnKeys = [
  [0, 0],
  [0.25, 20],
  [0.5, 90],
  [0.75, 135],
  [1, 180],
];

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function rotationFor(progress) {
  const p = Math.min(1, Math.max(0, progress));
  for (let i = 0; i < turnKeys.length - 1; i += 1) {
    const [start, from] = turnKeys[i];
    const [end, to] = turnKeys[i + 1];
    if (p <= end) {
      return from + (to - from) * smoothstep((p - start) / (end - start));
    }
  }
  return 180;
}

function storyProgress() {
  const scrollable = story.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  const scrolled = Math.min(Math.max(-story.getBoundingClientRect().top, 0), scrollable);
  return scrolled / scrollable;
}

function intersects(a, b) {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}

function factsInView() {
  if (!facts.classList.contains("is-on")) return false;
  return intersects(facts.getBoundingClientRect(), {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  });
}

function coversAControl() {
  const button = toTop.getBoundingClientRect();
  return [...form.querySelectorAll("input:not([name=website]), textarea, button")].some((control) => {
    return intersects(button, control.getBoundingClientRect());
  });
}

function paintHouse() {
  header.classList.toggle("is-scrolled", window.scrollY > 8);

  const p = storyProgress();
  const narrow = narrowScreen.matches;
  const mobileReduce = reduce.matches && narrow;

  if (stage.querySelector("spline-viewer") || mobileReduce) {
    stage.style.removeProperty("--ry");
    stage.style.removeProperty("--rx");
    stage.style.removeProperty("--zoom");
    stage.style.removeProperty("--hint");
    targetTurn = 0;
    targetTilt = 0;
    targetNudge = 0;
  } else if (narrow) {
    stage.style.setProperty("--ry", "0deg");
    stage.style.setProperty("--rx", "0deg");
    stage.style.setProperty("--zoom", "1");
    targetTurn = 0;
    targetTilt = 0;
    targetNudge = 0;
    stage.style.setProperty("--hint", Math.max(0, 1 - p * 3.4).toFixed(3));
  } else {
    stage.style.setProperty("--ry", "0deg");
    stage.style.setProperty("--rx", "0deg");
    stage.style.setProperty("--zoom", "1");
    targetTurn = rotationFor(p);
    if (reduce.matches) {
      targetTilt = 0;
      targetNudge = 0;
    }
    stage.style.setProperty("--hint", Math.max(0, 1 - p * 3.4).toFixed(3));
  }

  if (!mobileReduce) {
    reveals.forEach((el) => {
      el.classList.toggle("is-on", p >= Number(el.dataset.at));
    });
  }

  toTop.classList.toggle(
    "is-on",
    window.scrollY > window.innerHeight && !factsInView() && !coversAControl(),
  );
}

let ticking = false;
function requestPaint() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    paintHouse();
    ticking = false;
  });
}

toTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: reduce.matches ? "auto" : "smooth" });
});

const navToggle = document.querySelector(".nav-toggle");
const navPanel = document.querySelector("#nav-meni");

function setNav(open) {
  navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  navPanel.classList.toggle("is-open", open);
}

navToggle.addEventListener("click", () => {
  setNav(navToggle.getAttribute("aria-expanded") !== "true");
});

navPanel.addEventListener("click", (event) => {
  if (event.target.closest("a")) setNav(false);
});

document.addEventListener("click", (event) => {
  if (navToggle.contains(event.target) || navPanel.contains(event.target)) return;
  setNav(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setNav(false);
});

window.matchMedia("(max-width: 800px)").addEventListener("change", () => setNav(false));

let targetTurn = 0;
let currentTurn = 0;
let targetTilt = 0;
let currentTilt = 0;
let targetNudge = 0;
let currentNudge = 0;

function clearTurn() {
  house.style.removeProperty("--turn");
  house.style.removeProperty("--tilt");
  house.style.removeProperty("--turn-scale");
  house.style.removeProperty("--edge");
  house.style.removeProperty("--swing");
}

function applyTurn(shown) {
  const edge = Math.abs(Math.sin((shown * Math.PI) / 180));
  const scale = 1 - edge * 0.06;
  house.style.setProperty("--turn", `${shown.toFixed(2)}deg`);
  house.style.setProperty("--tilt", `${currentTilt.toFixed(2)}deg`);
  house.style.setProperty("--turn-scale", scale.toFixed(3));
  house.style.setProperty("--edge", edge.toFixed(3));
  house.style.setProperty("--swing", Math.sin((shown * Math.PI) / 180).toFixed(3));
}

function tickTurn() {
  const desktop = !narrowScreen.matches && !stage.querySelector("spline-viewer");
  if (desktop) {
    if (reduce.matches) {
      currentTurn = targetTurn;
      currentTilt = 0;
      currentNudge = 0;
    } else {
      currentTurn += (targetTurn - currentTurn) * 0.14;
      currentTilt += (targetTilt - currentTilt) * 0.08;
      currentNudge += (targetNudge - currentNudge) * 0.08;
    }
    applyTurn(currentTurn + currentNudge);
  } else if (house.style.getPropertyValue("--turn")) {
    clearTurn();
  }
  requestAnimationFrame(tickTurn);
}

window.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" || !finePointer.matches || narrowScreen.matches || reduce.matches) {
    targetTilt = 0;
    targetNudge = 0;
    return;
  }
  const rect = stage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  targetTilt = Math.max(-3, Math.min(3, y * -6));
  targetNudge = Math.max(-3, Math.min(3, x * 6));
});

window.addEventListener("blur", () => {
  targetTilt = 0;
  targetNudge = 0;
});

window.addEventListener("scroll", requestPaint, { passive: true });
window.addEventListener("resize", requestPaint);
reduce.addEventListener("change", requestPaint);
narrowScreen.addEventListener("change", requestPaint);
paintHouse();
requestAnimationFrame(tickTurn);

if (reduce.matches) {
  if (narrowScreen.matches) {
    reveals.forEach((el) => el.classList.add("is-on"));
  }
  toTop.classList.toggle(
    "is-on",
    window.scrollY > window.innerHeight && !factsInView() && !coversAControl(),
  );
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  status.classList.remove("is-error");
  status.textContent = "Šaljem…";

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { accept: "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    status.classList.toggle("is-error", !response.ok);
    status.textContent = data.poruka || (response.ok
      ? "Hvala. Upit je poslat."
      : "Upit nije poslat. Pokušajte ponovo.");
    if (response.ok) form.reset();
  } catch {
    status.classList.add("is-error");
    status.textContent = "Upit nije poslat. Pokušajte ponovo.";
  } finally {
    button.disabled = false;
  }
});
