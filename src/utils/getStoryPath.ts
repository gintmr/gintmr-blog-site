import { STORY_PATH } from "@/config";
import { slugifyStr } from "./slugify";

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function removeMarkdownExtension(value: string): string {
  return value.replace(/\.(md|mdx)$/i, "");
}

function toStorySegment(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const slugged = slugifyStr(trimmed);
  if (slugged) return slugged;
  return trimmed;
}

export function getStorySourceRelative(
  id: string,
  filePath: string | undefined
): string {
  if (filePath) {
    const normalized = normalizeSlashes(filePath);
    const marker = `${STORY_PATH}/`;
    const markerIndex = normalized.indexOf(marker);
    if (markerIndex >= 0) {
      const afterStoryPath = normalized.slice(markerIndex + marker.length);
      return trimSlashes(removeMarkdownExtension(afterStoryPath));
    }
  }

  const normalizedId = normalizeSlashes(id).replace(/^story\//i, "");
  return trimSlashes(removeMarkdownExtension(normalizedId));
}

export function getStoryFolderRelative(
  id: string,
  filePath: string | undefined
): string {
  return getStorySourceRelative(id, filePath);
}

export function getStoryTitle(
  title: string | undefined,
  id: string,
  filePath: string | undefined
): string {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) return trimmedTitle;

  const relativePath = getStorySourceRelative(id, filePath);
  const segments = relativePath.split("/").filter(Boolean);
  let lastSegment = segments[segments.length - 1] || id;

  if (lastSegment.toLowerCase() === "content" && segments.length > 1) {
    lastSegment = segments[segments.length - 2] || lastSegment;
  }

  return decodeURIComponent(lastSegment);
}

export function getStoryPath(
  id: string,
  filePath: string | undefined,
  includeBase = true
): string {
  const relativePath = getStorySourceRelative(id, filePath);
  const pathSegments = relativePath
    .split("/")
    .filter(Boolean)
    .filter(segment => !segment.startsWith("_"))
    .map(toStorySegment)
    .filter(Boolean);

  const basePath = includeBase ? "/story" : "";
  if (pathSegments.length === 0) {
    const fallbackSegment = toStorySegment(id.replace(/^story\//i, ""));
    return [basePath, fallbackSegment || "story-item"].join("/");
  }

  return [basePath, ...pathSegments].join("/");
}
