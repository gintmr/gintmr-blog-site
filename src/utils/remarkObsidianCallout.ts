import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Blockquote, Paragraph, Text } from "mdast";

interface RemarkObsidianCalloutOptions {
  enableDebug?: boolean;
}

type SupportedCalloutType = "tip" | "note" | "warning" | "danger" | "success";

const CALLOUT_MARKER_REGEX = /^\s*\[!([a-z0-9_-]+)\]([+-])?\s*(.*)$/i;

const TYPE_ALIASES: Record<string, SupportedCalloutType> = {
  tip: "tip",
  hint: "tip",
  info: "note",
  note: "note",
  abstract: "note",
  summary: "note",
  warning: "warning",
  caution: "warning",
  attention: "warning",
  danger: "danger",
  error: "danger",
  failure: "danger",
  fail: "danger",
  bug: "danger",
  success: "success",
  done: "success",
};

function normalizeType(rawType: string): SupportedCalloutType {
  return TYPE_ALIASES[rawType.toLowerCase()] || "note";
}

function hasRenderableContent(paragraph: Paragraph): boolean {
  for (const child of paragraph.children) {
    if (child.type === "text" && child.value.trim() !== "") return true;
    if (child.type !== "text") return true;
  }
  return false;
}

function getFirstTextChild(paragraph: Paragraph): Text | null {
  for (const child of paragraph.children) {
    if (child.type === "text") {
      return child;
    }
  }
  return null;
}

function applyCalloutStyle(node: Blockquote, type: SupportedCalloutType): void {
  node.data = {
    ...(node.data || {}),
    hName: "aside",
    hProperties: {
      className: ["obsidian-callout", `obsidian-callout--${type}`],
      "data-callout": type,
    },
  };
}

export const remarkObsidianCallout: Plugin<
  [RemarkObsidianCalloutOptions?],
  Root
> = (options = {}) => {
  const { enableDebug = false } = options;

  return tree => {
    visit(tree, "blockquote", (node: Blockquote) => {
      const firstParagraph = node.children[0];
      if (!firstParagraph || firstParagraph.type !== "paragraph") return;

      const firstText = getFirstTextChild(firstParagraph);
      if (!firstText) return;

      const fullText = firstText.value || "";
      const firstLineBreak = fullText.indexOf("\n");
      const firstLine =
        firstLineBreak >= 0 ? fullText.slice(0, firstLineBreak) : fullText;
      const markerMatch = firstLine.match(CALLOUT_MARKER_REGEX);

      if (!markerMatch) return;

      const calloutType = normalizeType(markerMatch[1] || "note");

      applyCalloutStyle(node, calloutType);
      const inlineText = (markerMatch[3] || "").trim();
      const rest = fullText.slice(firstLine.length).replace(/^\n/, "");
      const normalized = [inlineText, rest].filter(Boolean).join("\n");
      firstText.value = normalized.replace(/^\s+/, "");

      if (!hasRenderableContent(firstParagraph)) {
        node.children.splice(0, 1);
      }

      if (enableDebug) {
        console.info(
          `[remark-obsidian-callout] transformed ${calloutType} callout`
        );
      }
    });
  };
};

export default remarkObsidianCallout;
