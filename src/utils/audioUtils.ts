const audioAssets = import.meta.glob(
  "../data/attachment/**/*.{mp3,wav,ogg,m4a,aac,flac}",
  {
    eager: true,
    import: "default",
    query: "?url",
  }
) as Record<string, string>;

const lyricAssets = import.meta.glob("../data/attachment/**/*.lrc", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const coverAssets = import.meta.glob(
  "../data/attachment/**/*.{jpg,jpeg,png,gif,webp,avif,svg}",
  {
    eager: true,
    import: "default",
    query: "?url",
  }
) as Record<string, string>;

interface AssetIndexEntry {
  relativePath: string;
  baseName: string;
  url: string;
}

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"];

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

function normalizeComparablePath(value: string): string {
  return normalizeSlashes(decodeURIComponentSafe(value))
    .normalize("NFC")
    .toLowerCase();
}

function normalizeInputPath(rawPath: string): string {
  return normalizeSlashes(decodeURIComponentSafe(rawPath))
    .replace(/^['"]|['"]$/g, "")
    .split(/[?#]/)[0]
    .trim();
}

function extractAttachmentRelativePath(normalizedPath: string): string {
  const withoutDotPrefix = normalizedPath.replace(/^(\.\/|\.\.\/)+/, "");

  if (withoutDotPrefix.startsWith("attachment/")) {
    return withoutDotPrefix.slice("attachment/".length);
  }

  if (withoutDotPrefix.includes("attachment/")) {
    return withoutDotPrefix.split("attachment/")[1] || withoutDotPrefix;
  }

  return withoutDotPrefix;
}

function buildAssetIndex(assets: Record<string, string>): AssetIndexEntry[] {
  return Object.entries(assets).map(([key, url]) => {
    const normalizedKey = normalizeSlashes(key);
    const relativePathRaw = normalizedKey.includes("attachment/")
      ? normalizedKey.split("attachment/")[1] || normalizedKey
      : normalizedKey;
    return {
      relativePath: normalizeComparablePath(relativePathRaw),
      baseName: normalizeComparablePath(relativePathRaw.split("/").pop() || ""),
      url,
    };
  });
}

function findAssetUrl(
  normalizedInputPath: string,
  index: AssetIndexEntry[]
): string | undefined {
  const relativePath = normalizeComparablePath(
    extractAttachmentRelativePath(normalizedInputPath)
  );
  const baseName = normalizeComparablePath(relativePath.split("/").pop() || "");

  if (!relativePath) return undefined;

  const exactMatch = index.find(entry => entry.relativePath === relativePath);
  if (exactMatch) return exactMatch.url;

  if (relativePath.includes("/")) {
    const suffixMatch = index.find(entry =>
      entry.relativePath.endsWith(`/${relativePath}`)
    );
    if (suffixMatch) return suffixMatch.url;
  }

  if (baseName) {
    const baseNameMatch = index.find(entry => entry.baseName === baseName);
    if (baseNameMatch) return baseNameMatch.url;
  }

  return undefined;
}

function toAttachmentFallbackPath(normalizedInputPath: string): string {
  if (normalizedInputPath.startsWith("http://") || normalizedInputPath.startsWith("https://")) {
    return normalizedInputPath;
  }

  if (normalizedInputPath.startsWith("../")) {
    return normalizedInputPath.replace("../", "/");
  }

  if (normalizedInputPath.startsWith("attachment/")) {
    return `/${normalizedInputPath}`;
  }

  if (normalizedInputPath.includes("attachment/")) {
    const afterAttachment = normalizedInputPath.split("attachment/")[1] || normalizedInputPath;
    return `/attachment/${afterAttachment}`;
  }

  return normalizedInputPath;
}

const audioIndex = buildAssetIndex(audioAssets);
const lyricIndex = buildAssetIndex(lyricAssets);
const coverIndex = buildAssetIndex(coverAssets);

export function isAudioFile(filePath: string): boolean {
  const lower = filePath.trim().toLowerCase();
  return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export function getAudioPath(rawPath: string): string {
  const normalized = normalizeInputPath(rawPath);
  if (!normalized) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const assetUrl = findAssetUrl(normalized, audioIndex);
  if (assetUrl) return assetUrl;

  return toAttachmentFallbackPath(normalized);
}

export function getLyricPath(rawPath: string): string {
  const normalized = normalizeInputPath(rawPath);
  if (!normalized) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const assetUrl = findAssetUrl(normalized, lyricIndex);
  if (assetUrl) return assetUrl;

  return toAttachmentFallbackPath(normalized);
}

export function getCoverPath(rawPath: string): string {
  const normalized = normalizeInputPath(rawPath);
  if (!normalized) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const assetUrl = findAssetUrl(normalized, coverIndex);
  if (assetUrl) return assetUrl;

  return toAttachmentFallbackPath(normalized);
}
