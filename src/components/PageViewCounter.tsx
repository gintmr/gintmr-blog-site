import React from "react";
import {
  generateUserHash,
  getPageVisitStats,
  trackPageView,
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

  const loadCounter = React.useCallback(async () => {
    const runtimePath =
      typeof window !== "undefined" && window.location?.pathname
        ? window.location.pathname
        : fallbackPath;
    const path = normalizePath(runtimePath);
    setCurrentPath(path);
    setIsLoading(true);

    const userHash = generateUserHash("astro-obsidian-blog:pageview");

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
  }, [dedupeMinutes, fallbackPath]);

  React.useEffect(() => {
    void loadCounter();

    const handlePageLoad = () => {
      void loadCounter();
    };

    document.addEventListener("astro:page-load", handlePageLoad);
    return () => {
      document.removeEventListener("astro:page-load", handlePageLoad);
    };
  }, [loadCounter]);

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
