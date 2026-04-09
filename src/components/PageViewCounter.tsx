import React from "react";
import {
  detectVisitorEnvironment,
  generateUserHash,
  generateSessionId,
  getVisitorGeoInfo,
  getPageVisitStats,
  trackPageView,
  upsertVisitorSession,
} from "@/db/supabase";
import { UI_LOCALE } from "@/i18n/ui";

interface PageViewCounterProps {
  fallbackPath?: string;
  dedupeMinutes?: number;
}

const UI_TEXT =
  UI_LOCALE === "zh-CN"
    ? {
        viewsLabel: "浏览",
        visitorsLabel: "访客",
        averageLabel: "人均",
        loading: "统计中",
        unavailable: "--",
      }
    : {
        viewsLabel: "Views",
        visitorsLabel: "Visitors",
        averageLabel: "Avg",
        loading: "Loading",
        unavailable: "--",
      };

function normalizePath(path: string): string {
  if (!path) return "/";

  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";

  const withoutQuery = trimmed.split("?")[0].split("#")[0];
  const normalized = withoutQuery.replace(/\/+$/, "");
  return normalized || "/";
}

function shouldTrackThisSession(path: string, dedupeMinutes: number): boolean {
  if (typeof window === "undefined") return false;

  try {
    const key = `pageview:${path}`;
    const now = Date.now();
    const last = Number.parseInt(sessionStorage.getItem(key) || "0", 10);
    const windowMs = Math.max(0, dedupeMinutes) * 60 * 1000;

    if (last > 0 && now - last < windowMs) {
      return false;
    }

    sessionStorage.setItem(key, String(now));
    return true;
  } catch {
    return true;
  }
}

