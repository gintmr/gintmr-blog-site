import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface StorySlide {
  id: string;
  type: "image" | "video";
  src: string;
  poster?: string;
  text?: string;
  caption?: string;
  live?: boolean;
}

interface StoryPlayerProps {
  slides: StorySlide[];
  bgm?: string;
  title?: string;
}

const SWIPE_THRESHOLD = 56;
const WHEEL_LOCK_MS = 360;

const StoryPlayer: React.FC<StoryPlayerProps> = ({ slides, bgm, title }) => {
  const safeSlides = useMemo(() => slides.filter(Boolean), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [bgmProgress, setBgmProgress] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wheelLockRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
  const videoRefs = useRef(new Map<number, HTMLVideoElement>());

  const moveTo = useCallback(
    (index: number) => {
      if (safeSlides.length === 0) return;
      const next = Math.max(0, Math.min(index, safeSlides.length - 1));
      setActiveIndex(next);
    },
    [safeSlides.length]
  );

  const goNext = useCallback(() => {
    setActiveIndex(prev => Math.min(prev + 1, safeSlides.length - 1));
  }, [safeSlides.length]);

  const goPrev = useCallback(() => {
    setActiveIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const stopVideo = useCallback((video: HTMLVideoElement | undefined) => {
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }, []);

  const playVideo = useCallback((video: HTMLVideoElement | undefined) => {
    if (!video) return;
    void video.play().catch(() => {});
  }, []);

  const stopAllLiveVideos = useCallback(() => {
    videoRefs.current.forEach((video, index) => {
      const slide = safeSlides[index];
      if (!slide?.live) return;
      stopVideo(video);
    });
  }, [safeSlides, stopVideo]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      const slide = safeSlides[index];
      if (!slide || slide.type !== "video") return;

      if (index !== activeIndex) {
        stopVideo(video);
        return;
      }

      if (!slide.live) {
        playVideo(video);
      }
    });
  }, [activeIndex, playVideo, safeSlides, stopVideo]);

  const withWheelLock = useCallback((action: () => void) => {
    if (wheelLockRef.current) return;
    wheelLockRef.current = true;
    action();
    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, WHEEL_LOCK_MS);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 12) return;
      event.preventDefault();
      withWheelLock(() => {
        if (event.deltaY > 0) goNext();
        else goPrev();
      });
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        goPrev();
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      const endY = event.changedTouches[0]?.clientY;
      if (startY == null || endY == null) return;
      const deltaY = endY - startY;
      if (Math.abs(deltaY) < SWIPE_THRESHOLD) return;
      if (deltaY < 0) goNext();
      else goPrev();
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("keydown", handleKeydown);

    return () => {
      element.removeEventListener("wheel", handleWheel);
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [goNext, goPrev, withWheelLock]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !bgm) return;

    const syncProgress = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        setBgmProgress(0);
        return;
      }
      setBgmProgress((audio.currentTime / audio.duration) * 100);
    };

    const onPlay = () => setBgmPlaying(true);
    const onPause = () => setBgmPlaying(false);
    const onEnded = () => setBgmPlaying(false);

    audio.addEventListener("timeupdate", syncProgress);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", syncProgress);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [bgm]);

  useEffect(() => {
    return () => {
      stopAllLiveVideos();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [stopAllLiveVideos]);

  const toggleBgm = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const bindVideoRef = useCallback((index: number, node: HTMLVideoElement | null) => {
    if (!node) {
      videoRefs.current.delete(index);
      return;
    }
    videoRefs.current.set(index, node);
  }, []);

  if (safeSlides.length === 0) {
    return (
      <div className="story-player story-player--empty">
        <p>No slides configured.</p>
      </div>
    );
  }

  const renderSlideMedia = (slide: StorySlide, index: number) => {
    if (slide.type === "video") {
      return (
        <video
          ref={node => bindVideoRef(index, node)}
          className="story-slide__media story-slide__media--video"
          src={slide.src}
          poster={slide.poster}
          muted
          loop
          playsInline
          preload="metadata"
          onMouseEnter={() => {
            if (!slide.live || index !== activeIndex) return;
            playVideo(videoRefs.current.get(index));
          }}
          onMouseLeave={() => {
            if (!slide.live || index !== activeIndex) return;
            stopVideo(videoRefs.current.get(index));
          }}
          onClick={() => {
            if (!slide.live || index !== activeIndex) return;
            const video = videoRefs.current.get(index);
            if (!video) return;
            if (video.paused) playVideo(video);
            else stopVideo(video);
          }}
        />
      );
    }

    return (
      <img
        src={slide.src}
        alt={slide.caption || `story-slide-${index + 1}`}
        className="story-slide__media story-slide__media--image"
        loading={index <= 1 ? "eager" : "lazy"}
      />
    );
  };

  return (
    <section
      ref={containerRef}
      className="story-player"
      aria-label={title ? `${title} story player` : "Story player"}
      tabIndex={0}
    >
      <div className="story-player__chrome">
        <div className="story-player__counter">
          <span>{activeIndex + 1}</span>
          <span>/ {safeSlides.length}</span>
        </div>
        <div className="story-player__dots" aria-hidden="true">
          {safeSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={`story-player__dot ${index === activeIndex ? "is-active" : ""}`}
              onClick={() => moveTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="story-player__viewport">
        <div
          className="story-player__track"
          style={{ transform: `translateY(-${activeIndex * 100}%)` }}
        >
          {safeSlides.map((slide, index) => (
            <article
              key={slide.id}
              className={`story-slide ${index === activeIndex ? "is-active" : ""}`}
              aria-hidden={index === activeIndex ? "false" : "true"}
            >
              <div className="story-slide__media-wrap">
                {renderSlideMedia(slide, index)}
              </div>
              {(slide.text || slide.caption) && (
                <div className="story-slide__overlay">
                  {slide.text && <p className="story-slide__text">{slide.text}</p>}
                  {slide.caption && (
                    <p className="story-slide__caption">{slide.caption}</p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="story-player__controls">
        <button
          type="button"
          className="story-player__btn"
          onClick={goPrev}
          disabled={activeIndex <= 0}
          aria-label="Previous slide"
        >
          ↑
        </button>
        <button
          type="button"
          className="story-player__btn"
          onClick={goNext}
          disabled={activeIndex >= safeSlides.length - 1}
          aria-label="Next slide"
        >
          ↓
        </button>
        {bgm && (
          <button
            type="button"
            className="story-player__btn story-player__btn--music"
            onClick={toggleBgm}
            aria-label={bgmPlaying ? "Pause music" : "Play music"}
          >
            {bgmPlaying ? "Pause Music" : "Play Music"}
          </button>
        )}
      </div>

      {bgm && (
        <div className="story-player__audio-wrap">
          <audio ref={audioRef} src={bgm} preload="metadata" loop />
          <div className="story-player__audio-progress" aria-hidden="true">
            <span style={{ width: `${bgmProgress}%` }} />
          </div>
        </div>
      )}
    </section>
  );
};

export default StoryPlayer;

