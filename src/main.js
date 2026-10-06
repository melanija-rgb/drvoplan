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
const nameCard = document.querySelector(".panel--name");
const featureList = document.querySelector(".panel--features");
const house = document.querySelector(".house");

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

  if (reduce.matches || stage.querySelector("spline-viewer")) {
    stage.style.removeProperty("--ry");
    stage.style.removeProperty("--rx");
    stage.style.removeProperty("--zoom");
    stage.style.removeProperty("--hint");
  } else {
    if (narrowScreen.matches) {
      stage.style.setProperty("--ry", "0deg");
      stage.style.setProperty("--rx", "0deg");
      stage.style.setProperty("--zoom", "1");
    } else {
      const zoom = 1 + p * 0.03;
      stage.style.setProperty("--ry", "0deg");
      stage.style.setProperty("--rx", "0deg");
      stage.style.setProperty("--zoom", zoom.toFixed(3));
    }
    stage.style.setProperty("--hint", Math.max(0, 1 - p * 3.4).toFixed(3));
  }

  if (!reduce.matches) {
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

const nativePhoto = { w: 568, h: 606 };

function alignDesktopPhoto() {
  if (narrowScreen.matches || reduce.matches) {
    stage.style.removeProperty("--photo-top");
    stage.style.removeProperty("--photo-height");
    stage.style.removeProperty("--photo-w");
    stage.style.removeProperty("--photo-h");
    return;
  }

  const stageRect = stage.getBoundingClientRect();
  const nameRect = nameCard.getBoundingClientRect();
  const featureRect = featureList.getBoundingClientRect();
  const columnWidth = house.getBoundingClientRect().width;
  const textTop = nameRect.top - stageRect.top;
  const textHeight = featureRect.bottom - nameRect.top;
  const textCenter = textTop + textHeight / 2;
  const ratio = nativePhoto.w / nativePhoto.h;
  const headerHeight = header.getBoundingClientRect().height;
  const factsTop = facts.offsetTop;
  const minTop = headerHeight + 18;
  const maxBottom = factsTop - 28;
  const maxHeight = Math.min((textCenter - minTop) * 2, (maxBottom - textCenter) * 2, nativePhoto.h * 1.9) / 1.03;
  const maxWidth = Math.min(columnWidth, nativePhoto.w * 1.9) / 1.03;

  let photoHeight = Math.min(textHeight, maxHeight);
  let photoWidth = photoHeight * ratio;

  if (columnWidth - photoWidth > 220 && maxHeight > photoHeight) {
    photoWidth = Math.min(maxWidth, columnWidth);
    photoHeight = photoWidth / ratio;
    if (photoHeight > maxHeight) {
      photoHeight = maxHeight;
      photoWidth = photoHeight * ratio;
    }
  }

  if (photoWidth > maxWidth) {
    photoWidth = maxWidth;
    photoHeight = photoWidth / ratio;
  }

  stage.style.setProperty("--photo-top", `${textTop}px`);
  stage.style.setProperty("--photo-height", `${textHeight}px`);
  stage.style.setProperty("--photo-w", `${photoWidth}px`);
  stage.style.setProperty("--photo-h", `${photoHeight}px`);
}

window.addEventListener("scroll", requestPaint, { passive: true });
window.addEventListener("resize", () => {
  alignDesktopPhoto();
  requestPaint();
});
reduce.addEventListener("change", () => {
  alignDesktopPhoto();
  requestPaint();
});
narrowScreen.addEventListener("change", alignDesktopPhoto);
paintHouse();
alignDesktopPhoto();
document.fonts.ready.then(alignDesktopPhoto);

if (reduce.matches) {
  reveals.forEach((el) => el.classList.add("is-on"));
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
