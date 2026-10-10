/**
 * 归档条目：Top 页与 Blog 时间线共用同一份取数与排序逻辑。
 *
 * 一个条目 = 一篇 blog 文章或一期 story，字段刻意做成「显示需要什么就有什么」，
 * 页面不再各自去 getCollection / 算图片 / 判置顶，避免两页口径不一致。
 *
 * 置顶判定：frontmatter 里 featured: true，或 pubDatetime 写成 "top"。
 * 置顶条目仍然带日期时（modDatetime），它会出现在时间轴的对应位置上，
 * 不会被提到最前面 —— Top 页才是置顶的专属视图。
 */
import { getCollection } from "astro:content";
import { getPath } from "./getPath";
import { getStoryPath, getStoryTitle } from "./getStoryPath";
import { optimizeImage } from "./optimizeImages";
import { isDatePubDatetime, isTopPubDatetime } from "./pubDatetime";

export type ArchiveKind = "blog" | "story";

export interface ArchiveItem {
  kind: ArchiveKind;
  title: string;
  description: string;
  /** 排序与显示用的日期；置顶但没有日期时为 null */
  date: Date | null;
  modDatetime?: Date | null;
  timezone?: string;
  url: string;
  imageSrc?: string;
  pinned: boolean;
  /** 原始标签（未 slug 化），标签页用它筛选 */
  tags: string[];
}

const readBlogImage = async (
  ogImage: unknown
): Promise<string | undefined> => {
  if (typeof ogImage === "string" && ogImage.trim()) {
    const optimized = await optimizeImage(ogImage, { thumbnailSize: 300 });
    return optimized.thumbnail;
  }
  if (
    ogImage &&
    typeof ogImage === "object" &&
    "src" in ogImage &&
    typeof (ogImage as { src?: unknown }).src === "string"
  ) {
    return (ogImage as { src: string }).src;
  }
  return undefined;
};

export async function getArchiveItems(): Promise<ArchiveItem[]> {
  const blogPosts = await getCollection("blog", ({ data }) => !data.draft);
  const storyPosts = await getCollection("story", ({ data }) => !data.draft);

  const blogItems: ArchiveItem[] = await Promise.all(
    blogPosts.map(async post => {
      const { pubDatetime, modDatetime, featured } = post.data;
      const dated = isDatePubDatetime(pubDatetime)
        ? pubDatetime
        : isDatePubDatetime(modDatetime)
          ? modDatetime
          : null;
      return {
        kind: "blog" as const,
        title: post.data.title,
        description: post.data.description,
        date: dated,
        modDatetime,
        timezone: post.data.timezone,
        url: getPath(post.id, post.filePath),
        imageSrc: await readBlogImage(post.data.ogImage),
        pinned: featured === true || isTopPubDatetime(pubDatetime),
        tags: post.data.tags ?? [],
      };
    })
  );

  const storyItems: ArchiveItem[] = storyPosts.map(story => {
    const { pubDatetime, modDatetime } = story.data;
    const dated = isDatePubDatetime(pubDatetime)
      ? pubDatetime
      : isDatePubDatetime(modDatetime)
        ? modDatetime
        : null;
    return {
      kind: "story" as const,
      title: getStoryTitle(story.data.title, story.id, story.filePath),
      description: story.data.description ?? "",
      date: dated,
      modDatetime,
      url: getStoryPath(story.id, story.filePath),
      // story 模板里没有 featured 字段，置顶只能靠 pubDatetime: "top"
      pinned: isTopPubDatetime(pubDatetime),
      tags: [],
    };
  });

  return [...blogItems, ...storyItems];
}

/** 完整时间线：按日期倒序。没有日期的置顶条目排在最后（它在时间轴上没有落点）。 */
export function sortByTimeline(items: ArchiveItem[]): ArchiveItem[] {
  return [...items].sort((a, b) => {
    if (!a.date && !b.date) return a.title.localeCompare(b.title, "zh-Hans-CN");
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.getTime() - a.date.getTime();
  });
}

export interface TimelineMonth {
  key: string;
  year: number;
  month: number;
  items: ArchiveItem[];
}

export interface TimelineYear {
  year: number;
  count: number;
  months: TimelineMonth[];
}

/** 按年 → 月分组，年与月都从新到旧 */
export function groupByYearMonth(items: ArchiveItem[]): TimelineYear[] {
  const years = new Map<number, Map<number, ArchiveItem[]>>();
  items.forEach(item => {
    if (!item.date) return;
    const year = item.date.getFullYear();
    const month = item.date.getMonth() + 1;
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(item);
  });

  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => {
      const grouped = [...months.entries()]
        .sort(([a], [b]) => b - a)
        .map(([month, monthItems]) => ({
          key: `${year}-${String(month).padStart(2, "0")}`,
          year,
          month,
          items: monthItems,
        }));
      return {
        year,
        count: grouped.reduce((sum, group) => sum + group.items.length, 0),
        months: grouped,
      };
    });
}
