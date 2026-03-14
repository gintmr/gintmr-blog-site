import { STORY_PATH } from "@/config";
import { slugifyStr } from "./slugify";

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function getStoryFolderRelative(
  id: string,
  filePath: string | undefined
): string {
  if (filePath) {
    const normalized = normalizeSlashes(filePath);
    const marker = `${STORY_PATH}/`;
    const markerIndex = normalized.indexOf(marker);
    if (markerIndex >= 0) {
      const afterStoryPath = normalized.slice(markerIndex + marker.length);
      return trimSlashes(
        afterStoryPath.replace(/\/content\.(md|mdx)$/i, "")
      );
    }
  }

  return trimSlashes(
    id
      .replace(/^story\//i, "")
      .replace(/\/content$/i, "")
  );
}

export function getStoryTitle(
  title: string | undefined,
  id: string,
  filePath: string | undefined
): string {
  const trimmed = title?.trim();
  if (trimmed) return trimmed;

  const folder = getStoryFolderRelative(id, filePath);
  const name = folder.split("/").filter(Boolean).slice(-1)[0];
  return decodeURIComponent(name || id);
}

export function getStoryPath(
  id: string,
  filePath: string | undefined,
  includeBase = true
) {
  const folder = getStoryFolderRelative(id, filePath);
  const pathSegments = folder
    .split("/")
    .filter(path => path !== "")
    .filter(path => !path.startsWith("_"))
    .map(segment => slugifyStr(segment));

  const basePath = includeBase ? "/story" : "";

  if (!pathSegments || pathSegments.length < 1) {
    return [basePath, slugifyStr(id.replace(/\/content$/i, ""))].join("/");
  }

  return [basePath, ...pathSegments].join("/");
}
