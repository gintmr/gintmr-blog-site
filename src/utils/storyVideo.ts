import { getStorySourceRelative } from "./getStoryPath";

const storyAssets = import.meta.glob("../data/story/**/*", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const STORY_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".ogg",
  ".avi",
  ".mkv",
]);

interface StoryVideoAssetEntry {
  relativePathLower: string;
  stemLower: string;
  baseNameLower: string;
  url: string;
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeInputPath(value: string): string {
  return normalizeSlashes(decodeURIComponentSafe(value))
    .replace(/^['"]|['"]$/g, "")
    .split(/[?#]/)[0]
    .trim();
}

function normalizeStoryStem(rawPath: string): string {
  const normalized = normalizeInputPath(rawPath).replace(/^(\.\/|\.\.\/)+/, "");
  if (!normalized) return "";

  const storyPrefixed = normalized.startsWith("story/")
    ? normalized
    : normalized.includes("story/")
      ? `story/${normalized.split("story/")[1] || ""}`
      : `story/${normalized}`;

  const trimmed = storyPrefixed.replace(/\.[^.\\/]+$/i, "");
  return trimmed.replace(/\/+/g, "/").toLowerCase();
}

function buildVideoAssetIndex(): StoryVideoAssetEntry[] {
  return Object.entries(storyAssets)
    .map(([key, url]) => {
      const normalizedKey = normalizeSlashes(key);
      const relativePath = normalizedKey.includes("/data/")
        ? normalizedKey.split("/data/")[1] || normalizedKey
        : normalizedKey;
      const ext = relativePath.includes(".")
        ? relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase()
        : "";
      if (!STORY_VIDEO_EXTENSIONS.has(ext)) return null;

      const relativePathLower = relativePath.toLowerCase();
      const stemLower = relativePathLower.replace(/\.[^.\\/]+$/i, "");
      const baseNameLower = relativePathLower.split("/").pop() || "";

      return {
        relativePathLower,
        stemLower,
        baseNameLower,
        url,
      } satisfies StoryVideoAssetEntry;
    })
    .filter((entry): entry is StoryVideoAssetEntry => Boolean(entry));
}

const storyVideoIndex = buildVideoAssetIndex();

function findVideoUrlByStem(stem: string): string | undefined {
  if (!stem) return undefined;
  const normalizedStem = normalizeStoryStem(stem);
  if (!normalizedStem) return undefined;

  const exact = storyVideoIndex.find(entry => entry.stemLower === normalizedStem);
  if (exact) return exact.url;

  const stemBaseName = normalizedStem.split("/").pop() || "";
  const byBaseName = storyVideoIndex.find(entry =>
    entry.baseNameLower.startsWith(`${stemBaseName}.`)
  );
  if (byBaseName) return byBaseName.url;

  return undefined;
}

export function resolveStoryVideoUrlByEntry(
  id: string,
  filePath: string | undefined
): string | undefined {
  const storyRelative = getStorySourceRelative(id, filePath);
  if (!storyRelative) return undefined;
  return findVideoUrlByStem(`story/${storyRelative}`);
}
