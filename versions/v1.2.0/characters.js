(function () {
  const root = document.documentElement;
  const toggle = document.querySelector(".nav-toggle");
  const homeHeader = document.querySelector(".home-header");
  const characterCarousel = document.querySelector(".character-carousel");
  const characterSlides = Array.from(document.querySelectorAll(".character-slide"));
  const characterButtons = Array.from(document.querySelectorAll("[data-character-target]"));
  const characterIntro = document.querySelector(".character-intro");
  const characterAvatarNav = document.querySelector(".character-avatar-nav");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const galleryDelay = 5000;
  const clickDelay = 10000;
  const galleries = new Map();
  let activeCharacterId = "";
  let galleryTimer = 0;
  let avatarFloatPoint = 0;
  let avatarDrag = null;
  let suppressAvatarClick = false;

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

  function measureAvatarFloatPoint() {
    if (!characterIntro) {
      return;
    }

    const currentScroll = window.scrollY || root.scrollTop || 0;
    const introBox = characterIntro.getBoundingClientRect();
    avatarFloatPoint = currentScroll + introBox.top + introBox.height - 10;
  }

  function updateAvatarFloat() {
    if (!characterAvatarNav || !characterIntro) {
      return;
    }

    const scrollTop = window.scrollY || root.scrollTop || 0;
    const shouldFloat = scrollTop > avatarFloatPoint;
    const isFloating = characterAvatarNav.classList.contains("is-floating");

    if (shouldFloat === isFloating) {
      return;
    }

    const fromBox = characterAvatarNav.getBoundingClientRect();
    characterAvatarNav.classList.toggle("is-floating", shouldFloat);

    if (!shouldFloat) {
      characterAvatarNav.classList.remove("is-dragging");
      characterAvatarNav.style.left = "";
      characterAvatarNav.style.top = "";
      characterAvatarNav.style.right = "";
      characterAvatarNav.style.transform = "";
      avatarDrag = null;
    }

    animateAvatarModule(fromBox);
  }

  function animateAvatarModule(fromBox) {
    if (reduceMotion || !characterAvatarNav || !fromBox || typeof characterAvatarNav.animate !== "function") {
      return;
    }

    const toBox = characterAvatarNav.getBoundingClientRect();
    const dx = fromBox.left - toBox.left;
    const dy = fromBox.top - toBox.top;
    const sx = fromBox.width / Math.max(toBox.width, 1);
    const sy = fromBox.height / Math.max(toBox.height, 1);

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.02 && Math.abs(sy - 1) < 0.02) {
      return;
    }

    characterAvatarNav.animate([
      {
        transformOrigin: "top left",
        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        opacity: 0.9
      },
      {
        transformOrigin: "top left",
        transform: "translate(0, 0) scale(1)",
        opacity: 1
      }
    ], {
      duration: 320,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
    });
  }

  function clampAvatarPosition(left, top) {
    if (!characterAvatarNav) {
      return { left, top };
    }

    const box = characterAvatarNav.getBoundingClientRect();
    const margin = 10;
    const maxLeft = Math.max(window.innerWidth - box.width - margin, margin);
    const maxTop = Math.max(window.innerHeight - box.height - margin, margin);

    return {
      left: Math.min(Math.max(left, margin), maxLeft),
      top: Math.min(Math.max(top, margin), maxTop)
    };
  }

  function setAvatarPosition(left, top) {
    if (!characterAvatarNav) {
      return;
    }

    const next = clampAvatarPosition(left, top);
    characterAvatarNav.style.left = `${next.left}px`;
    characterAvatarNav.style.top = `${next.top}px`;
    characterAvatarNav.style.right = "auto";
    characterAvatarNav.style.transform = "none";
  }

  function startAvatarDrag(event) {
    if (!characterAvatarNav || !characterAvatarNav.classList.contains("is-floating")) {
      return;
    }

    const box = characterAvatarNav.getBoundingClientRect();
    avatarDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: box.left,
      top: box.top,
      moved: false
    };
    characterAvatarNav.setPointerCapture?.(event.pointerId);
  }

  function moveAvatarDrag(event) {
    if (!avatarDrag || avatarDrag.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - avatarDrag.startX;
    const dy = event.clientY - avatarDrag.startY;

    if (!avatarDrag.moved && Math.hypot(dx, dy) < 5) {
      return;
    }

    avatarDrag.moved = true;
    characterAvatarNav?.classList.add("is-dragging");
    setAvatarPosition(avatarDrag.left + dx, avatarDrag.top + dy);
    event.preventDefault();
  }

  function endAvatarDrag(event) {
    if (!avatarDrag || avatarDrag.pointerId !== event.pointerId) {
      return;
    }

    if (avatarDrag.moved) {
      suppressAvatarClick = true;
      window.setTimeout(() => {
        suppressAvatarClick = false;
      }, 180);
    }

    characterAvatarNav?.classList.remove("is-dragging");
    characterAvatarNav?.releasePointerCapture?.(event.pointerId);
    avatarDrag = null;
  }

  function getGallery(slide) {
    if (!slide) {
      return null;
    }

    const id = slide.dataset.character;
    if (!id) {
      return null;
    }

    if (galleries.has(id)) {
      return galleries.get(id);
    }

    const poster = slide.querySelector(".character-poster");
    const posterImage = poster?.querySelector("img");
    const thumbs = Array.from(slide.querySelectorAll("[data-preview-src]"));
    const items = thumbs.map((thumb) => ({
      thumb,
      src: thumb.dataset.previewSrc || thumb.querySelector("img")?.getAttribute("src") || "",
      alt: thumb.dataset.previewAlt || thumb.querySelector("img")?.getAttribute("alt") || "",
      type: thumb.classList.contains("character-sticker-card") ? "sticker" : "work"
    })).filter((item) => item.src);

    const gallery = { id, slide, poster, posterImage, thumbs, items, index: 0 };
    galleries.set(id, gallery);
    return gallery;
  }

  function setGalleryImage(gallery, index) {
    if (!gallery || !gallery.items.length || !gallery.posterImage) {
      return;
    }

    const nextIndex = ((index % gallery.items.length) + gallery.items.length) % gallery.items.length;
    const item = gallery.items[nextIndex];

    gallery.index = nextIndex;
    gallery.posterImage.classList.remove("is-swapping");
    gallery.posterImage.src = item.src;
    gallery.posterImage.alt = item.alt;
    gallery.posterImage.classList.add("is-swapping");
    if (gallery.poster) {
      gallery.poster.classList.toggle("is-sticker-preview", item.type === "sticker");
      gallery.poster.classList.toggle("is-work-preview", item.type === "work");
    }

    window.setTimeout(() => gallery.posterImage.classList.remove("is-swapping"), 240);
    gallery.thumbs.forEach((thumb) => {
      const isActive = thumb === item.thumb;
      thumb.classList.toggle("is-active", isActive);
      thumb.setAttribute("aria-pressed", String(isActive));
    });
  }

  function clearGalleryTimer() {
    if (galleryTimer) {
      window.clearTimeout(galleryTimer);
      galleryTimer = 0;
    }
  }

  function scheduleGallery(id, delay) {
    clearGalleryTimer();

    if (reduceMotion) {
      return;
    }

    const slide = characterSlides.find((item) => item.dataset.character === id);
    const gallery = getGallery(slide);
    if (!gallery || gallery.items.length < 2) {
      return;
    }

    galleryTimer = window.setTimeout(() => {
      setGalleryImage(gallery, gallery.index + 1);
      scheduleGallery(id, galleryDelay);
    }, delay);
  }

  function setActiveCharacter(id, updateHash) {
    if (!id || !characterSlides.length) {
      return;
    }

    activeCharacterId = id;
    updateCharacterSwitchButtons(id);

    if (updateHash && window.location.hash !== `#${id}`) {
      history.replaceState(null, "", `#${id}`);
    }

    scheduleGallery(id, galleryDelay);
  }

  function updateCharacterSwitchButtons(id) {
    const activeIndex = characterButtons.findIndex((button) => button.dataset.characterTarget === id);

    characterButtons.forEach((button, index) => {
      const isActive = button.dataset.characterTarget === id;
      button.classList.toggle("is-active", isActive);
      button.classList.remove("is-prev", "is-next");

      if (!isActive && activeIndex >= 0) {
        const side = index < activeIndex ? "is-prev" : "is-next";
        button.classList.add(side);
      }
    });
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

    const nextId = closest.dataset.character || closest.id;
    if (nextId !== activeCharacterId) {
      setActiveCharacter(nextId, true);
    }
  }

  function scrollPosterIntoView(gallery) {
    if (!gallery || !gallery.poster) {
      return;
    }

    window.requestAnimationFrame(() => {
      const currentScroll = window.scrollY || root.scrollTop || 0;
      const posterBox = gallery.poster.getBoundingClientRect();
      const topGap = window.matchMedia("(max-width: 760px)").matches ? 12 : 18;
      const targetTop = Math.max(currentScroll + posterBox.top - topGap, 0);

      window.scrollTo({
        top: targetTop,
        behavior: reduceMotion ? "auto" : "smooth"
      });
    });
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

  characterButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      if (suppressAvatarClick) {
        event.preventDefault();
        return;
      }

      scrollToCharacter(button.dataset.characterTarget, true);
    });
  });

  if (characterAvatarNav) {
    characterAvatarNav.addEventListener("pointerdown", startAvatarDrag);
    characterAvatarNav.addEventListener("pointermove", moveAvatarDrag);
    characterAvatarNav.addEventListener("pointerup", endAvatarDrag);
    characterAvatarNav.addEventListener("pointercancel", endAvatarDrag);
  }

  characterSlides.forEach((slide) => {
    const gallery = getGallery(slide);
    if (!gallery) {
      return;
    }

    gallery.items.forEach((item, index) => {
      item.thumb.addEventListener("click", (event) => {
        event.preventDefault();
        setGalleryImage(gallery, index);
        scrollToCharacter(gallery.id, true);
        scrollPosterIntoView(gallery);

        if (gallery.id === activeCharacterId) {
          scheduleGallery(gallery.id, clickDelay);
        }
      });
    });

    setGalleryImage(gallery, 0);
  });

  if (characterCarousel && characterSlides.length) {
    let scrollFrame = 0;

    characterCarousel.addEventListener("scroll", () => {
      if (scrollFrame) {
        cancelAnimationFrame(scrollFrame);
      }

      scrollFrame = requestAnimationFrame(() => {
        syncCharacterFromScroll();
        scrollFrame = 0;
      });
    }, { passive: true });

    window.addEventListener("hashchange", () => {
      const hashId = window.location.hash.replace("#", "");
      if (hashId) {
        scrollToCharacter(hashId, false);
      }
    });
  }

  if (characterSlides.length) {
    const hashId = window.location.hash.replace("#", "");
    const initialId = characterSlides.some((slide) => slide.dataset.character === hashId)
      ? hashId
      : characterSlides[0].dataset.character;
    window.setTimeout(() => scrollToCharacter(initialId, false), 0);
  }

  measureAvatarFloatPoint();
  updateAvatarFloat();
  updateScrollProgress();

  window.addEventListener("scroll", () => {
    updateScrollProgress();
    updateAvatarFloat();
  }, { passive: true });

  window.addEventListener("resize", () => {
    measureAvatarFloatPoint();
    updateAvatarFloat();
    if (characterAvatarNav?.classList.contains("is-floating") && characterAvatarNav.style.left) {
      const box = characterAvatarNav.getBoundingClientRect();
      setAvatarPosition(box.left, box.top);
    }
    updateScrollProgress();
  });
})();
