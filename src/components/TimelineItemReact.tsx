import React, { useEffect, useMemo, useRef } from "react";
import MediaCard from "./MediaCard";
import EmojiReactions from "./EmojiReactions";
import type { MediaCardData } from "../types/media";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/client";

// 导入 lightgallery 样式
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";

export interface TimelineItemProps {
  time: string;
  showTime?: boolean;
  date?: string;
  text?: string;
  images?: TimelineImage[];
  imageGroups?: TimelineImage[][];
  htmlContent?: string;
  movieData?: MediaCardData;
  tvData?: MediaCardData;
  bookData?: MediaCardData;
  musicData?: MediaCardData;
}

interface TimelineImage {
  alt: string;
  src: string;
  title?: string;
  original?: string;
  width?: number;
  height?: number;
}

interface NormalizedTimelineImage {
  alt: string;
  thumbnail: string;
  original: string;
  title?: string;
  width: number;
  height: number;
}

const IMAGE_GROUP_PLACEHOLDER_REGEX = /\+\+DIARY_IMAGE_GROUP_(\d+)\+\+/g;

function normalizeTimelineImage(image: TimelineImage): NormalizedTimelineImage {
  return {
    alt: image.alt,
    thumbnail: image.src,
    original: image.original || image.src,
    title: image.title,
    width: image.width || 800,
    height: image.height || 600,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TimelineItemReact: React.FC<TimelineItemProps> = ({
  time,
  showTime = true,
  date,
  text,
  images,
  imageGroups,
  htmlContent,
  movieData,
  tvData,
  bookData,
  musicData,
}) => {
  const galleryRef = useRef<HTMLDivElement>(null);
  const lightGalleryRef = useRef<{ destroy: () => void } | null>(null);
  const normalizedInlineImageGroups = useMemo(
    () =>
      (imageGroups || [])
        .map(group => group.map(normalizeTimelineImage))
        .filter(group => group.length > 0),
    [imageGroups]
  );

  const normalizedLegacyImages = useMemo(
    () => (images || []).map(normalizeTimelineImage),
    [images]
  );

  const allGalleryGroups = useMemo(
    () => [
      ...normalizedInlineImageGroups,
      ...(normalizedLegacyImages.length > 0 ? [normalizedLegacyImages] : []),
    ],
    [normalizedInlineImageGroups, normalizedLegacyImages]
  );

  const hasInlineImageMarkers = Boolean(
    text && text.includes("++DIARY_IMAGE_GROUP_")
  );
  const hasAnyGalleryImages = allGalleryGroups.length > 0;

  // 初始化 lightgallery（依赖于图片优化完成）
  useEffect(() => {
    if (hasAnyGalleryImages && galleryRef.current) {
      // 使用动态导入来避免 ES 模块问题
      const initLightGallery = async () => {
        try {
          const { default: lightGallery } = await import("lightgallery");
          const { default: lgZoom } = await import("lightgallery/plugins/zoom");

          // 初始化 lightgallery
          lightGalleryRef.current = lightGallery(galleryRef.current!, {
            plugins: [lgZoom],
            speed: 400,
            selector: "a.lg-item",
            download: false,
            counter: false,
            getCaptionFromTitleOrAlt: false,
            mode: "lg-fade",
            hideBarsDelay: 2000,
            showZoomInOutIcons: true,
            actualSize: false,
            enableDrag: true,
            enableSwipe: true,
            zoomFromOrigin: true,
            allowMediaOverlap: false,
          });
        } catch {
          // Failed to load lightGallery - silently handle the error
        }
      };

      initLightGallery();
    }

    return () => {
      if (lightGalleryRef.current) {
        lightGalleryRef.current.destroy();
      }
    };
  }, [hasAnyGalleryImages, allGalleryGroups]);

  const renderImageGroup = (
    groupImages: NormalizedTimelineImage[],
    groupKey: string
  ) => {
    if (groupImages.length === 0) return null;

    return (
      <figure
        key={groupKey}
        className="images-grid mb-4"
        role="group"
        aria-label={`图片集合，共 ${groupImages.length} 张图片`}
      >
        <div
          className={`grid gap-3 ${
            htmlContent
              ? "w-full grid-cols-1"
              : groupImages.length === 1
                ? "max-w-80 grid-cols-1"
                : groupImages.length === 2
                  ? "max-w-83 grid-cols-2"
                  : groupImages.length === 4
                    ? "max-w-83 grid-cols-2"
                    : "max-w-126 grid-cols-3"
          }`}
        >
          {groupImages.map((image, imageIndex) => {
            const hasCaption = Boolean(image.title);
            const captionForLightbox =
              image.title || `${image.width}x${image.height}`;

            return (
              <div
                key={`${groupKey}-${imageIndex}`}
                className={hasCaption ? "space-y-1" : ""}
              >
                <a
                  className={`lg-item group focus:ring-skin-accent block overflow-hidden rounded-xl focus:outline-none ${
                    groupImages.length === 1
                      ? "relative"
                      : "image-item relative aspect-square"
                  }`}
                  style={
                    groupImages.length === 1
                      ? {}
                      : ({
                          aspectRatio: "1 / 1",
                          WebkitAspectRatio: "1 / 1",
                        } as React.CSSProperties)
                  }
                  data-src={image.original}
                  data-lg-size={`${image.width}-${image.height}`}
                  data-sub-html={`<h4>${escapeHtml(image.alt)}</h4><p>${escapeHtml(captionForLightbox)}</p>`}
                  href={image.original}
                  aria-label={`查看大图：${image.alt}${image.title ? ` - ${image.title}` : ""}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}
                >
                  <img
                    src={image.thumbnail}
                    alt={image.alt || `图片 ${imageIndex + 1}`}
                    className="h-full w-full cursor-pointer object-cover transition-transform duration-300 hover:scale-105"
                    style={
                      groupImages.length === 1
                        ? {}
                        : {
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }
                    }
                    loading="lazy"
                    title={image.title}
                  />
                </a>
                {hasCaption && (
                  <figcaption className="text-skin-base/70 px-1 text-xs leading-snug">
                    {image.title}
                  </figcaption>
                )}
              </div>
            );
          })}
        </div>
        {groupImages.length > 1 && (
          <figcaption className="sr-only">
            图片集合包含 {groupImages.length} 张图片，点击任意图片可查看大图
          </figcaption>
        )}
      </figure>
    );
  };

  const renderTextWithInlineImageGroups = () => {
    if (!text) return null;

    if (!hasInlineImageMarkers) {
      return (
        <div
          className="mb-4 text-base leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }

    IMAGE_GROUP_PLACEHOLDER_REGEX.lastIndex = 0;
    const renderedNodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;
    let segmentIndex = 0;

    while ((match = IMAGE_GROUP_PLACEHOLDER_REGEX.exec(text)) !== null) {
      const htmlSegment = text.slice(lastIndex, match.index);
      if (htmlSegment.trim()) {
        renderedNodes.push(
          <div
            key={`html-segment-${segmentIndex}`}
            className="mb-4 text-base leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: htmlSegment }}
          />
        );
        segmentIndex++;
      }

      const groupIndex = Number.parseInt(match[1], 10);
      const targetGroup = normalizedInlineImageGroups[groupIndex];
      if (targetGroup && targetGroup.length > 0) {
        renderedNodes.push(
          renderImageGroup(targetGroup, `inline-group-${groupIndex}`)
        );
      }

      lastIndex = match.index + match[0].length;
    }

    const tailSegment = text.slice(lastIndex);
    if (tailSegment.trim()) {
      renderedNodes.push(
        <div
          key={`html-segment-${segmentIndex}`}
          className="mb-4 text-base leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: tailSegment }}
        />
      );
    }

    return renderedNodes;
  };

  const hasTimeLabel = showTime && Boolean(time);
  const timeLabel = hasTimeLabel ? `${time} 时间段的记录` : "日记记录";
  const reactionKey = `${date ?? "unknown"}-${
    hasTimeLabel ? time.replace(":", "-") : "no-time"
  }`;

  return (
    <article
      className="mb-6 border-b border-dashed border-border/30 pb-6 last:border-b-0 last:pb-0"
      tabIndex={0}
      role="article"
      aria-label={timeLabel}
    >
      <div className="content group transition-all duration-300">
        {/* 时间和内容整合显示 */}
        <div className="flex items-start gap-3">
          {hasTimeLabel && (
            <h3
              id={date ? `diary-${date}-${time.replace(/:/g, "-")}` : undefined}
              className="text-skin-base/60 m-0 flex-shrink-0 pr-2 pl-0 text-base font-medium"
              aria-label={timeLabel}
            >
              <span className="sr-only">{date}</span>
              <time dateTime={date ? `${date}T${time}` : time}>{time}</time>
            </h3>
          )}
          {/* 内容区域 */}
          <div className="min-w-0 flex-1" ref={galleryRef}>
            {/* 帖子内容 */}
            <div className="text-skin-base">
              {renderTextWithInlineImageGroups()}
              {normalizedLegacyImages.length > 0 &&
                renderImageGroup(normalizedLegacyImages, "legacy-image-group")}

              {htmlContent && (
                <div
                  className="html-content mt-0 mb-4 max-w-none leading-[0]"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                  suppressHydrationWarning={true}
                  role="region"
                  aria-label="富文本内容"
                />
              )}

              {movieData && (
                <section
                  className="movie-card-container mb-4 px-0"
                  aria-label="电影信息"
                >
                  <MediaCard mediaData={movieData} cardType="movie" />
                </section>
              )}

              {tvData && (
                <section
                  className="tv-card-container mb-4 px-0"
                  aria-label="电视剧信息"
                >
                  <MediaCard mediaData={tvData} cardType="tv" />
                </section>
              )}

              {bookData && (
                <section
                  className="book-card-container mb-4 px-0"
                  aria-label="书籍信息"
                >
                  <MediaCard mediaData={bookData} cardType="book" />
                </section>
              )}

              {musicData && (
                <section
                  className="music-card-container mb-4 px-0"
                  aria-label="音乐信息"
                >
                  <MediaCard mediaData={musicData} cardType="music" />
                </section>
              )}

              {/* 表情组件 */}
              {SUPABASE_URL && SUPABASE_KEY && (
                <EmojiReactions id={`emoji-reactions-${reactionKey}`} />
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default TimelineItemReact;
