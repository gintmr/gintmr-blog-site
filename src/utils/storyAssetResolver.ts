const storyAssets = import.meta.glob("../data/story/**/*", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function normalizeInputPath(value: string): string {
  return normalizeSlashes(decodeURIComponentSafe(value))
    .replace(/^['"]|['"]$/g, "")
    .split(/[?#]/)[0]
    .trim();
}

function normalizeRelativeToData(rawPath: string): string {
  const normalized = normalizeInputPath(rawPath);
  if (!normalized) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const withoutDotPrefix = normalized.replace(/^(\.\/|\.\.\/)+/, "");

  if (withoutDotPrefix.startsWith("story/")) {
    return withoutDotPrefix;
  }

  if (withoutDotPrefix.includes("story/")) {
    return `story/${withoutDotPrefix.split("story/")[1] || ""}`.replace(
      /\/+/g,
      "/"
    );
  }

  return withoutDotPrefix;
}

interface AssetIndexEntry {
  relativePath: string;
  baseName: string;
  url: string;
}

const STORY_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpg",
  ".jpeg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
  ".heic",
  ".heif",
]);

const STORY_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".ogg",
  ".mov",
  ".avi",
  ".mkv",
  ".m4v",
]);

const STORY_AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac",
]);

function buildAssetIndex(
  assets: Record<string, string>,
  extensions?: Set<string>
): AssetIndexEntry[] {
  return Object.entries(assets)
    .filter(([key]) => {
      if (!extensions) return true;
      const normalizedKey = normalizeSlashes(key);
      const dotIndex = normalizedKey.lastIndexOf(".");
      if (dotIndex < 0) return false;
      const ext = normalizedKey.slice(dotIndex).toLowerCase();
      return extensions.has(ext);
    })
    .map(([key, url]) => {
    const normalizedKey = normalizeSlashes(key);
    const relativePath = normalizedKey.includes("/data/")
      ? normalizedKey.split("/data/")[1] || normalizedKey
      : normalizedKey;

    return {
      relativePath: relativePath.toLowerCase(),
      baseName: relativePath.split("/").pop()?.toLowerCase() || "",
      url,
    };
  });
}

function findAssetUrl(
  normalizedRelativePath: string,
  index: AssetIndexEntry[]
): string | undefined {
  const lower = normalizedRelativePath.toLowerCase();
  const baseName = lower.split("/").pop() || "";

  const exactMatch = index.find(entry => entry.relativePath === lower);
  if (exactMatch) return exactMatch.url;

  if (lower.includes("/")) {
    const suffixMatch = index.find(entry => entry.relativePath.endsWith(`/${lower}`));
    if (suffixMatch) return suffixMatch.url;
  }

  if (baseName) {
    const basenameMatch = index.find(entry => entry.baseName === baseName);
    if (basenameMatch) return basenameMatch.url;
  }

  return undefined;
}

const storyImageIndex = buildAssetIndex(storyAssets, STORY_IMAGE_EXTENSIONS);
const storyVideoIndex = buildAssetIndex(storyAssets, STORY_VIDEO_EXTENSIONS);
const storyAudioIndex = buildAssetIndex(storyAssets, STORY_AUDIO_EXTENSIONS);

export function normalizeStoryAssetPath(
  rawPath: string,
  storyDirRelative?: string
): string {
  const normalized = normalizeInputPath(rawPath);
  if (!normalized) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  if (
    storyDirRelative &&
    (normalized.startsWith("imgs/") || normalized.startsWith("./imgs/"))
  ) {
    return `${storyDirRelative}/${normalized.replace(/^\.\//, "")}`.replace(
      /\/+/g,
      "/"
    );
  }

  return normalizeRelativeToData(normalized);
}

export function resolveStoryImageAssetUrl(rawPath: string): string | undefined {
  const normalized = normalizeRelativeToData(rawPath);
  if (!normalized || /^https?:\/\//i.test(normalized)) return undefined;
  return findAssetUrl(normalized, storyImageIndex);
}

export function resolveStoryVideoAssetUrl(rawPath: string): string | undefined {
  const normalized = normalizeRelativeToData(rawPath);
  if (!normalized || /^https?:\/\//i.test(normalized)) return undefined;
  return findAssetUrl(normalized, storyVideoIndex);
}

export function resolveStoryAudioAssetUrl(rawPath: string): string | undefined {
  const normalized = normalizeRelativeToData(rawPath);
  if (!normalized || /^https?:\/\//i.test(normalized)) return undefined;
  return findAssetUrl(normalized, storyAudioIndex);
}
