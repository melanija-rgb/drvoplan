const header = document.querySelector(".header");
const menuBtn = document.querySelector(".menu-btn");
const panel = document.querySelector(".nav-panel");
const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll(".nav a, .nav-panel a")];

function onScroll() {
  header.classList.toggle("is-scrolled", window.scrollY > 8);

  const marker = window.innerHeight * 0.52;
  let current = "";
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= marker) current = section.id;
  });

  navLinks.forEach((link) => {
    if (current && link.getAttribute("href") === `#${current}`) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

let ticking = false;
window.addEventListener(
  "scroll",
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onScroll();
      ticking = false;
    });
  },
  { passive: true }
);
onScroll();

function setMenu(open, returnFocus) {
  document.body.classList.toggle("nav-open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  panel.inert = !open;
  if (open) panel.querySelector("a")?.focus();
  else if (returnFocus) menuBtn.focus();
}

menuBtn.addEventListener("click", () => {
  setMenu(!document.body.classList.contains("nav-open"), true);
});

panel.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false, false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
    setMenu(false, true);
  }
});

const desktop = window.matchMedia("(min-width: 861px)");
desktop.addEventListener("change", (event) => {
  if (event.matches) setMenu(false, false);
});

const revealables = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
  );
  revealables.forEach((el) => observer.observe(el));
} else {
  revealables.forEach((el) => el.classList.add("is-in"));
}

const form = document.querySelector("#contact-form");
const status = form.querySelector(".form__status");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  // Slanje još nije povezano.
  form.reset();
  status.textContent = "Hvala na poruci.";
});
