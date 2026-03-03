import fs from "node:fs";
import path from "node:path";
import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Paragraph, Text, Image, Html } from "mdast";
import { getVideoPath } from "./videoUtils";
import { getAudioPath, isAudioFile } from "./audioUtils";

interface RemarkObsidianEmbedsOptions {
  enableDebug?: boolean;
}

const IMAGE_EXT_REGEX = /\.(avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i;
const VIDEO_EXT_REGEX = /\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/i;
const AUDIO_EXT_REGEX = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;
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

function sanitizeVideoCaption(rawCaption: string, videoUrl: string): string {
  const caption = rawCaption.trim();
  if (!caption) return "";

  const decodedUrl = decodeURIComponentSafe(videoUrl);
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

function sanitizeAudioCaption(rawCaption: string, audioUrl: string): string {
  const caption = rawCaption.trim();
  if (!caption) return "";

  const decodedUrl = decodeURIComponentSafe(audioUrl);
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function buildVideoFigureHtml(
  src: string,
  caption = "",
  ariaLabel = "Video"
): string {
  const safeSrc = escapeHtmlAttr(src);
  const safeCaption = caption.trim();
  const safeAriaLabel = escapeHtmlAttr((ariaLabel || "Video").trim() || "Video");
  const captionHtml = safeCaption
    ? `<figcaption>${escapeHtml(safeCaption)}</figcaption>`
    : "";

  return `<figure class="rehype-figure"><video controls playsinline preload="metadata" src="${safeSrc}" aria-label="${safeAriaLabel}"></video>${captionHtml}</figure>`;
}

function buildAudioFigureHtml(
  src: string,
  caption = "",
  ariaLabel = "Audio"
): string {
  const safeSrc = escapeHtmlAttr(src);
  const safeCaption = caption.trim();
  const safeAriaLabel = escapeHtmlAttr((ariaLabel || "Audio").trim() || "Audio");
  const captionHtml = safeCaption
    ? `<figcaption>${escapeHtml(safeCaption)}</figcaption>`
    : "";

  return `<figure class="rehype-figure audio-inline-figure"><audio controls preload="metadata" src="${safeSrc}" aria-label="${safeAriaLabel}"></audio>${captionHtml}</figure>`;
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

function resolveObsidianVideoUrl(
  rawTarget: string,
  currentFilePath?: string
): string {
  const normalized = resolveObsidianImageUrl(rawTarget, currentFilePath);
  return getVideoPath(normalized);
}

function resolveObsidianAudioUrl(
  rawTarget: string,
  currentFilePath?: string
): string {
  const normalized = resolveObsidianImageUrl(rawTarget, currentFilePath);
  return getAudioPath(normalized);
}

type ParsedEmbed =
  | {
      type: "image";
      url: string;
      alt: string;
      title?: string;
    }
  | {
      type: "video";
      url: string;
      caption: string;
      label: string;
    }
  | {
      type: "audio";
      url: string;
      caption: string;
      label: string;
    };

function parseEmbedValue(embedValue: string): ParsedEmbed | null {
  const parts = embedValue
    .split("|")
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const target = parts[0].split("#")[0]?.trim() || "";
  if (!target) return null;

  const rawDescriptor =
    parts
      .slice(1)
      .find(part => !/^\d+(?:x\d+)?$/i.test(part.replace(/\s+/g, ""))) || "";

  if (IMAGE_EXT_REGEX.test(target)) {
    const descriptor = sanitizeImageCaption(rawDescriptor, target);
    return {
      type: "image",
      url: target,
      // 无描述时不自动生成文件名 caption，避免 "Pasted image xxx" 污染排版。
      alt: descriptor || "",
      title: descriptor || undefined,
    };
  }

  if (VIDEO_EXT_REGEX.test(target)) {
    const descriptor = sanitizeVideoCaption(rawDescriptor, target);
    const fallbackLabel = toBaseNameWithoutExt(target).trim() || "Video";
    return {
      type: "video",
      url: target,
      caption: descriptor,
      label: descriptor || fallbackLabel,
    };
  }

  if (AUDIO_EXT_REGEX.test(target) || isAudioFile(target)) {
    const descriptor = sanitizeAudioCaption(rawDescriptor, target);
    const fallbackLabel = toBaseNameWithoutExt(target).trim() || "Audio";
    return {
      type: "audio",
      url: target,
      caption: descriptor,
      label: descriptor || fallbackLabel,
    };
  }

  return null;
}

export const remarkObsidianEmbeds: Plugin<
  [RemarkObsidianEmbedsOptions?],
  Root
> = (options = {}) => {
  const { enableDebug = false } = options;

  return (tree, file) => {
    const currentFilePath = String(file.path || file.history?.[0] || "");

    visit(tree, "image", (node: Image, index, parent) => {
      if (!node.url) return;
      const originalUrl = node.url;
      const isVideo = VIDEO_EXT_REGEX.test(originalUrl);
      const isAudio = AUDIO_EXT_REGEX.test(originalUrl) || isAudioFile(originalUrl);

      if (isVideo && typeof index === "number" && parent && "children" in parent) {
        const resolvedVideoUrl = resolveObsidianVideoUrl(
          originalUrl,
          currentFilePath
        );
        const caption = sanitizeVideoCaption(
          node.title || node.alt || "",
          resolvedVideoUrl
        );
        const label = caption || node.alt || toBaseNameWithoutExt(originalUrl);

        const videoNode: Html = {
          type: "html",
          value: buildVideoFigureHtml(resolvedVideoUrl, caption, label),
        };

        parent.children[index] = videoNode;

        if (enableDebug) {
          console.log(
            `[remark-obsidian-embeds:video] ${originalUrl} -> ${resolvedVideoUrl} (${currentFilePath})`
          );
        }
        return;
      }

      if (isAudio && typeof index === "number" && parent && "children" in parent) {
        const resolvedAudioUrl = resolveObsidianAudioUrl(
          originalUrl,
          currentFilePath
        );
        const caption = sanitizeAudioCaption(
          node.title || node.alt || "",
          resolvedAudioUrl
        );
        const label = caption || node.alt || toBaseNameWithoutExt(originalUrl);

        const audioNode: Html = {
          type: "html",
          value: buildAudioFigureHtml(resolvedAudioUrl, caption, label),
        };

        parent.children[index] = audioNode;

        if (enableDebug) {
          console.log(
            `[remark-obsidian-embeds:audio] ${originalUrl} -> ${resolvedAudioUrl} (${currentFilePath})`
          );
        }
        return;
      }

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
          if (parsed.type === "image") {
            const resolvedUrl = resolveObsidianImageUrl(
              parsed.url,
              currentFilePath
            );

            if (enableDebug) {
              console.log(
                `[remark-obsidian-embeds:image] ${parsed.url} -> ${resolvedUrl} (${currentFilePath})`
              );
            }

            const imageNode: Image = {
              type: "image",
              url: resolvedUrl,
              alt: parsed.alt,
              title: parsed.title,
            };
            transformedChildren.push(imageNode);
          } else {
            if (parsed.type === "video") {
              const resolvedVideoUrl = resolveObsidianVideoUrl(
                parsed.url,
                currentFilePath
              );

              if (enableDebug) {
                console.log(
                  `[remark-obsidian-embeds:video] ${parsed.url} -> ${resolvedVideoUrl} (${currentFilePath})`
                );
              }

              const videoNode: Html = {
                type: "html",
                value: buildVideoFigureHtml(
                  resolvedVideoUrl,
                  parsed.caption,
                  parsed.label
                ),
              };
              transformedChildren.push(videoNode);
            } else {
              const resolvedAudioUrl = resolveObsidianAudioUrl(
                parsed.url,
                currentFilePath
              );

              if (enableDebug) {
                console.log(
                  `[remark-obsidian-embeds:audio] ${parsed.url} -> ${resolvedAudioUrl} (${currentFilePath})`
                );
              }

              const audioNode: Html = {
                type: "html",
                value: buildAudioFigureHtml(
                  resolvedAudioUrl,
                  parsed.caption,
                  parsed.label
                ),
              };
              transformedChildren.push(audioNode);
            }
          }

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
