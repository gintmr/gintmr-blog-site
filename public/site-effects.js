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

  function initSiteEffects() {
    setupRevealEffects();
  }

  document.addEventListener("astro:page-load", initSiteEffects);
  document.addEventListener("post:decrypted", initSiteEffects);
  window.addEventListener("beforeunload", () => {
    cleanupReveal();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSiteEffects, { once: true });
  } else {
    initSiteEffects();
  }
})();
