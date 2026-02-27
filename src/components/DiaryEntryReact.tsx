import React from "react";
import TimelineItemReact from "./TimelineItemReact";
import { SITE } from "../config";
import { UI, UI_LOCALE } from "@/i18n/ui";

// 本地电影数据接口
interface LocalMovieData {
  id?: number;
  title: string;
  release_date?: string;
  region?: string;
  rating?: number;
  runtime?: number;
  genres?: string;
  overview?: string;
  poster?: string;
  source?: string;
  external_url?: string;
}

// 本地TV数据接口
interface LocalTVData {
  id?: string;
  title: string;
  release_date?: string;
  region?: string;
  rating?: number;
  genres?: string;
  overview?: string;
  poster?: string;
  source?: string;
  external_url?: string;
}

// 本地书籍数据接口
interface LocalBookData {
  id?: string;
  title: string;
  release_date?: string;
  region?: string;
  rating?: number;
  genres?: string;
  overview?: string;
  poster?: string;
  external_url?: string;
}

// 本地音乐数据接口
interface LocalMusicData {
  title: string;
  author?: string;
  album?: string;
  duration?: number;
  genres?: string;
  poster?: string;
  url?: string;
}

export interface TimeBlock {
  time: string;
  showTime?: boolean;
  text?: string;
  images?: Array<{
    alt: string;
    src: string;
    title?: string;
    original?: string;
    width?: number;
    height?: number;
  }>;
  imageGroups?: Array<
    Array<{
      alt: string;
      src: string;
      title?: string;
      original?: string;
      width?: number;
      height?: number;
    }>
  >;
  htmlContent?: string;
  movieData?: LocalMovieData;
  tvData?: LocalTVData;
  bookData?: LocalBookData;
  musicData?: LocalMusicData;
}

export interface DiaryEntryProps {
  date: string;
  dateEnd?: string;
  isDateRange?: boolean;
  locationName?: string;
  locationUrl?: string;
  hideYear?: boolean;
  timeBlocks: TimeBlock[];
}

const TZ = SITE.timezone;
const DATE_LOCALE = UI_LOCALE === "zh-CN" ? "zh-CN" : "en-US";

// 将 Date -> "YYYY-MM-DD"（按指定时区），便于比较"今天/昨天/前天"
function toYMD(d: Date, timeZone = TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // en-CA 会输出 2025-08-17
}

// 解析 "YYYY-MM-DD" 为一个 UTC 的 00:00:00 时间点，避免本地时区干扰
function ymdToUTC(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const DiaryEntryReact: React.FC<DiaryEntryProps> = ({
  date,
  dateEnd,
  isDateRange = false,
  locationName,
  locationUrl,
  hideYear = false,
  timeBlocks,
}) => {
  const entryId = isDateRange && dateEnd ? `${date}_to_${dateEnd}` : date;

  // 1) 先准备稳定的 SSR 文案：绝对日期 (MM/DD) + 固定时区的星期/年份
  const entryDateUTC = ymdToUTC(date);

  const absoluteStartLabel = new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: TZ,
    month: "2-digit",
    day: "2-digit",
  }).format(entryDateUTC);

  const entryEndDateUTC = dateEnd ? ymdToUTC(dateEnd) : null;
  const absoluteEndLabel = entryEndDateUTC
    ? new Intl.DateTimeFormat(DATE_LOCALE, {
        timeZone: TZ,
        month: "2-digit",
        day: "2-digit",
      }).format(entryEndDateUTC)
    : null;

  const absoluteLabel =
    isDateRange && absoluteEndLabel
      ? `${absoluteStartLabel}-${absoluteEndLabel}`
      : absoluteStartLabel;

  const weekdayLabel = new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: TZ,
    weekday: "short",
  }).format(entryDateUTC);

  const yearLabel = new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: TZ,
    year: "numeric",
  }).format(entryDateUTC);

  // 2) 客户端再计算"今天/昨天/前天"，并替换显示
  const [relativeLabel, setRelativeLabel] = React.useState<string | null>(null);
  const hasLocation = Boolean(locationName && locationUrl);

  React.useLayoutEffect(() => {
    if (isDateRange) {
      setRelativeLabel(null);
      return;
    }

    const now = new Date();
    // 当天(按 TZ) 与条目日期(按 TZ) 的日历日
    const todayYMD = toYMD(now, TZ);
    const entryYMD = toYMD(entryDateUTC, TZ);

    // 把 "YYYY-MM-DD" 转为 UTC 00:00 计算"整日"差
    const todayUTC = ymdToUTC(todayYMD);
    const entryUTC = ymdToUTC(entryYMD);

    const diffDays = Math.floor(
      (todayUTC.getTime() - entryUTC.getTime()) / 86400000
    );

    if (diffDays === 0) setRelativeLabel(UI_LOCALE === "zh-CN" ? "今天" : "Today");
    else if (diffDays === 1)
      setRelativeLabel(UI_LOCALE === "zh-CN" ? "昨天" : "Yesterday");
    else if (diffDays === 2)
      setRelativeLabel(UI_LOCALE === "zh-CN" ? "前天" : "2 days ago");
    else setRelativeLabel(null); // 超过范围就用 SSR 的 absoluteLabel
  }, [date, isDateRange]);

  return (
    <div className="date-group mb-16" data-pagefind-weight="2">
      <header className="mb-8">
        <div className="flex items-baseline gap-3">
          <h2
            id={`date-${entryId}`}
            className="text-skin-accent m-0 text-3xl leading-none font-bold"
            aria-label={`${relativeLabel ?? absoluteLabel} ${weekdayLabel} ${!hideYear ? yearLabel : ""} ${UI_LOCALE === "zh-CN" ? "日记" : "diary entry"}`}
          >
            {/* SSR 时渲染 absoluteLabel；CSR 完成后若有相对文案则替换。
               suppressHydrationWarning 防止首帧文本差异触发水合警告 */}
            <span suppressHydrationWarning>
              {relativeLabel ?? absoluteLabel}
            </span>
          </h2>
          <div className="flex flex-col" aria-hidden="true">
            <div className="text-skin-base text-base leading-tight font-medium">
              {weekdayLabel}
            </div>
            {!hideYear && (
              <div className="text-skin-base/70 text-sm leading-tight">
                {yearLabel}
              </div>
            )}
          </div>
        </div>
        {hasLocation && (
          <div className="mt-2">
            <a
              href={locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-skin-base/80 underline decoration-dashed underline-offset-4 transition-colors hover:text-accent"
              aria-label={`${UI.diary.location}: ${locationName}`}
            >
              <span aria-hidden="true">📍</span>
              <span>{locationName}</span>
            </a>
          </div>
        )}
        <div className="sr-only">
          {UI_LOCALE === "zh-CN"
            ? `${date} 共有 ${timeBlocks.length} 个时间段的记录`
            : `${date} contains ${timeBlocks.length} timeline blocks`}
        </div>
      </header>

      <div
        id={`content-${entryId}`}
        className="space-y-0"
        role="group"
        aria-labelledby={`date-${entryId}`}
      >
        {timeBlocks.map((block, index) => (
          <TimelineItemReact
            key={`${date}-${block.time}-${index}`}
            time={block.time}
            showTime={block.showTime}
            date={date}
            text={block.text}
            images={block.images}
            imageGroups={block.imageGroups}
            htmlContent={block.htmlContent}
            movieData={block.movieData}
            tvData={block.tvData}
            bookData={block.bookData}
            musicData={block.musicData}
          />
        ))}
      </div>
    </div>
  );
};

export default DiaryEntryReact;
