import React from "react";
import {
  generateUserHash,
  getPageViewCount,
  trackPageView,
} from "@/db/supabase";
import { UI_LOCALE } from "@/i18n/ui";

interface PageViewCounterProps {
  fallbackPath?: string;
  dedupeMinutes?: number;
}

const UI_TEXT =
  UI_LOCALE === "zh-CN"
    ? { label: "浏览", loading: "统计中", unavailable: "--" }
    : { label: "Views", loading: "Loading", unavailable: "--" };

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
  const [count, setCount] = React.useState<number | null>(null);
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

    let nextCount: number | null = null;
    if (shouldTrackThisSession(path, dedupeMinutes)) {
      nextCount = await trackPageView(path, userHash, dedupeMinutes);
    }

    if (nextCount === null) {
      nextCount = await getPageViewCount(path);
    }

    setCount(nextCount);
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

  return (
    <span
      className="page-view-counter"
      aria-live="polite"
      title={`${UI_TEXT.label}: ${currentPath}`}
    >
      <span className="page-view-counter__icon" aria-hidden="true">
        👁
      </span>
      <span className="page-view-counter__label">{UI_TEXT.label}</span>
      <span className="page-view-counter__value">
        {isLoading
          ? UI_TEXT.loading
          : count !== null
            ? count.toLocaleString()
            : UI_TEXT.unavailable}
      </span>
    </span>
  );
};

export default PageViewCounter;
