// 应用控制器管理脚本 - 主题切换 / 视频控制 / 音频歌词同步
(function () {
  "use strict";

  // ===== 主题切换功能 =====
  const forceDarkMode = document.documentElement.dataset.forceDark === "true";
  const primaryColorScheme = forceDarkMode ? "dark" : ""; // "light" | "dark"

  // Get theme data from local storage
  const currentTheme = localStorage.getItem("theme");

  function getPreferTheme() {
    // 站点强制深色时，始终返回 dark
    if (primaryColorScheme) return primaryColorScheme;

    // return theme value in local storage if it is set
    if (currentTheme) return currentTheme;

    // return user device's prefer color scheme
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  let themeValue = getPreferTheme();

  function setPreference() {
    localStorage.setItem("theme", themeValue);
    reflectPreference();
  }

  function reflectPreference() {
    document.firstElementChild.setAttribute("data-theme", themeValue);

    document
      .querySelector("#theme-btn")
      ?.setAttribute("aria-label", themeValue);
    document
      .querySelector("#theme-btn-mobile")
      ?.setAttribute("aria-label", themeValue);

    // Get a reference to the body element
    const body = document.body;

    // Check if the body element exists before using getComputedStyle
    if (body) {
      // Get the computed styles for the body element
      const computedStyles = window.getComputedStyle(body);

      // Get the background color property
      const bgColor = computedStyles.backgroundColor;

      // Set the background color in <meta theme-color ... />
      document
        .querySelector("meta[name='theme-color']")
        ?.setAttribute("content", bgColor);
    }
  }

  // set early so no page flashes / CSS is made aware
  reflectPreference();

  function initThemeControls() {
    // set on load so screen readers can get the latest value on the button
    reflectPreference();

    // Helper function to add theme toggle functionality
    function addThemeToggle(selector) {
      const btn = document.querySelector(selector);
      if (btn) {
        // Add cursor pointer style for iOS Safari compatibility
        btn.style.cursor = "pointer";

        // 检查是否已经绑定过事件监听器
        if (btn.dataset.themeInitialized === "true") {
          return;
        }

        const toggleTheme = () => {
          themeValue = themeValue === "light" ? "dark" : "light";
          setPreference();
        };

        // Add click event listener
        btn.addEventListener("click", toggleTheme);

        // Add touchend event listener for iOS Safari compatibility
        btn.addEventListener("touchend", e => {
          e.preventDefault();
          toggleTheme();
        });

        // 标记按钮已经初始化
        btn.dataset.themeInitialized = "true";
      }
    }

    // Add theme toggle functionality to both buttons
    addThemeToggle("#theme-btn");
    addThemeToggle("#theme-btn-mobile");
  }

  // Set theme-color value before page transition
  // to avoid navigation bar color flickering in Android dark mode
  document.addEventListener("astro:before-swap", event => {
    const bgColor = document
      .querySelector("meta[name='theme-color']")
      ?.getAttribute("content");

    event.newDocument
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
  });

  // sync with system changes
  if (!primaryColorScheme) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", ({ matches: isDark }) => {
        themeValue = isDark ? "dark" : "light";
        setPreference();
      });
  }

  // ===== 视频控制功能 =====

  // 初始化所有视频元素
  function initVideoControls() {
    const videos = document.querySelectorAll(
      "video:not([data-live-photo='true'])"
    );

    videos.forEach(video => {
      setupVideoControls(video);
    });
  }

  function setupVideoControls(video) {
    if (video.dataset.livePhoto === "true") return;

    // 创建视频容器和播放按钮
    createVideoContainer(video);
    const playButton = createPlayButton(video);
    let hideControlsTimer = null;

    // 初始状态：隐藏控制器，显示播放按钮
    video.classList.add("video-controls-hidden");

    // 显示控制器的函数
    function showControls() {
      if (!video.paused) {
        video.classList.remove("video-controls-hidden");
        video.classList.add("video-controls-visible");
      }
    }

    // 隐藏控制器的函数
    function hideControls() {
      video.classList.remove("video-controls-visible");
      video.classList.add("video-controls-hidden");
      // 只有在视频暂停时才显示播放按钮
      if (video.paused) {
        playButton.classList.remove("hidden");
      } else {
        // 视频播放时确保播放按钮保持隐藏
        playButton.classList.add("hidden");
      }
    }

    // 重置定时器的函数
    function resetHideTimer() {
      if (hideControlsTimer) {
        clearTimeout(hideControlsTimer);
      }
      if (!video.paused) {
        hideControlsTimer = setTimeout(() => {
          hideControls();
        }, 2000); // 2秒后自动隐藏
      }
    }

    // 播放时显示控制器，隐藏播放按钮
    video.addEventListener("play", () => {
      showControls();
      playButton.classList.add("hidden");
      resetHideTimer();
    });

    // 暂停时隐藏控制器，显示播放按钮
    video.addEventListener("pause", () => {
      if (hideControlsTimer) {
        clearTimeout(hideControlsTimer);
      }
      hideControls();
      playButton.classList.remove("hidden");
    });

    // 鼠标悬停时显示控制器
    video.addEventListener("mouseenter", () => {
      showControls();
      resetHideTimer();
    });

    // 鼠标移动时重置定时器
    video.addEventListener("mousemove", () => {
      showControls();
      resetHideTimer();
    });

    // 鼠标离开时隐藏控制器
    video.addEventListener("mouseleave", () => {
      if (hideControlsTimer) {
        clearTimeout(hideControlsTimer);
      }
      hideControls();
    });

    // 视频结束时隐藏控制器，显示播放按钮
    video.addEventListener("ended", () => {
      if (hideControlsTimer) {
        clearTimeout(hideControlsTimer);
      }
      hideControls();
      playButton.classList.remove("hidden");
    });
  }

  function createVideoContainer(video) {
    // 检查是否已经有容器
    if (
      video.parentElement &&
      video.parentElement.classList.contains("video-container")
    ) {
      return video.parentElement;
    }

    // 创建容器
    const container = document.createElement("div");
    container.className = "video-container";

    // 将视频包装在容器中
    video.parentNode.insertBefore(container, video);
    container.appendChild(video);

    return container;
  }

  function createPlayButton(video) {
    const container = video.parentElement;

    // 检查是否已经有播放按钮
    let playButton = container.querySelector(".video-play-button");
    if (playButton) {
      return playButton;
    }

    // 创建播放按钮
    playButton = document.createElement("button");
    playButton.className = "video-play-button";
    playButton.setAttribute("aria-label", "播放视频");

    // 点击播放按钮时播放视频
    playButton.addEventListener("click", () => {
      video.play();
    });

    // 将播放按钮添加到容器中
    container.appendChild(playButton);

    return playButton;
  }

  // ===== Live Photo 视频控制 =====
  function initLivePhotoVideos() {
    const liveVideos = document.querySelectorAll("video[data-live-photo='true']");
    liveVideos.forEach(video => {
      setupLivePhotoVideo(video);
    });
  }

  function setupLivePhotoVideo(video) {
    if (!video || video.dataset.liveInitialized === "true") return;

    const mode = (video.dataset.liveMode || "auto").toLowerCase();
    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    const play = () => {
      void video.play().catch(() => {});
    };

    const stop = () => {
      video.pause();
      video.currentTime = 0;
    };

    if (mode === "auto") {
      if (!video.hasAttribute("autoplay")) {
        video.setAttribute("autoplay", "");
      }
      if (video.readyState >= 2) {
        play();
      } else {
        video.addEventListener("loadeddata", play, { once: true });
      }
    } else {
      video.addEventListener("mouseenter", () => play());
      video.addEventListener("mouseleave", () => stop());
      video.addEventListener("click", () => {
        if (video.paused) play();
        else stop();
      });
      video.addEventListener("touchend", () => {
        if (video.paused) play();
        else stop();
      });
    }

    video.dataset.liveInitialized = "true";
  }

  // ===== 音频播放器（card-audio） =====

  function escapeHtml(input) {
    return input
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function parseLrc(rawLrc) {
    const lines = [];
    const rows = String(rawLrc || "").split(/\r?\n/);

    rows.forEach(row => {
      if (!row || !row.includes("[")) return;

      const timeMatches = [...row.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
      if (timeMatches.length === 0) return;

      const lyricText = row.replace(/\[[^\]]+\]/g, "").trim() || "♪";
      timeMatches.forEach(match => {
        const minute = Number.parseInt(match[1], 10);
        const second = Number.parseInt(match[2], 10);
        const milliText = (match[3] || "0").padEnd(3, "0").slice(0, 3);
        const millisecond = Number.parseInt(milliText, 10);
        const time = minute * 60 + second + millisecond / 1000;
        lines.push({ time, text: lyricText });
      });
    });

    lines.sort((a, b) => a.time - b.time);
    return lines;
  }

  function decodeDataUriText(dataUri) {
    const match = String(dataUri || "").match(/^data:([^,]*?),(.*)$/);
    if (!match) return null;

    const meta = match[1] || "";
    const payload = match[2] || "";
    const isBase64 = /;base64/i.test(meta);

    if (isBase64) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const charsetMatch = meta.match(/charset=([^;]+)/i);
      const charset = charsetMatch ? charsetMatch[1].trim() : "utf-8";
      try {
        return new TextDecoder(charset).decode(bytes);
      } catch {
        return new TextDecoder("utf-8").decode(bytes);
      }
    }

    return decodeURIComponent(payload);
  }

  function loadLrcText(lrcSrc) {
    const source = String(lrcSrc || "").trim();
    if (!source) {
      return Promise.reject(new Error("empty lrc source"));
    }

    if (source.startsWith("data:")) {
      const decoded = decodeDataUriText(source);
      if (decoded == null) {
        return Promise.reject(new Error("invalid data uri"));
      }
      return Promise.resolve(decoded);
    }

    return fetch(source).then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch LRC: ${response.status}`);
      }
      return response.text();
    });
  }

  function bindDecodeRetry(el, attr) {
    if (!el || el.dataset.decodeRetryBound === "true") return;
    el.dataset.decodeRetryBound = "true";

    el.addEventListener("error", () => {
      const src = el.getAttribute(attr) || "";
      if (!src || !src.includes("%") || el.dataset.decodeRetried === "true") {
        return;
      }

      try {
        const decoded = decodeURIComponent(src);
        if (decoded && decoded !== src) {
          el.dataset.decodeRetried = "true";
          el.setAttribute(attr, decoded);
        }
      } catch {
        // Keep original source on decode failure.
      }
    });
  }

  function findActiveLyricIndex(lyrics, currentTime) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) return -1;

    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        return i;
      }
    }
    return -1;
  }

  function setupAudioCard(card) {
    if (!card || card.dataset.audioInitialized === "true") {
      return;
    }

    const audio = card.querySelector("audio[data-audio-source]");
    const coverImg = card.querySelector(".audio-card__cover");
    const lyricsContainer = card.querySelector("[data-audio-lyrics]");
    const lrcSrc = card.dataset.lrcSrc || "";

    bindDecodeRetry(audio, "src");
    bindDecodeRetry(coverImg, "src");

    if (!audio || !lyricsContainer || !lrcSrc) {
      if (lyricsContainer) {
        lyricsContainer.hidden = true;
      }
      card.dataset.audioInitialized = "true";
      return;
    }

    loadLrcText(lrcSrc)
      .then(rawLrc => {
        const parsedLyrics = parseLrc(rawLrc);
        if (parsedLyrics.length === 0) {
          lyricsContainer.innerHTML =
            '<p class="audio-card__lyrics-empty">未解析到可用歌词</p>';
          lyricsContainer.hidden = false;
          return;
        }

        lyricsContainer.innerHTML = parsedLyrics
          .map(
            (line, index) =>
              `<button type="button" class="audio-card__lyric-line" data-lyric-index="${index}" data-lyric-time="${line.time.toFixed(3)}">${escapeHtml(line.text)}</button>`
          )
          .join("");
        lyricsContainer.hidden = false;

        const lyricButtons = [...lyricsContainer.querySelectorAll(".audio-card__lyric-line")];
        let activeIndex = -1;
        let pendingFrame = null;

        const syncLyrics = () => {
          pendingFrame = null;
          const nextIndex = findActiveLyricIndex(parsedLyrics, audio.currentTime);
          if (nextIndex === activeIndex) return;

          if (activeIndex >= 0 && lyricButtons[activeIndex]) {
            lyricButtons[activeIndex].classList.remove("is-active");
          }

          activeIndex = nextIndex;
          if (activeIndex >= 0 && lyricButtons[activeIndex]) {
            const target = lyricButtons[activeIndex];
            target.classList.add("is-active");
            target.scrollIntoView({
              block: "center",
              behavior: audio.paused ? "auto" : "smooth",
            });
          }
        };

        audio.addEventListener("timeupdate", () => {
          if (pendingFrame) return;
          pendingFrame = requestAnimationFrame(syncLyrics);
        });

        lyricButtons.forEach(button => {
          button.addEventListener("click", () => {
            const targetTime = Number.parseFloat(button.dataset.lyricTime || "0");
            if (!Number.isNaN(targetTime)) {
              audio.currentTime = Math.max(targetTime, 0);
            }
            audio.play();
          });
        });

        syncLyrics();
      })
      .catch(() => {
        lyricsContainer.innerHTML =
          '<p class="audio-card__lyrics-empty">歌词加载失败</p>';
        lyricsContainer.hidden = false;
      })
      .finally(() => {
        card.dataset.audioInitialized = "true";
      });
  }

  function initAudioCards() {
    const audioCards = document.querySelectorAll("[data-audio-card]");
    audioCards.forEach(card => {
      setupAudioCard(card);
    });
  }

  const appState = {
    observerActive: false,
    afterSwapThemeBound: false,
  };

  // 监听动态添加的视频元素
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === "VIDEO") {
            if (node.dataset.livePhoto === "true") {
              setupLivePhotoVideo(node);
            } else {
              setupVideoControls(node);
            }
          } else if (
            node.matches &&
            node.matches("[data-audio-card]")
          ) {
            setupAudioCard(node);
          } else if (node.querySelector && node.querySelector("video")) {
            const videos = node.querySelectorAll("video");
            videos.forEach(video => {
              if (video.dataset.livePhoto === "true") {
                setupLivePhotoVideo(video);
              } else {
                setupVideoControls(video);
              }
            });
          } else if (node.querySelector && node.querySelector("[data-audio-card]")) {
            const cards = node.querySelectorAll("[data-audio-card]");
            cards.forEach(card => {
              setupAudioCard(card);
            });
          }
        }
      });
    });
  });

  function stopVideoObserver() {
    if (!appState.observerActive) return;
    observer.disconnect();
    appState.observerActive = false;
  }

  // 确保 document.body 存在后再开始观察（并避免重复 observe）
  function initVideoObserver() {
    if (appState.observerActive) return;
    if (!document.body) return;

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    appState.observerActive = true;
  }

  function initAppControls() {
    initVideoControls();
    initLivePhotoVideos();
    initAudioCards();
    initVideoObserver();
    initThemeControls();

    if (!appState.afterSwapThemeBound) {
      document.addEventListener("astro:after-swap", initThemeControls);
      appState.afterSwapThemeBound = true;
    }
  }

  // ===== 初始化所有功能 =====

  // 监听 Astro 页面导航事件，重新初始化所有控制器
  document.addEventListener("astro:page-load", initAppControls);
  document.addEventListener("post:decrypted", initAppControls);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAppControls, {
      once: true,
    });
  } else {
    initAppControls();
  }

  // 离开前记录当前页面
  const readStack = () => {
    try {
      return JSON.parse(sessionStorage.getItem("lastPages") || "[]");
    } catch {
      return [];
    }
  };
  const writeStack = arr => {
    // 只保留最近 10 条
    const pruned = arr.slice(-10);
    sessionStorage.setItem("lastPages", JSON.stringify(pruned));
  };
  const currentBase = () => location.pathname + location.search;

  // ------- 离开前记录 -------
  document.addEventListener("astro:before-preparation", () => {
    // 避免在 Astro 进行 DOM swap 时，MutationObserver 扫描整页增删导致主线程卡顿
    stopVideoObserver();

    const stack = readStack();
    const cur = currentBase();
    if (stack[stack.length - 1] !== cur) {
      stack.push(cur); // 去重：仅当与栈顶不同才写
      writeStack(stack);
    }
  });

  window.addEventListener("beforeunload", () => {
    stopVideoObserver();
  });
})();
