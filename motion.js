(function () {
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const viewButtons = Array.from(document.querySelectorAll("[data-view-target]"));
  const viewLinks = Array.from(document.querySelectorAll("[data-view-link]"));
  const views = Array.from(document.querySelectorAll("[data-view]"));
  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const cards = Array.from(document.querySelectorAll("[data-category]"));
  const hero = document.querySelector(".hero");
  const heroFrame = document.querySelector(".hero-frame");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pointer = {
    currentX: 0,
    currentY: 0,
    targetX: 0,
    targetY: 0,
    raf: 0
  };

  function updateScroll() {
    const scrollTop = window.scrollY || root.scrollTop || 0;
    const scrollable = Math.max(root.scrollHeight - window.innerHeight, 1);
    root.style.setProperty("--scroll-progress", Math.min(scrollTop / scrollable, 1).toFixed(4));
  }

  function setView(viewName, updateHash, shouldScroll) {
    const nextView = viewName === "works" ? "works" : "ip";

    views.forEach((view) => {
      view.classList.toggle("is-active", view.dataset.view === nextView);
    });

    viewButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.viewTarget === nextView);
    });

    viewLinks.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.viewLink === nextView);
    });

    if (updateHash && window.location.hash !== `#${nextView}`) {
      history.pushState(null, "", `#${nextView}`);
    }

    if (header) {
      header.classList.remove("nav-open");
    }

    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }

    updateScroll();

    if (shouldScroll) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  function setFilter(filter) {
    filterButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === filter);
    });

    cards.forEach((card) => {
      const visible = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("is-hidden", !visible);
    });
  }

  function animatePointer() {
    pointer.currentX += (pointer.targetX - pointer.currentX) * 0.12;
    pointer.currentY += (pointer.targetY - pointer.currentY) * 0.12;

    if (heroFrame) {
      heroFrame.style.setProperty("--pointer-x", `${pointer.currentX.toFixed(2)}px`);
      heroFrame.style.setProperty("--pointer-y", `${pointer.currentY.toFixed(2)}px`);
    }

    if (Math.abs(pointer.targetX - pointer.currentX) > 0.1 || Math.abs(pointer.targetY - pointer.currentY) > 0.1) {
      pointer.raf = requestAnimationFrame(animatePointer);
      return;
    }

    pointer.raf = 0;
  }

  function requestPointerFrame() {
    if (!pointer.raf) {
      pointer.raf = requestAnimationFrame(animatePointer);
    }
  }

  if (toggle && header) {
    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.viewTarget, true, true);
    });
  });

  viewLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = link.dataset.viewLink;
      if (target === "ip" || target === "works") {
        event.preventDefault();
        setView(target, true, true);
      }
    });
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setFilter(button.dataset.filter || "all");
    });
  });

  window.addEventListener("hashchange", () => {
    const hashView = window.location.hash.replace("#", "");
    if (hashView === "ip" || hashView === "works") {
      setView(hashView, false, false);
    }
  });

  if (!reduceMotion && hero && heroFrame) {
    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      pointer.targetX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 18;
      pointer.targetY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 12;
      requestPointerFrame();
    });

    hero.addEventListener("pointerleave", () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
      requestPointerFrame();
    });
  }

  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });

    document.querySelectorAll(".reveal, .reveal-group > *").forEach((node, index) => {
      node.style.transitionDelay = `${Math.min(index * 45, 220)}ms`;
      observer.observe(node);
    });
  } else {
    document.querySelectorAll(".reveal, .reveal-group > *").forEach((node) => {
      node.classList.add("is-visible");
    });
  }

  setView(window.location.hash.replace("#", ""), false, false);
  setFilter("all");
  updateScroll();
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", updateScroll);
})();
