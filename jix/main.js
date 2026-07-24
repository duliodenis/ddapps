/* Jix — progressive enhancement only. The site works fully without JS. */
document.documentElement.classList.add("js");

// Compact navigation for viewports where the full link row does not fit.
(function () {
  var button = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (!button || !links) return;

  function closeMenu() {
    links.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation");
  }

  button.addEventListener("click", function () {
    var willOpen = !links.classList.contains("is-open");
    links.classList.toggle("is-open", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
    button.setAttribute("aria-label", willOpen ? "Close navigation" : "Open navigation");
  });

  links.addEventListener("click", function (event) {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && links.classList.contains("is-open")) {
      closeMenu();
      button.focus();
    }
  });

  document.addEventListener("click", function (event) {
    if (!links.contains(event.target) && !button.contains(event.target)) closeMenu();
  });
})();

// Scroll-reveal: sections marked .reveal fade up when they enter the viewport.
(function () {
  var items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || items.length === 0) {
    items.forEach(function (el) { el.classList.add("visible"); });
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  items.forEach(function (el) { io.observe(el); });
})();
