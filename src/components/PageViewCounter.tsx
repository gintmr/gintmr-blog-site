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
    intervalId?: number;
    cleanup?: () => void;
  } | null>(null);

  const stopDetailedTracker = React.useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;

    if (tracker.intervalId) {
      window.clearInterval(tracker.intervalId);
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
      const environment = detectVisitorEnvironment();
      const geoPromise = getVisitorGeoInfo();

      const sendHeartbeat = async () => {
        const tracker = trackerRef.current;
        if (!tracker || tracker.sessionId !== sessionId) return;

        const dwellSeconds = Math.max(
          0,
          Math.floor((Date.now() - tracker.startedAt) / 1000)
        );
        const geo = await geoPromise;

        await upsertVisitorSession({
          pagePath: tracker.path,
          visitorHash: tracker.visitorHash,
          sessionId: tracker.sessionId,
          dwellSeconds,
          environment,
          geo,
        });
      };

      trackerRef.current = {
        path,
        visitorHash,
        sessionId,
        startedAt,
      };

      await sendHeartbeat();

      const intervalId = window.setInterval(() => {
        void sendHeartbeat();
      }, 20000);

      const onPageHide = () => {
        void sendHeartbeat();
      };
      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          void sendHeartbeat();
        }
      };

      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("beforeunload", onPageHide);
      document.addEventListener("visibilitychange", onVisibilityChange);

      if (trackerRef.current && trackerRef.current.sessionId === sessionId) {
        trackerRef.current.intervalId = intervalId;
        trackerRef.current.cleanup = () => {
          window.removeEventListener("pagehide", onPageHide);
          window.removeEventListener("beforeunload", onPageHide);
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
