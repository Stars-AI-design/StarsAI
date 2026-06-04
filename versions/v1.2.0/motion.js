(function () {
  const root = document.documentElement;
  const toggle = document.querySelector(".nav-toggle");
  const homeHeader = document.querySelector(".home-header");
  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const artCards = Array.from(document.querySelectorAll(".art-card"));
  const detailPanel = document.querySelector(".detail-panel");
  const characterCarousel = document.querySelector(".character-carousel");
  const characterSlides = Array.from(document.querySelectorAll(".character-slide"));
  const characterButtons = Array.from(document.querySelectorAll("[data-character-target]"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function updateScrollProgress() {
    const scrollTop = window.scrollY || root.scrollTop || 0;
    const scrollable = Math.max(root.scrollHeight - window.innerHeight, 1);
    root.style.setProperty("--scroll-progress", Math.min(scrollTop / scrollable, 1).toFixed(4));
  }

  function closeMobileNav() {
    if (!homeHeader || !toggle) {
      return;
    }

    homeHeader.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  function setFilter(filter) {
    const nextFilter = filter || "all";

    filterButtons.forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.filter === nextFilter && !button.classList.contains("filter-icon")
      );
    });

    let firstVisible = null;

    artCards.forEach((card) => {
      const visible = nextFilter === "all" || card.dataset.category === nextFilter;
      card.classList.toggle("is-hidden", !visible);

      if (visible && !firstVisible) {
        firstVisible = card;
      }
    });

    const current = artCards.find((card) => card.classList.contains("active") && !card.classList.contains("is-hidden"));
    if (!current && firstVisible) {
      setActiveWork(firstVisible);
    }
  }

  function setTags(tags) {
    if (!detailPanel) {
      return;
    }

    const tagBox = detailPanel.querySelector(".detail-tags");
    if (!tagBox) {
      return;
    }

    tagBox.innerHTML = "";
    tags.split(",").filter(Boolean).forEach((tag) => {
      const chip = document.createElement("span");
      chip.textContent = tag.trim();
      tagBox.appendChild(chip);
    });
  }

  function setActiveWork(card) {
    if (!card) {
      return;
    }

    artCards.forEach((item) => {
      item.classList.toggle("active", item === card);
    });

    if (!detailPanel) {
      return;
    }

    const data = card.dataset;
    const thumb = detailPanel.querySelector(".detail-thumb");
    const title = detailPanel.querySelector(".detail-head h2");
    const subtitle = detailPanel.querySelector(".detail-head p");
    const desc = detailPanel.querySelector(".detail-desc");
    const meta = detailPanel.querySelectorAll(".detail-meta dd");
    const detailLink = detailPanel.querySelector(".detail-btn");

    if (thumb) {
      thumb.src = data.image || "";
      thumb.alt = data.title || "";
    }

    if (title) title.textContent = data.title || "";
    if (subtitle) subtitle.textContent = data.subtitle || "";
    if (desc) desc.textContent = data.desc || "";

    if (meta[0]) meta[0].textContent = data.size || "";
    if (meta[1]) meta[1].textContent = data.model || "";
    if (meta[2]) meta[2].textContent = data.tool || "";
    if (meta[3]) meta[3].textContent = data.date || "";
    if (detailLink) detailLink.href = data.image || "#";

    setTags(data.tags || "");
  }

  function setActiveCharacter(id, updateHash) {
    if (!id || !characterSlides.length) {
      return;
    }

    characterButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.characterTarget === id);
    });

    if (updateHash && window.location.hash !== `#${id}`) {
      history.replaceState(null, "", `#${id}`);
    }
  }

  function scrollToCharacter(id, updateHash) {
    const target = characterSlides.find((slide) => slide.dataset.character === id);
    if (!target) {
      return;
    }

    if (characterCarousel) {
      characterCarousel.scrollTo({
        left: target.offsetLeft - characterCarousel.offsetLeft,
        behavior: reduceMotion ? "auto" : "smooth"
      });
    }

    setActiveCharacter(id, updateHash);
  }

  function syncCharacterFromScroll() {
    if (!characterCarousel || !characterSlides.length) {
      return;
    }

    const carouselBox = characterCarousel.getBoundingClientRect();
    const carouselCenter = carouselBox.left + carouselBox.width / 2;
    let closest = characterSlides[0];
    let closestDistance = Infinity;

    characterSlides.forEach((slide) => {
      const box = slide.getBoundingClientRect();
      const slideCenter = box.left + box.width / 2;
      const distance = Math.abs(slideCenter - carouselCenter);

      if (distance < closestDistance) {
        closest = slide;
        closestDistance = distance;
      }
    });

    setActiveCharacter(closest.dataset.character || closest.id, true);
  }

  if (toggle && homeHeader) {
    toggle.addEventListener("click", () => {
      const open = homeHeader.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    document.querySelectorAll(".home-nav a").forEach((link) => {
      link.addEventListener("click", closeMobileNav);
    });
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setFilter(button.dataset.filter || "all");
    });
  });

  artCards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest(".heart")) {
        event.preventDefault();
      }

      setActiveWork(card);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setActiveWork(card);
      }
    });
  });

  characterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      scrollToCharacter(button.dataset.characterTarget, true);
    });
  });

  if (characterCarousel && characterSlides.length) {
    let characterScrollFrame = 0;

    characterCarousel.addEventListener("scroll", () => {
      if (characterScrollFrame) {
        cancelAnimationFrame(characterScrollFrame);
      }

      characterScrollFrame = requestAnimationFrame(() => {
        syncCharacterFromScroll();
        characterScrollFrame = 0;
      });
    }, { passive: true });

    window.addEventListener("hashchange", () => {
      const hashId = window.location.hash.replace("#", "");
      if (hashId) {
        scrollToCharacter(hashId, false);
      }
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
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });

    document.querySelectorAll(".reveal, .reveal-group > *").forEach((node, index) => {
      node.style.transitionDelay = `${Math.min(index * 45, 220)}ms`;
      observer.observe(node);
    });
  } else {
    document.querySelectorAll(".reveal, .reveal-group > *").forEach((node) => {
      node.classList.add("is-visible");
    });
  }

  const defaultActive = document.querySelector(".art-card.active-target") || artCards[0];
  setActiveWork(defaultActive);
  setFilter("all");
  if (characterSlides.length) {
    const hashId = window.location.hash.replace("#", "");
    const initialId = characterSlides.some((slide) => slide.dataset.character === hashId)
      ? hashId
      : characterSlides[0].dataset.character;
    window.setTimeout(() => scrollToCharacter(initialId, false), 0);
  }
  updateScrollProgress();
  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  window.addEventListener("resize", updateScrollProgress);
})();
