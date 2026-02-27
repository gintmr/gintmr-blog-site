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

function toBaseName(value: string): string {
  const normalized = normalizeSlashes(value);
  return normalized.split("/").pop() || normalized;
}

function toBaseNameWithoutExt(value: string): string {
  const base = toBaseName(value);
  return base.replace(/\.[^.]+$/, "");
}

function isLikelyAutoFilename(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;

  if (/^image(?:\s*\d+)?(?:\.[a-z0-9]+)?$/i.test(normalized)) return true;
  if (/^pasted image(?:\s*\d+)?(?:\.[a-z0-9]+)?$/i.test(normalized)) return true;

  if (/^[a-f0-9]{24,}(?:_[a-z0-9]+)*(?:\.[a-z0-9]+)?$/i.test(normalized)) {
    return true;
  }

  return false;
}

function sanitizeImageCaption(rawCaption: string, imageUrl: string): string {
  const caption = rawCaption.trim();
  if (!caption) return "";

  const decodedUrl = decodeURIComponentSafe(imageUrl);
  const baseName = toBaseName(decodedUrl).toLowerCase();
  const baseNameNoExt = toBaseNameWithoutExt(decodedUrl).toLowerCase();
  const normalizedCaption = caption.toLowerCase();

  if (
    normalizedCaption === baseName ||
    normalizedCaption === baseNameNoExt ||
    isLikelyAutoFilename(caption)
  ) {
    return "";
  }

  return caption;
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

  const rawDescriptor =
    parts
      .slice(1)
      .find(part => !/^\d+(?:x\d+)?$/i.test(part.replace(/\s+/g, ""))) || "";
  const descriptor = sanitizeImageCaption(rawDescriptor, target);

  return {
    url: target,
    // 无描述时不自动生成文件名 caption，避免 "Pasted image xxx" 污染排版。
    alt: descriptor || "",
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

    visit(tree, "image", (node: Image) => {
      if (!node.url) return;
      const originalUrl = node.url;
      const resolvedUrl = resolveObsidianImageUrl(originalUrl, currentFilePath);
      const sanitizedAlt = sanitizeImageCaption(node.alt || "", resolvedUrl);

      node.url = resolvedUrl;
      node.alt = sanitizedAlt;

      if (node.title) {
        const sanitizedTitle = sanitizeImageCaption(node.title, resolvedUrl);
        node.title = sanitizedTitle || undefined;
      }

      if (enableDebug && originalUrl !== resolvedUrl) {
        console.log(
          `[remark-obsidian-embeds:image] ${originalUrl} -> ${resolvedUrl} (${currentFilePath})`
        );
      }
    });

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
