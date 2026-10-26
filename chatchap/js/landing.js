// Landing interactions only. Chat is a normal link; no model or film loads here.
/* ------------------------------------------------------------------ nav */

const nav = document.querySelector("[data-nav]");
if (nav) {
  const sync = () => {
    nav.dataset.scrolled = String(window.scrollY > 24);
  };
  sync();
  window.addEventListener("scroll", sync, { passive: true });
}


/* --------------------------------------------------- the mascot rig */

const mascot = document.querySelector("[data-mascot]");
const expressionLabel = document.querySelector("[data-expression-label]");
const traits = Array.from(document.querySelectorAll("[data-trait]"));

if (mascot) {
  // The SVG is the same file as the downloadable asset; fetching it keeps a
  // single source of truth. If the fetch fails (file:// without a server),
  // the <img> fallback already in the markup stays visible.
  fetch("assets/chatchap-mascot.svg")
    .then((response) => (response.ok ? response.text() : Promise.reject()))
    .then((markup) => {
      mascot.innerHTML = markup;
      const svg = mascot.querySelector("svg");
      if (svg) {
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.removeAttribute("role");
        svg.removeAttribute("aria-labelledby");
      }
    })
    .catch(() => {
      /* fallback image remains */
    });

  let pinned = mascot.dataset.expression || "confident";

  const apply = (expression) => {
    mascot.dataset.expression = expression;
    if (expressionLabel) expressionLabel.textContent = expression;
  };

  const preview = (expression) => () => apply(expression);
  const reset = () => apply(pinned);

  traits.forEach((trait) => {
    const expression = trait.dataset.setExpression;
    trait.addEventListener("mouseenter", preview(expression));
    trait.addEventListener("focus", preview(expression));
    trait.addEventListener("mouseleave", reset);
    trait.addEventListener("blur", reset);
    trait.addEventListener("click", () => {
      pinned = expression;
      traits.forEach((other) =>
        other.setAttribute("aria-pressed", String(other === trait)),
      );
      apply(pinned);
    });
  });
}

