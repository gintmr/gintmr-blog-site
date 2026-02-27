import { visit } from "unist-util-visit";
import type { Root, Code, Paragraph } from "mdast";
import type { Node } from "unist";
import type {
  MediaCardData,
  MediaCardOptions,
  MediaCardType,
} from "../types/media";

interface Parent extends Node {
  children: Node[];
}

function parseCardContent(content: string): MediaCardData | null {
  const lines = content
    .trim()
    .split("\n")
    .filter(line => line.trim());
  const data: Record<string, string | number> = {};

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (!key || !value) continue;

    if (/^\d+(\.\d+)?$/.test(value)) {
      data[key] = parseFloat(value);
    } else {
      data[key] = value;
    }
  }

  if (!data.title || typeof data.title !== "string") {
    return null;
  }

  return data as unknown as MediaCardData;
}

function getCardUrl(cardType: MediaCardType, mediaData: MediaCardData): string {
  if (cardType === "music" && mediaData.url) {
    return mediaData.url;
  }

  if (mediaData.external_url) {
    return mediaData.external_url;
  }

  if (!mediaData.id) {
    return "#";
  }

  if (cardType === "tv") {
    return mediaData.source === "douban"
      ? `https://movie.douban.com/subject/${mediaData.id}`
      : `https://www.themoviedb.org/tv/${mediaData.id}`;
  }

  if (cardType === "book") {
    return `https://book.douban.com/subject/${mediaData.id}`;
  }

  return mediaData.source === "douban"
    ? `https://movie.douban.com/subject/${mediaData.id}`
    : `https://www.themoviedb.org/movie/${mediaData.id}`;
}

function buildMediaMeta(cardType: MediaCardType, mediaData: MediaCardData): string {
  const parts: string[] = [];

  if (mediaData.release_date) {
    parts.push(String(mediaData.release_date));
  }

  if (cardType === "book" && mediaData.author) {
    parts.push(String(mediaData.author));
  }

  if ((cardType === "movie" || cardType === "tv") && mediaData.region) {
    parts.push(String(mediaData.region));
  }

  if (mediaData.rating) {
    parts.push(`评分 ${Number(mediaData.rating).toFixed(1)}`);
  }

  return parts.join(" · ");
}

function buildMediaCardNodes(
  cardType: MediaCardType,
  mediaData: MediaCardData
): Node[] {
  const cardTypeLabelMap: Record<MediaCardType, string> = {
    movie: "电影",
    tv: "剧集",
    book: "书籍",
    music: "音乐",
  };

  const title = String(mediaData.title);
  const meta = buildMediaMeta(cardType, mediaData);
  const overview = mediaData.overview ? String(mediaData.overview) : "";
  const genres = String(mediaData.genres || "")
    .split(/[,，]/)
    .map(genre => genre.trim())
    .filter(Boolean);
  const url = getCardUrl(cardType, mediaData);
  const label = cardTypeLabelMap[cardType];
  const details = [meta, overview, genres.join(" / ")].filter(Boolean).join(" ｜ ");

  const titleParagraph: Paragraph = {
    type: "paragraph",
    children: [
      {
        type: "link",
        url,
        title: `${label}：《${title}》`,
        data: {
          hProperties: {
            target: "_blank",
            rel: "noopener noreferrer",
          },
        },
        children: [
          {
            type: "text",
            value: `${label}：《${title}》`,
          },
        ],
      },
    ],
  };

  if (!details) {
    return [titleParagraph];
  }

  const detailsParagraph: Paragraph = {
    type: "paragraph",
    children: [
      {
        type: "text",
        value: details,
      },
    ],
  };

  return [titleParagraph, detailsParagraph];
}

export function remarkMediaCard(options: MediaCardOptions = {}) {
  const { enableDebug = false } = options;

  return function transformer(tree: Root) {
    const nodesToProcess: Array<{
      index: number;
      parent: Parent;
      cardType: MediaCardType;
      mediaData: MediaCardData;
    }> = [];

    visit(tree, "code", (node: Code, index?: number, parent?: Parent) => {
      if (!parent || index === undefined || !parent.children) {
        return;
      }

      const cardTypeMatch = node.lang?.match(/^card-(movie|tv|book|music)$/);
      if (!cardTypeMatch) {
        return;
      }

      const cardType = cardTypeMatch[1];
      const mediaData = parseCardContent(node.value);

      if (!mediaData) {
        if (enableDebug) {
          console.warn(
            `Failed to parse media data for ${cardType} card:`,
            node.value
          );
        }
        return;
      }

      nodesToProcess.push({
        index,
        parent,
        cardType: cardType as MediaCardType,
        mediaData,
      });
    });

    for (let i = nodesToProcess.length - 1; i >= 0; i--) {
      const { index, parent, cardType, mediaData } = nodesToProcess[i];

      try {
        const nodes = buildMediaCardNodes(cardType, mediaData);
        parent.children.splice(index, 1, ...nodes);
      } catch (error) {
        if (enableDebug) {
          console.error(`Error processing ${cardType} card:`, error);
        }
      }
    }
  };
}

export default remarkMediaCard;
