import { SKIP, visit } from "unist-util-visit";

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
  "video",
  "audio",
]);

function isWhitespaceText(node) {
  return node?.type === "text" && String(node.value || "").trim().length === 0;
}

function isImageElement(node) {
  return node?.type === "element" && node.tagName === "img";
}

function isBlockLike(node) {
  if (node?.type === "raw") return true;
  return node?.type === "element" && BLOCK_TAGS.has(node.tagName);
}

function getAltText(properties = {}) {
  const alt = properties.alt;
  if (typeof alt === "string") return alt.trim();
  if (Array.isArray(alt)) return alt.join(" ").trim();
  return "";
}

function buildImageFigure(img, className) {
  const properties = { ...(img.properties || {}) };
  const alt = getAltText(properties);

  const children = [
    {
      type: "element",
      tagName: "img",
      properties,
      children: [],
    },
  ];

  if (alt) {
    children.push({
      type: "element",
      tagName: "figcaption",
      properties: {},
      children: [{ type: "text", value: alt }],
    });
  }

  return {
    type: "element",
    tagName: "figure",
    properties: { class: className },
    children,
  };
}

function toRootNodes(nodes, originalParagraphProperties = {}) {
  const output = [];
  let inlineBuffer = [];

  const flushInlineBuffer = () => {
    if (inlineBuffer.length === 0) return;
    output.push({
      type: "element",
      tagName: "p",
      properties: { ...originalParagraphProperties },
      children: inlineBuffer,
    });
    inlineBuffer = [];
  };

  for (const node of nodes) {
    if (isWhitespaceText(node) && inlineBuffer.length === 0) continue;

    if (isBlockLike(node)) {
      flushInlineBuffer();
      output.push(node);
      continue;
    }

    inlineBuffer.push(node);
  }

  flushInlineBuffer();
  return output;
}

export default function rehypeFigureEnhanced(options = {}) {
  const className = options.className || "rehype-figure";
  const containerClass = `${className}-container`;

  return tree => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "p") return;
      if (!parent || typeof index !== "number" || !Array.isArray(parent.children)) return;

      const transformedChildren = [];
      let imageBuffer = [];
      let hasImage = false;

      const flushImages = () => {
        if (imageBuffer.length === 0) return;

        const figures = imageBuffer.map(img => buildImageFigure(img, className));
        transformedChildren.push(
          figures.length === 1
            ? figures[0]
            : {
                type: "element",
                tagName: "div",
                properties: { class: containerClass },
                children: figures,
              }
        );
        imageBuffer = [];
      };

      for (const child of node.children) {
        if (isImageElement(child)) {
          hasImage = true;
          imageBuffer.push(child);
          continue;
        }

        if (isWhitespaceText(child) && imageBuffer.length > 0) {
          continue;
        }

        flushImages();
        transformedChildren.push(child);
      }

      flushImages();
      if (!hasImage) return;

      const replacementNodes = toRootNodes(transformedChildren, node.properties || {});

      if (replacementNodes.length === 0) {
        parent.children.splice(index, 1);
        return [SKIP, index];
      }

      parent.children.splice(index, 1, ...replacementNodes);
      return [SKIP, index + replacementNodes.length];
    });
  };
}