const PageViewCounter: React.FC<PageViewCounterProps> = ({
  fallbackPath = "/",
  dedupeMinutes = 30,
}) => {
  const [stats, setStats] = React.useState<{
    viewCount: number;
    visitorCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentPath, setCurrentPath] = React.useState(normalizePath(fallbackPath));
  const trackerRef = React.useRef<{
    path: string;
    visitorHash: string;
    sessionId: string;
    startedAt: number;
    hiddenStartedAt: number | null;
    hiddenDurationMs: number;
    lastSentDwellSeconds: number;
    sentAtLeastOnce: boolean;
    maxScrollPercent: number;
    interactionCount: number;
    heartbeatCount: number;
    lastInteractionAt: number;
    intervalId?: number;
    firstHeartbeatId?: number;
    cleanup?: () => void;
  } | null>(null);

  const stopDetailedTracker = React.useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;

    if (tracker.intervalId) {
      window.clearInterval(tracker.intervalId);
    }

    if (tracker.firstHeartbeatId) {
      window.clearTimeout(tracker.firstHeartbeatId);
    }

    if (tracker.cleanup) {
      tracker.cleanup();
    }

    trackerRef.current = null;
  }, []);

  const startDetailedTracker = React.useCallback(
    async (path: string, visitorHash: string) => {
      stopDetailedTracker();

      const sessionId = generateSessionId("astro-obsidian-blog:visitor");
      const startedAt = Date.now();
      const geoPromise = getVisitorGeoInfo();

      const getScrollPercent = () => {
        if (typeof document === "undefined") return 0;

        const root = document.documentElement;
        const body = document.body;
        const scrollTop = window.scrollY || root.scrollTop || body?.scrollTop || 0;
        const scrollHeight = Math.max(
          root.scrollHeight,
          body?.scrollHeight || 0,
          root.offsetHeight,
          body?.offsetHeight || 0
        );
        const viewport = window.innerHeight || root.clientHeight || 0;
        const maxScrollable = Math.max(scrollHeight - viewport, 0);
        if (maxScrollable <= 0) return 100;

        return Math.min(100, Math.max(0, (scrollTop / maxScrollable) * 100));
      };

      const computeDwellSeconds = () => {
        const tracker = trackerRef.current;
        if (!tracker || tracker.sessionId !== sessionId) return 0;

        const now = Date.now();
        const hiddenDurationMs =
          tracker.hiddenDurationMs +
          (tracker.hiddenStartedAt ? now - tracker.hiddenStartedAt : 0);
        const activeMs = Math.max(0, now - tracker.startedAt - hiddenDurationMs);

        if (activeMs < 800) return 0;
        if (activeMs < 5000) {
          return Math.max(1, Math.round(activeMs / 1000));
        }

        return Math.floor(activeMs / 1000);
      };

      const computeVisibleSeconds = () => {
        const tracker = trackerRef.current;
        if (!tracker || tracker.sessionId !== sessionId) return 0;

        const now = Date.now();
        const hiddenDurationMs =
          tracker.hiddenDurationMs +
          (tracker.hiddenStartedAt ? now - tracker.hiddenStartedAt : 0);
        return Math.max(0, Math.floor((now - tracker.startedAt - hiddenDurationMs) / 1000));
      };

      const computeHiddenSeconds = () => {
        const tracker = trackerRef.current;
        if (!tracker || tracker.sessionId !== sessionId) return 0;

        const now = Date.now();
        const hiddenDurationMs =
          tracker.hiddenDurationMs +
          (tracker.hiddenStartedAt ? now - tracker.hiddenStartedAt : 0);
        return Math.max(0, Math.floor(hiddenDurationMs / 1000));
      };

      const buildEnvironment = () => {
        const tracker = trackerRef.current;
        return detectVisitorEnvironment({
          maxScrollPercent: tracker?.maxScrollPercent ?? getScrollPercent(),
          interactionCount: tracker?.interactionCount ?? 0,
          heartbeatCount: tracker?.heartbeatCount ?? 0,
          visibleSeconds: computeVisibleSeconds(),
          hiddenSeconds: computeHiddenSeconds(),
        });
      };

      const sendHeartbeat = async (keepalive = false) => {
        const tracker = trackerRef.current;
        if (!tracker || tracker.sessionId !== sessionId) return;

        const dwellSeconds = computeDwellSeconds();
        const shouldSkip =
          !keepalive &&
          (!tracker.sentAtLeastOnce || dwellSeconds <= tracker.lastSentDwellSeconds);

        if (shouldSkip) return;

        const geo = await geoPromise;
        tracker.heartbeatCount += 1;
        const environment = buildEnvironment();

        await upsertVisitorSession({
          pagePath: tracker.path,
          visitorHash: tracker.visitorHash,
          sessionId: tracker.sessionId,
          dwellSeconds,
          environment,
          geo,
        }, { keepalive });

        if (trackerRef.current?.sessionId === sessionId) {
          trackerRef.current.lastSentDwellSeconds = dwellSeconds;
          trackerRef.current.sentAtLeastOnce = true;
        }
      };

      trackerRef.current = {
        path,
        visitorHash,
        sessionId,
        startedAt,
        hiddenStartedAt: document.visibilityState === "hidden" ? startedAt : null,
        hiddenDurationMs: 0,
        lastSentDwellSeconds: 0,
        sentAtLeastOnce: false,
        maxScrollPercent: getScrollPercent(),
        interactionCount: 0,
        heartbeatCount: 0,
        lastInteractionAt: startedAt,
      };

      const intervalId = window.setInterval(() => {
        void sendHeartbeat();
      }, 15000);

      const recordInteraction = () => {
        const tracker = trackerRef.current;
        if (!tracker || tracker.sessionId !== sessionId) return;

        const now = Date.now();
        if (now - tracker.lastInteractionAt < 600) return;
        tracker.lastInteractionAt = now;
        tracker.interactionCount += 1;
      };

      const onScroll = () => {
        const tracker = trackerRef.current;
        if (!tracker || tracker.sessionId !== sessionId) return;

        tracker.maxScrollPercent = Math.max(
          tracker.maxScrollPercent,
          getScrollPercent()
        );
      };

      const onPageHide = () => {
        void sendHeartbeat(true);
      };
      const onVisibilityChange = () => {
        const tracker = trackerRef.current;
        if (!tracker || tracker.sessionId !== sessionId) return;

        if (document.visibilityState === "hidden") {
          if (!tracker.hiddenStartedAt) {
            tracker.hiddenStartedAt = Date.now();
          }
          void sendHeartbeat(true);
          return;
        }

        if (tracker.hiddenStartedAt) {
          tracker.hiddenDurationMs += Date.now() - tracker.hiddenStartedAt;
          tracker.hiddenStartedAt = null;
        }
      };

      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("beforeunload", onPageHide);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("pointerdown", recordInteraction, { passive: true });
      window.addEventListener("keydown", recordInteraction);
      window.addEventListener("touchstart", recordInteraction, { passive: true });
      document.addEventListener("visibilitychange", onVisibilityChange);

      if (trackerRef.current && trackerRef.current.sessionId === sessionId) {
        trackerRef.current.intervalId = intervalId;
        trackerRef.current.firstHeartbeatId = window.setTimeout(() => {
          void sendHeartbeat();
        }, 5000);
        trackerRef.current.cleanup = () => {
          window.removeEventListener("pagehide", onPageHide);
          window.removeEventListener("beforeunload", onPageHide);
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("pointerdown", recordInteraction);
          window.removeEventListener("keydown", recordInteraction);
          window.removeEventListener("touchstart", recordInteraction);
          document.removeEventListener("visibilitychange", onVisibilityChange);
        };
      }
    },
    [stopDetailedTracker]
  );

  const loadCounter = React.useCallback(async () => {
    const runtimePath =
      typeof window !== "undefined" && window.location?.pathname
        ? window.location.pathname
        : fallbackPath;
    const path = normalizePath(runtimePath);
    setCurrentPath(path);
    setIsLoading(true);

    const userHash = generateUserHash("astro-obsidian-blog:pageview");
    void startDetailedTracker(path, userHash);

    if (shouldTrackThisSession(path, dedupeMinutes)) {
      await trackPageView(path, userHash, dedupeMinutes);
    }

    const nextStats = await getPageVisitStats(path);

    setStats(
      nextStats
        ? {
            viewCount: nextStats.view_count,
            visitorCount: nextStats.visitor_count,
          }
        : null
    );
    setIsLoading(false);
  }, [dedupeMinutes, fallbackPath, startDetailedTracker]);

  React.useEffect(() => {
    void loadCounter();

    const handlePageLoad = () => {
      void loadCounter();
    };

    document.addEventListener("astro:page-load", handlePageLoad);
    return () => {
      document.removeEventListener("astro:page-load", handlePageLoad);
      stopDetailedTracker();
    };
  }, [loadCounter, stopDetailedTracker]);

  const averageViewsPerVisitor =
    stats && stats.visitorCount > 0
      ? (stats.viewCount / stats.visitorCount).toFixed(2)
      : null;

  return (
    <span
      className="page-view-counter"
      aria-live="polite"
      title={`${UI_TEXT.viewsLabel}/${UI_TEXT.visitorsLabel}: ${currentPath}`}
    >
      <span className="page-view-counter__icon" aria-hidden="true">
        👁
      </span>
      <span className="page-view-counter__label">{UI_TEXT.viewsLabel}</span>
      <span className="page-view-counter__value">
        {isLoading
          ? UI_TEXT.loading
          : stats !== null
            ? stats.viewCount.toLocaleString()
            : UI_TEXT.unavailable}
      </span>
      <span className="page-view-counter__separator" aria-hidden="true">
        ·
      </span>
      <span className="page-view-counter__label">{UI_TEXT.visitorsLabel}</span>
      <span className="page-view-counter__value">
        {isLoading
          ? UI_TEXT.loading
          : stats !== null
            ? stats.visitorCount.toLocaleString()
            : UI_TEXT.unavailable}
      </span>
      <span className="page-view-counter__separator" aria-hidden="true">
        ·
      </span>
      <span className="page-view-counter__label">{UI_TEXT.averageLabel}</span>
      <span className="page-view-counter__value">
        {isLoading
          ? UI_TEXT.loading
          : averageViewsPerVisitor !== null
            ? averageViewsPerVisitor
            : UI_TEXT.unavailable}
      </span>
    </span>
  );
};

export default PageViewCounter;
