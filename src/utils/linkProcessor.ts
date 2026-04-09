import fs from "node:fs";
import path from "node:path";
import { BLOG_PATH, DIARY_PATH, STORY_PATH } from "../config";
import { parseDiaryIdentifier } from "./diaryIdentifier";
import { slugifyStr } from "./slugify";

type ContentKind = "blog" | "story" | "diary";

interface ContentRecord {
  kind: ContentKind;
  filePath: string;
  href: string;
  keys: string[];
}

interface ResolvedWikiLink {
  href: string;
  label: string;
}

const MARKDOWN_EXT_REGEX = /\.(md|mdx)$/i;
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---/;
const WIKI_LINK_REGEX = /(!)?\[\[([^[\]]+)\]\]/g;

let contentIndexCache: Map<string, ContentRecord[]> | null = null;

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

function trimMarkdownExtension(value: string): string {
  return value.replace(MARKDOWN_EXT_REGEX, "");
}

function normalizeLookupKey(value: string): string {
  return trimMarkdownExtension(normalizeSlashes(decodeURIComponentSafe(value)))
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toHeadingAnchor(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/['".,!?()[\]{}:;，。！？：；“”‘’`~@#$%^&*=+\\/<>|]/g, "")
    .replace(/\s+/g, "-");
}

function getBlogPath(id: string, filePath: string): string {
  const pathSegments = normalizeSlashes(filePath)
    .replace(BLOG_PATH, "")
    .split("/")
    .filter(segment => segment !== "")
    .filter(segment => !segment.startsWith("_"))
    .slice(0, -1)
    .map(segment => slugifyStr(segment));

  const blogId = id.split("/");
  const slug = blogId.length > 0 ? blogId.slice(-1) : blogId;
  return pathSegments.length < 1
    ? ["/blog", slug].join("/")
    : ["/blog", ...pathSegments, slug].join("/");
}

function getStoryUrl(id: string, filePath: string): string {
  const normalized = normalizeSlashes(filePath);
  const marker = `${STORY_PATH}/`;
  const markerIndex = normalized.indexOf(marker);
  const sourceRelative =
    markerIndex >= 0
      ? normalized.slice(markerIndex + marker.length)
      : normalizeSlashes(id).replace(/^story\//i, "");

  const pathSegments = trimMarkdownExtension(sourceRelative)
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .filter(segment => !segment.startsWith("_"))
    .map(segment => slugifyStr(segment) || segment.trim())
    .filter(Boolean);

  return ["/story", ...(pathSegments.length > 0 ? pathSegments : ["story-item"])].join("/");
}

function readFrontmatter(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(FRONTMATTER_REGEX);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function extractFrontmatterField(frontmatter: string, field: string): string {
  const match = frontmatter.match(new RegExp(`^${field}:[ \\t]*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function listMarkdownFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(absolutePath));
      continue;
    }

    if (MARKDOWN_EXT_REGEX.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function buildRecord(kind: ContentKind, filePath: string): ContentRecord {
  const projectRoot = process.cwd();
  const normalizedFilePath = normalizeSlashes(filePath);
  const relativePath = normalizeSlashes(path.relative(projectRoot, filePath));
  const frontmatter = readFrontmatter(filePath);
  const title = extractFrontmatterField(frontmatter, "title");
  const slug = extractFrontmatterField(frontmatter, "slug");
  const fileStem = trimMarkdownExtension(path.basename(filePath));

  if (kind === "blog") {
    const id = slug || fileStem;
    const blogRelative = trimMarkdownExtension(
      normalizeSlashes(path.relative(path.resolve(projectRoot, BLOG_PATH), filePath))
    );
    return {
      kind,
      filePath: normalizedFilePath,
      href: getBlogPath(id, relativePath),
      keys: [
        `blog/${blogRelative}`,
        `blog/${fileStem}`,
        `blog/${title}`,
        `blog/${slug}`,
        blogRelative,
        fileStem,
        title,
        slug,
      ]
        .map(normalizeLookupKey)
        .filter(Boolean),
    };
  }

  if (kind === "story") {
    const storyRelative = trimMarkdownExtension(
      normalizeSlashes(path.relative(path.resolve(projectRoot, STORY_PATH), filePath))
    );
    return {
      kind,
      filePath: normalizedFilePath,
      href: getStoryUrl(storyRelative, relativePath),
      keys: [
        `story/${storyRelative}`,
        `story/${fileStem}`,
        `story/${title}`,
        storyRelative,
        fileStem,
        title,
      ]
        .map(normalizeLookupKey)
        .filter(Boolean),
    };
  }

  const diaryRelative = trimMarkdownExtension(
    normalizeSlashes(path.relative(path.resolve(projectRoot, DIARY_PATH), filePath))
  );
  const diaryMeta = parseDiaryIdentifier(diaryRelative);
  return {
    kind,
    filePath: normalizedFilePath,
    href: `/diary/${diaryMeta.quarterKey}#date-${diaryMeta.rawId}`,
    keys: [
      `diary/${diaryRelative}`,
      `diary/${fileStem}`,
      diaryRelative,
      fileStem,
    ]
      .map(normalizeLookupKey)
      .filter(Boolean),
  };
}

function getContentIndex(): Map<string, ContentRecord[]> {
  if (contentIndexCache) return contentIndexCache;

  const projectRoot = process.cwd();
  const index = new Map<string, ContentRecord[]>();
  const roots: Array<{ kind: ContentKind; dirPath: string }> = [
    { kind: "blog", dirPath: path.resolve(projectRoot, BLOG_PATH) },
    { kind: "story", dirPath: path.resolve(projectRoot, STORY_PATH) },
    { kind: "diary", dirPath: path.resolve(projectRoot, DIARY_PATH) },
  ];

  for (const { kind, dirPath } of roots) {
    const files = listMarkdownFiles(dirPath);
    for (const filePath of files) {
      const record = buildRecord(kind, filePath);
      for (const key of record.keys) {
        const existing = index.get(key) ?? [];
        existing.push(record);
        index.set(key, existing);
      }
    }
  }

  contentIndexCache = index;
  return index;
}

function resolveFileReference(
  href: string,
  currentFilePath?: string
): ContentRecord | null {
  const decodedHref = decodeURIComponentSafe(href);
  const projectRoot = process.cwd();
  const baseDir = currentFilePath
    ? path.dirname(currentFilePath)
    : projectRoot;

  const candidates = [
    path.resolve(baseDir, decodedHref),
    path.resolve(projectRoot, decodedHref),
  ];

  for (const absolutePath of candidates) {
    if (!fs.existsSync(absolutePath)) continue;
    const normalized = normalizeSlashes(absolutePath);

    if (normalized.includes(`/${normalizeSlashes(BLOG_PATH)}/`)) {
      return buildRecord("blog", absolutePath);
    }
    if (normalized.includes(`/${normalizeSlashes(STORY_PATH)}/`)) {
      return buildRecord("story", absolutePath);
    }
    if (normalized.includes(`/${normalizeSlashes(DIARY_PATH)}/`)) {
      return buildRecord("diary", absolutePath);
    }
  }

  return null;
}

function resolveWikiRecord(target: string): ContentRecord | null {
  const normalizedTarget = normalizeLookupKey(target);
  if (!normalizedTarget) return null;

  const exactMatches = getContentIndex().get(normalizedTarget) ?? [];
  if (exactMatches.length === 1) return exactMatches[0];

  const [kindPrefix] = normalizedTarget.split("/", 1);
  if (
    exactMatches.length > 1 &&
    (kindPrefix === "blog" || kindPrefix === "story" || kindPrefix === "diary")
  ) {
    const preferred = exactMatches.find(record => record.kind === kindPrefix);
    if (preferred) return preferred;
  }

  return exactMatches[0] ?? null;
}

function parseWikiTarget(rawTarget: string): {
  target: string;
  heading: string;
  label: string;
} {
  const [targetPart, ...labelParts] = rawTarget.split("|");
  const [targetOnly, headingPart = ""] = targetPart.split("#");
  const target = targetOnly.trim();
  const heading = headingPart.trim();
  const label =
    labelParts.join("|").trim() ||
    heading ||
    path.basename(target).trim();
  return { target, heading, label };
}

export function resolveWikiLink(
  rawTarget: string
): ResolvedWikiLink | null {
  const { target, heading, label } = parseWikiTarget(rawTarget);
  const record = resolveWikiRecord(target);
  if (!record) return null;

  const anchor = heading ? `#${toHeadingAnchor(heading)}` : "";

  return {
    href: `${record.href}${anchor}`,
    label: label || target,
  };
}

/**
 * 处理链接，将相对路径或内容文件引用转换为站内链接
 */
export function processLink(href: string, currentFilePath?: string): string {
  if (/^https?:\/\//.test(href)) return href;

  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }

  if (!MARKDOWN_EXT_REGEX.test(href)) {
    return href;
  }

  const resolvedByPath = resolveFileReference(href, currentFilePath);
  if (resolvedByPath) {
    return resolvedByPath.href;
  }

  const resolvedByIndex = resolveWikiRecord(href);
  if (resolvedByIndex) {
    return resolvedByIndex.href;
  }

  return href;
}

export function processMarkdownLinks(
  text: string,
  currentFilePath?: string
): string {
  return text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (match, linkText, href) => {
    const processedHref = processLink(href, currentFilePath);
    return `[${linkText}](${processedHref})`;
  });
}

export function processObsidianLinks(text: string): string {
  return text.replace(WIKI_LINK_REGEX, (match, bang, rawTarget) => {
    if (bang) return match;

    const resolved = resolveWikiLink(rawTarget);
    if (!resolved) return match;

    return `[${resolved.label}](${resolved.href})`;
  });
}
