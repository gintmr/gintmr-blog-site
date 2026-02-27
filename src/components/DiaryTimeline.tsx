import React, { useState, useEffect, useRef, useCallback } from "react";
import DiaryEntryReact, { type TimeBlock } from "./DiaryEntryReact";
import { UI } from "@/i18n/ui";

export interface ParsedEntry {
  date: string;
  dateEnd?: string;
  isDateRange?: boolean;
  timeBlocks: TimeBlock[];
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  itemsPerPage: number;
}

export interface DiaryTimelineProps {
  initialEntries: ParsedEntry[];
  paginationInfo: PaginationInfo;
  hideYear?: boolean;
}

const DiaryTimeline: React.FC<DiaryTimelineProps> = ({
  initialEntries = [],
  paginationInfo = {
    currentPage: 1,
    totalPages: 1,
    hasMore: false,
    itemsPerPage: 5,
  },
  hideYear = false,
}) => {
  const [displayedEntries, setDisplayedEntries] = useState<ParsedEntry[]>(
    initialEntries || []
  );
  const [currentPage, setCurrentPage] = useState(
    paginationInfo?.currentPage || 1
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(paginationInfo?.hasMore || false);

  // 使用 ref 来存储最新的状态值，避免闭包问题
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(paginationInfo?.hasMore || false);
  const currentPageRef = useRef(paginationInfo?.currentPage || 1);
  const loadingRequestRef = useRef<Set<number>>(new Set()); // 记录正在请求的页面
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 更新 ref 值
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMoreRef.current) return;

    const nextPage = currentPageRef.current + 1;

    // 检查是否已经在请求这个页面
    if (loadingRequestRef.current.has(nextPage)) {
      return;
    }

    setIsLoading(true);
    loadingRequestRef.current.add(nextPage);

    try {
      const response = await fetch(`/api/diary/${nextPage}.json`);

      if (!response.ok) {
        throw new Error("Failed to fetch diary entries");
      }

      const data = await response.json();

      if (data.entries && data.entries.length > 0) {
        setDisplayedEntries(prev => [...prev, ...data.entries]);
        setCurrentPage(nextPage);
        setHasMore(data.pagination.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more entries:", error);
      setHasMore(false);
    } finally {
      loadingRequestRef.current.delete(nextPage);
      setIsLoading(false);
    }
  }, []);

  // 监听滚动事件，实现无限滚动
  useEffect(() => {
    const handleScroll = () => {
      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 防抖处理，延迟执行
      scrollTimeoutRef.current = setTimeout(() => {
        if (
          window.innerHeight + document.documentElement.scrollTop >=
          document.documentElement.offsetHeight - 1000
        ) {
          loadMore();
        }
      }, 100); // 100ms 防抖
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [loadMore]);

  // 更新父容器的 aria-busy 状态
  useEffect(() => {
    const feedElement = document.getElementById("diary-content");
    if (feedElement) {
      feedElement.setAttribute("aria-busy", isLoading.toString());
    }
  }, [isLoading]);

  return (
    <>
      {displayedEntries.map((entry, index) => {
        const entryId =
          entry.isDateRange && entry.dateEnd
            ? `${entry.date}_to_${entry.dateEnd}`
            : entry.date;

        return (
          <article
            key={`${entry.date}-${index}`}
            role="article"
            aria-labelledby={`date-${entryId}`}
            aria-describedby={`content-${entryId}`}
            tabIndex={0}
            className="focus:ring-skin-accent focus:ring-offset-skin-fill rounded-lg focus:outline-none"
          >
            <DiaryEntryReact
              date={entry.date}
              dateEnd={entry.dateEnd}
              isDateRange={entry.isDateRange}
              hideYear={hideYear}
              timeBlocks={entry.timeBlocks}
            />
          </article>
        );
      })}

      {displayedEntries.length === 0 && (
        <article role="article" className="py-12 text-center">
          <div role="status" aria-live="polite">
            <p className="text-skin-base opacity-60">{UI.diary.empty}</p>
          </div>
        </article>
      )}

      {isLoading && (
        <article role="article" className="loading py-8 text-center">
          <div
            role="status"
            aria-live="assertive"
            aria-label={UI.diary.loadingAria}
          >
            <p className="text-skin-base opacity-60">{UI.diary.loading}</p>
            <div className="sr-only">{UI.diary.loadingHint}</div>
          </div>
        </article>
      )}

      {!hasMore && displayedEntries.length > 0 && (
        <article role="article" className="no-more py-8 text-center">
          <div role="status" aria-live="polite">
            <p className="text-skin-base opacity-60">{UI.diary.noMore}</p>
            <div className="sr-only">{UI.diary.noMoreHint(displayedEntries.length)}</div>
          </div>
        </article>
      )}

      {/* 手动加载更多按钮，为键盘用户提供替代方案 */}
      {hasMore && !isLoading && (
        <article role="article" className="py-8 text-center">
          <button
            onClick={loadMore}
            className="bg-skin-accent text-skin-inverted hover:bg-skin-accent/90 focus:ring-skin-accent focus:ring-offset-skin-fill rounded-lg px-6 py-3 transition-colors focus:outline-none"
            aria-describedby="load-more-description"
          >
            {UI.diary.loadMore}
          </button>
          <div id="load-more-description" className="sr-only">
            {UI.diary.loadMoreHint}
          </div>
        </article>
      )}
    </>
  );
};

export default DiaryTimeline;
