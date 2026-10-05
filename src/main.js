const header = document.querySelector(".header");
const story = document.querySelector(".story");
const stage = document.querySelector(".story__stage");
const reveals = document.querySelectorAll(".reveal");
const form = document.querySelector("#contact-form");
const status = form.querySelector(".form__status");
const toTop = document.querySelector(".to-top");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

function storyProgress() {
  const scrollable = story.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  const scrolled = Math.min(Math.max(-story.getBoundingClientRect().top, 0), scrollable);
  return scrolled / scrollable;
}

function paintHouse() {
  header.classList.toggle("is-scrolled", window.scrollY > 8);
  toTop.classList.toggle("is-on", window.scrollY > window.innerHeight);

  const p = storyProgress();

  if (reduce.matches || stage.querySelector("spline-viewer")) {
    stage.style.removeProperty("--ry");
    stage.style.removeProperty("--rx");
    stage.style.removeProperty("--zoom");
    stage.style.removeProperty("--hint");
  } else {
    const narrow = window.innerWidth < 800;
    const ry = narrow ? -10 + p * 36 : -18 + p * 56;
    const rx = narrow ? 3 - p * 1 : 6 - p * 3;
    const zoom = narrow ? 1.2 - p * 0.28 : 1.18 - p * 0.42;
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

toTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: reduce.matches ? "auto" : "smooth" });
});

window.addEventListener("scroll", requestPaint, { passive: true });
window.addEventListener("resize", requestPaint);
reduce.addEventListener("change", requestPaint);
paintHouse();

if (reduce.matches) {
  reveals.forEach((el) => el.classList.add("is-on"));
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
