(function () {
  "use strict";

  const state = {
    revealObserver: null,
    cursorElement: null,
    cursorMoveHandler: null,
    imageViewerCleanup: null,
  };

  function cleanupReveal() {
    if (state.revealObserver) {
      state.revealObserver.disconnect();
      state.revealObserver = null;
    }
  }

  function setupRevealEffects() {
    cleanupReveal();

    const body = document.body;
    if (!body || body.dataset.effectReveal !== "on") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const targets = document.querySelectorAll(
      [
        "main h2",
        "main h3",
        "main .app-prose > p",
        "main .app-prose > ul",
        "main .app-prose > ol",
        "main .app-prose > figure",
        "main .app-prose > blockquote",
        "main .app-prose > pre",
        "main .media-card-static-wrap",
      ].join(",")
    );

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("fx-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.08,
      }
    );

    targets.forEach(target => {
      if (!(target instanceof HTMLElement)) return;
      target.setAttribute("data-fx-reveal", "");
      observer.observe(target);
    });

    state.revealObserver = observer;
  }

  function cleanupCursorGlow() {
    if (state.cursorMoveHandler) {
      document.removeEventListener("pointermove", state.cursorMoveHandler);
      state.cursorMoveHandler = null;
    }
    if (state.cursorElement) {
      state.cursorElement.remove();
      state.cursorElement = null;
    }
  }

  function setupCursorGlow() {
    cleanupCursorGlow();

    const body = document.body;
    if (!body || body.dataset.effectCursor !== "on") return;

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (coarsePointer || reducedMotion) return;

    const glow = document.createElement("div");
    glow.className = "fx-cursor-glow";
    document.body.appendChild(glow);
    state.cursorElement = glow;

    let rafId = null;
    let pendingX = 0;
    let pendingY = 0;

    const onPointerMove = event => {
      pendingX = event.clientX;
      pendingY = event.clientY;

      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        glow.style.left = `${pendingX}px`;
        glow.style.top = `${pendingY}px`;
        glow.style.opacity = "1";
        rafId = null;
      });
    };

    state.cursorMoveHandler = onPointerMove;
    document.addEventListener("pointermove", onPointerMove, { passive: true });

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          glow.style.opacity = "0";
        }
      },
      { passive: true }
    );
  }

  function cleanupImageViewer() {
    if (state.imageViewerCleanup) {
      state.imageViewerCleanup();
      state.imageViewerCleanup = null;
    }

    const viewer = document.getElementById("global-image-viewer");
    if (viewer) viewer.remove();
    if (document.body) document.body.style.overflow = "";
  }

  function setupStandaloneImageLayout() {
    const images = Array.from(
      document.querySelectorAll("#article img, #diary-content img")
    ).filter(node => node instanceof HTMLImageElement);

    images.forEach(img => {
      img.classList.remove("single-standalone-image");

      const figure = img.closest("figure");
      if (figure) figure.classList.remove("single-standalone-figure");

      const anchor = img.closest("a");
      if (anchor) anchor.classList.remove("single-standalone-anchor");

      if (
        img.closest(".media-card") ||
        img.closest(".media-card-static") ||
        img.closest(".images-grid:not(.images-grid-single)")
      ) {
        return;
      }

      let standalone = Boolean(img.closest(".images-grid-single"));

      if (!standalone && figure) {
        standalone = figure.querySelectorAll("img").length === 1;
      }

      if (!standalone) {
        const paragraph = img.closest("p");
        if (paragraph) {
          standalone = paragraph.querySelectorAll("img").length === 1;
        }
      }

      if (!standalone) {
        const parent = img.parentElement;
        if (parent) {
          standalone =
            parent.children.length === 1 &&
            parent.querySelectorAll("img").length === 1;
        }
      }

      if (!standalone) return;

      img.classList.add("single-standalone-image");
      if (figure) figure.classList.add("single-standalone-figure");
      if (anchor && anchor.querySelectorAll("img").length === 1) {
        anchor.classList.add("single-standalone-anchor");
      }
    });
  }

  function setupImageViewer() {
    cleanupImageViewer();

    const targetSelectors = [
      "#article img",
      "[data-role='decrypted-content'] img",
      "#diary-content .images-grid img",
      "#diary-content .html-content img",
    ];
    const slides = [];
    const selectorQuery = targetSelectors.join(",");

    const rebuildSlides = () => {
      slides.length = 0;
      const images = Array.from(document.querySelectorAll(selectorQuery)).filter(
        node => node instanceof HTMLImageElement
      );

      images.forEach(img => {
        const link = img.closest("a[href]");
        const source =
          (link && link.getAttribute("href")) ||
          img.getAttribute("data-src") ||
          img.currentSrc ||
          img.src;

        if (!source) return;

        const title = (img.getAttribute("title") || "").trim();
        const alt = (img.getAttribute("alt") || "").trim();
        const figureCaption = (
          img
            .closest("figure")
            ?.querySelector("figcaption:not(.sr-only)")
            ?.textContent || ""
        ).trim();

        const caption = title || figureCaption || alt;

        img.dataset.globalGalleryIndex = String(slides.length);
        img.style.cursor = "zoom-in";
        if (link) link.setAttribute("data-gallery-image", "true");

        slides.push({
          src: source,
          alt: alt || "图片预览",
          caption,
          sourceNode: img,
        });
      });
    };

    rebuildSlides();

    const viewer = document.createElement("div");
    viewer.id = "global-image-viewer";
    viewer.innerHTML = `
      <button id="global-image-viewer__close" type="button" aria-label="关闭预览">✕</button>
      <div id="global-image-viewer__stage">
        <div id="global-image-viewer__top">
          <div id="global-image-viewer__counter"></div>
          <div id="global-image-viewer__progress">
            <div id="global-image-viewer__progress-value"></div>
          </div>
        </div>
        <button id="global-image-viewer__prev" class="global-image-viewer__nav" type="button" aria-label="上一张">‹</button>
        <img id="global-image-viewer__img" alt="" />
        <button id="global-image-viewer__next" class="global-image-viewer__nav" type="button" aria-label="下一张">›</button>
        <figcaption id="global-image-viewer__caption"></figcaption>
      </div>
    `;
    document.body.appendChild(viewer);

    const viewerImage = document.getElementById("global-image-viewer__img");
    const viewerCaption = document.getElementById("global-image-viewer__caption");
    const viewerCounter = document.getElementById("global-image-viewer__counter");
    const viewerProgress = document.getElementById(
      "global-image-viewer__progress-value"
    );
    const prevButton = document.getElementById("global-image-viewer__prev");
    const nextButton = document.getElementById("global-image-viewer__next");
    const closeButton = document.getElementById("global-image-viewer__close");

    if (
      !(viewerImage instanceof HTMLImageElement) ||
      !(viewerCaption instanceof HTMLElement) ||
      !(viewerCounter instanceof HTMLElement) ||
      !(viewerProgress instanceof HTMLElement) ||
      !(prevButton instanceof HTMLButtonElement) ||
      !(nextButton instanceof HTMLButtonElement) ||
      !(closeButton instanceof HTMLButtonElement)
    ) {
      viewer.remove();
      return;
    }

    let currentIndex = 0;
    let isOpen = false;

    function renderSlide(index) {
      const total = slides.length;
      if (total === 0) return;

      const safeIndex = ((index % total) + total) % total;
      currentIndex = safeIndex;
      const slide = slides[safeIndex];

      viewerImage.src = slide.src;
      viewerImage.alt = slide.alt;

      viewerCaption.textContent = slide.caption;
      viewerCaption.style.display = slide.caption ? "block" : "none";

      viewerCounter.textContent = `${safeIndex + 1} / ${total}`;
      viewerProgress.style.width = `${((safeIndex + 1) / total) * 100}%`;

      const disableNav = total <= 1;
      prevButton.disabled = disableNav;
      nextButton.disabled = disableNav;
    }

    function openAt(index) {
      rebuildSlides();
      if (slides.length === 0) return;
      renderSlide(index);
      viewer.setAttribute("data-open", "true");
      document.body.style.overflow = "hidden";
      isOpen = true;
    }

    function closeViewer() {
      viewer.setAttribute("data-open", "false");
      document.body.style.overflow = "";
      isOpen = false;
    }

    function goPrev() {
      if (!isOpen || slides.length <= 1) return;
      renderSlide(currentIndex - 1);
    }

    function goNext() {
      if (!isOpen || slides.length <= 1) return;
      renderSlide(currentIndex + 1);
    }

    const onClick = event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target === viewer) {
        closeViewer();
        return;
      }

      if (target.closest("#global-image-viewer__close")) {
        closeViewer();
        return;
      }

      if (target.closest("#global-image-viewer__prev")) {
        goPrev();
        return;
      }

      if (target.closest("#global-image-viewer__next")) {
        goNext();
        return;
      }

      let image = target.closest(selectorQuery);
      if (!(image instanceof HTMLImageElement)) {
        const anchor = target.closest("a[data-gallery-image='true']");
        if (anchor instanceof HTMLAnchorElement) {
          image = anchor.querySelector("img");
        }
      }
      if (!(image instanceof HTMLImageElement)) return;

      rebuildSlides();
      const index = Number.parseInt(image.dataset.globalGalleryIndex || "", 10);
      if (Number.isNaN(index)) return;

      event.preventDefault();
      openAt(index);
    };

    const onKeydown = event => {
      if (!isOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeydown);

    state.imageViewerCleanup = () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeydown);
      viewer.remove();
      if (document.body) document.body.style.overflow = "";
    };
  }

  function initSiteEffects() {
    setupRevealEffects();
    setupCursorGlow();
    setupStandaloneImageLayout();
    setupImageViewer();
  }

  document.addEventListener("astro:page-load", initSiteEffects);
  window.addEventListener("beforeunload", () => {
    cleanupReveal();
    cleanupCursorGlow();
    cleanupImageViewer();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSiteEffects, { once: true });
  } else {
    initSiteEffects();
  }
})();
