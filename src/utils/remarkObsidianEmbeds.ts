import fs from "node:fs";
import path from "node:path";
import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Paragraph, Text, Image } from "mdast";

interface RemarkObsidianEmbedsOptions {
  enableDebug?: boolean;
}

const IMAGE_EXT_REGEX = /\.(avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i;
const OBSIDIAN_EMBED_REGEX = /!\[\[([^\]]+)\]\]/g;

const attachmentIndexCache = new Map<string, string[]>();

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

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function getAttachmentCandidates(projectRoot: string): string[] {
  if (attachmentIndexCache.has(projectRoot)) {
    return attachmentIndexCache.get(projectRoot)!;
  }

  const attachmentRoot = path.resolve(projectRoot, "src/data/attachment");
  const result: string[] = [];

  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;

      const rel = normalizeSlashes(path.relative(attachmentRoot, abs));
      if (!rel || rel.startsWith("..")) continue;
      result.push(rel);
    }
  };

  walk(attachmentRoot);
  attachmentIndexCache.set(projectRoot, result);
  return result;
}

function resolveObsidianImageUrl(
  rawTarget: string,
  currentFilePath?: string
): string {
  const decoded = normalizeSlashes(decodeURIComponentSafe(stripQuotes(rawTarget)));
  if (!decoded) return decoded;

  if (/^https?:\/\//i.test(decoded)) return decoded;
  if (decoded.startsWith("../attachment/")) return decoded;
  if (decoded.startsWith("attachment/")) return `../${decoded}`;

  if (decoded.includes("attachment/")) {
    const afterAttachment = decoded.split("attachment/")[1] || decoded;
    return `../attachment/${afterAttachment}`;
  }

  const projectRoot = process.cwd();
  const attachmentRoot = path.resolve(projectRoot, "src/data/attachment");

  if (decoded.includes("/")) {
    const maybeAbs = path.resolve(path.dirname(currentFilePath || ""), decoded);
    if (fs.existsSync(maybeAbs)) {
      const relFromAttachment = normalizeSlashes(
        path.relative(attachmentRoot, maybeAbs)
      );
      if (relFromAttachment && !relFromAttachment.startsWith("..")) {
        return `../attachment/${relFromAttachment}`;
      }
    }
    return decoded;
  }

  const baseName = decoded;
  const postBaseName = currentFilePath
    ? path.basename(currentFilePath, path.extname(currentFilePath))
    : "";

  if (postBaseName) {
    const inPostFolder = path.resolve(
      attachmentRoot,
      "blog",
      postBaseName,
      baseName
    );
    if (fs.existsSync(inPostFolder)) {
      return `../attachment/blog/${postBaseName}/${baseName}`;
    }
  }

  const inInbox = path.resolve(attachmentRoot, "inbox", baseName);
  if (fs.existsSync(inInbox)) {
    return `../attachment/inbox/${baseName}`;
  }

  const candidates = getAttachmentCandidates(projectRoot).filter(rel =>
    rel.toLowerCase().endsWith(`/${baseName.toLowerCase()}`)
  );

  if (candidates.length > 0) {
    const preferred =
      candidates.find(rel => rel.startsWith("blog/")) ||
      candidates.find(rel => rel.startsWith("inbox/")) ||
      candidates[0];
    return `../attachment/${preferred}`;
  }

  return baseName;
}

function parseEmbedValue(embedValue: string): {
  url: string;
  alt: string;
  title?: string;
} | null {
  const parts = embedValue
    .split("|")
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const target = parts[0].split("#")[0]?.trim() || "";
  if (!target || !IMAGE_EXT_REGEX.test(target)) return null;

  const descriptor =
    parts
      .slice(1)
      .find(part => !/^\d+(?:x\d+)?$/i.test(part.replace(/\s+/g, ""))) || "";
  const fallbackAlt =
    decodeURIComponentSafe(target).split("/").pop()?.replace(/\.[^/.]+$/, "") ||
    "image";

  return {
    url: target,
    alt: descriptor || fallbackAlt,
    title: descriptor || undefined,
  };
}

export const remarkObsidianEmbeds: Plugin<
  [RemarkObsidianEmbedsOptions?],
  Root
> = (options = {}) => {
  const { enableDebug = false } = options;

  return (tree, file) => {
    const currentFilePath = String(file.path || file.history?.[0] || "");

    visit(tree, "paragraph", (node: Paragraph) => {
      const transformedChildren: Paragraph["children"] = [];

      for (const child of node.children) {
        if (child.type !== "text") {
          transformedChildren.push(child);
          continue;
        }

        const textNode = child as Text;
        const raw = textNode.value;
        OBSIDIAN_EMBED_REGEX.lastIndex = 0;

        let hasEmbed = false;
        let cursor = 0;
        let match: RegExpExecArray | null = null;

        while ((match = OBSIDIAN_EMBED_REGEX.exec(raw)) !== null) {
          const [fullMatch, embedValue] = match;
          const start = match.index;
          const end = start + fullMatch.length;

          if (start > cursor) {
            transformedChildren.push({
              type: "text",
              value: raw.slice(cursor, start),
            });
          }

          const parsed = parseEmbedValue(embedValue);
          if (!parsed) {
            transformedChildren.push({ type: "text", value: fullMatch });
            cursor = end;
            continue;
          }

          hasEmbed = true;
          const resolvedUrl = resolveObsidianImageUrl(parsed.url, currentFilePath);

          if (enableDebug) {
            console.log(
              `[remark-obsidian-embeds] ${parsed.url} -> ${resolvedUrl} (${currentFilePath})`
            );
          }

          const imageNode: Image = {
            type: "image",
            url: resolvedUrl,
            alt: parsed.alt,
            title: parsed.title,
          };
          transformedChildren.push(imageNode);
          cursor = end;
        }

        if (!hasEmbed) {
          transformedChildren.push(child);
          continue;
        }

        if (cursor < raw.length) {
          transformedChildren.push({
            type: "text",
            value: raw.slice(cursor),
          });
        }
      }

      node.children = transformedChildren;
    });
  };
};

export default remarkObsidianEmbeds;
