const header = document.querySelector(".header");
const story = document.querySelector(".story");
const stage = document.querySelector(".story__stage");
const reveals = document.querySelectorAll(".reveal");
const form = document.querySelector("#contact-form");
const status = form.querySelector(".form__status");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

function storyProgress() {
  const scrollable = story.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  const scrolled = Math.min(Math.max(-story.getBoundingClientRect().top, 0), scrollable);
  return scrolled / scrollable;
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
    const narrow = window.innerWidth < 800;
    const ry = narrow ? -8 + p * 24 : -14 + p * 50;
    const rx = narrow ? 4 - p * 3 : 8 - p * 7;
    const zoom = narrow ? 1.26 - p * 0.16 : 1.46 - p * 0.52;
    stage.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    stage.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    stage.style.setProperty("--zoom", `${zoom.toFixed(3)}`);
    stage.style.setProperty("--hint", Math.max(0, 1 - p * 3.4).toFixed(3));
  }

  if (!reduce.matches) {
    reveals.forEach((el) => {
      el.classList.toggle("is-on", p >= Number(el.dataset.at));
    });
  }
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

window.addEventListener("scroll", requestPaint, { passive: true });
window.addEventListener("resize", requestPaint);
reduce.addEventListener("change", requestPaint);
paintHouse();

if (reduce.matches) {
  reveals.forEach((el) => el.classList.add("is-on"));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  form.reset();
  status.textContent = "Hvala na poruci.";
});
