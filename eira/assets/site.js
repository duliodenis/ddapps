const menuButton = document.querySelector("[data-menu-button]");
const navigation = document.querySelector("[data-navigation]");

if (menuButton && navigation) {
  const closeMenu = () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    navigation.dataset.open = "false";
  };

  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    navigation.dataset.open = String(!isOpen);
  });

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      menuButton.focus();
    }
  });

  window.matchMedia("(min-width: 821px)").addEventListener("change", closeMenu);
}

const carousel = document.querySelector("[data-carousel]");
const carouselControls = document.querySelector("[data-carousel-controls]");

if (carousel && carouselControls) {
  const slides = [...carousel.querySelectorAll("[data-carousel-slide]")]
    .sort((first, second) => Number(first.dataset.slideIndex) - Number(second.dataset.slideIndex));
  const dots = [...carouselControls.querySelectorAll("[data-carousel-dot]")];
  const previousButton = carouselControls.querySelector("[data-carousel-previous]");
  const nextButton = carouselControls.querySelector("[data-carousel-next]");
  const status = carouselControls.querySelector("[data-carousel-status]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeIndex = 0;
  let scrollFrame;

  const updateControls = index => {
    activeIndex = index;
    dots.forEach((dot, dotIndex) => dot.setAttribute("aria-current", String(dotIndex === index)));
    previousButton.disabled = index === 0;
    nextButton.disabled = index === slides.length - 1;
    status.textContent = `${slides[index].dataset.slideTitle} screenshot, ${index + 1} of ${slides.length}`;
  };

  const showSlide = index => {
    const targetIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[targetIndex];
    const left = slide.offsetLeft - (carousel.clientWidth - slide.clientWidth) / 2;
    carousel.scrollTo({ left, behavior: reducedMotion.matches ? "auto" : "smooth" });
    updateControls(targetIndex);
  };

  previousButton.addEventListener("click", () => showSlide(activeIndex - 1));
  nextButton.addEventListener("click", () => showSlide(activeIndex + 1));
  dots.forEach((dot, index) => dot.addEventListener("click", () => showSlide(index)));

  carousel.addEventListener("scroll", () => {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(() => {
      const center = carousel.scrollLeft + carousel.clientWidth / 2;
      const nearestIndex = slides.reduce((nearest, slide, index) => {
        const slideCenter = slide.offsetLeft + slide.clientWidth / 2;
        const nearestSlide = slides[nearest];
        const nearestCenter = nearestSlide.offsetLeft + nearestSlide.clientWidth / 2;
        return Math.abs(slideCenter - center) < Math.abs(nearestCenter - center) ? index : nearest;
      }, 0);
      updateControls(nearestIndex);
    });
  }, { passive: true });

  updateControls(0);
}

const revealItems = [...document.querySelectorAll("[data-reveal]")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (revealItems.length > 0 && "IntersectionObserver" in window && !reduceMotion.matches) {
  revealItems.forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${index * 80}ms`);
    item.classList.add("reveal-pending");
  });

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, {
    threshold: 0.18,
    rootMargin: "0px 0px -6% 0px"
  });

  revealItems.forEach(item => revealObserver.observe(item));
}
