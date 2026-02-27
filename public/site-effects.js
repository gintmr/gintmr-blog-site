(function () {
  "use strict";

  const state = {
    revealObserver: null,
    cursorElement: null,
    cursorMoveHandler: null,
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

  function initSiteEffects() {
    setupRevealEffects();
    setupCursorGlow();
  }

  document.addEventListener("astro:page-load", initSiteEffects);
  window.addEventListener("beforeunload", () => {
    cleanupReveal();
    cleanupCursorGlow();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSiteEffects, { once: true });
  } else {
    initSiteEffects();
  }
})();

