import type { Link, Parent, Root, RootContent, Text } from "mdast";
import type { Plugin } from "unified";
import { processObsidianLinks } from "./linkProcessor";

interface RemarkWikiLinksOptions {
  enableDebug?: boolean;
}

const SKIP_NODE_TYPES = new Set([
  "link",
  "linkReference",
  "image",
  "imageReference",
  "inlineCode",
  "code",
  "html",
  "definition",
]);

function hasChildren(node: Root | RootContent): boolean {
  return "children" in node && Array.isArray(node.children);
}

function textToNodes(value: string): RootContent[] {
  const processed = processObsidianLinks(value);
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const nodes: RootContent[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = linkRegex.exec(processed)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({
        type: "text",
        value: processed.slice(lastIndex, match.index),
      } satisfies Text);
    }

    nodes.push({
      type: "link",
      url: match[2],
      children: [{ type: "text", value: match[1] }],
    } satisfies Link);

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) {
    return [{ type: "text", value }];
  }

  if (lastIndex < processed.length) {
    nodes.push({
      type: "text",
      value: processed.slice(lastIndex),
    } satisfies Text);
  }

  return nodes.filter(node => node.type !== "text" || node.value.length > 0);
}

function transformChildren(parent: Parent) {
  const nextChildren: RootContent[] = [];

  for (const child of parent.children as RootContent[]) {
    if (child.type === "text") {
      nextChildren.push(...textToNodes(child.value));
      continue;
    }

    if (hasChildren(child) && !SKIP_NODE_TYPES.has(child.type)) {
      transformChildren(child as Parent);
    }

    nextChildren.push(child);
  }

  parent.children = nextChildren;
}

export const remarkWikiLinks: Plugin<[RemarkWikiLinksOptions?], Root> = () => {
  return tree => {
    transformChildren(tree);
  };
};

export default remarkWikiLinks;
