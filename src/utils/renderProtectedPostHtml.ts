import * as cheerio from "cheerio";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkToc from "remark-toc";
import rehypeFigure from "rehype-figure";
import rehypeSlug from "rehype-slug";
import remarkWrap from "./remarkWrap";
import { remarkMediaCard } from "./remarkMediaCard";
import { remarkLinkProcessor } from "./remarkLinkProcessor";
import { remarkObsidianEmbeds } from "./remarkObsidianEmbeds";
import { optimizeImage } from "./optimizeImages";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function processProtectedPostHtml(content: string): Promise<string> {
  const $ = cheerio.load(content);
  const images = $("img[src]");

  for (let i = 0; i < images.length; i++) {
    const img = $(images[i]);
    const src = img.attr("src") || "";

    if (!src || !src.includes("attachment")) continue;

    try {
      const optimized = await optimizeImage(src, { thumbnailSize: 1000 });
      img.attr("src", optimized.thumbnail);
      img.attr("width", optimized.width.toString());
      img.attr("height", optimized.height.toString());
    } catch {
      // Keep the original src if optimization fails.
    }
  }

  return $("body").html() || $.root().html() || "";
}

export async function renderProtectedPostHtml(
  markdown: string,
  filePath?: string
): Promise<string> {
  try {
    const processed = await unified()
      .use(remarkParse)
      .use(remarkObsidianEmbeds, { enableDebug: false })
      .use(remarkLinkProcessor, { enableDebug: false })
      .use(remarkMediaCard, { enableDebug: false })
      .use(remarkToc, { heading: "目录" })
      .use(remarkWrap, { className: "article-toc-nav" })
      .use(remarkRehype)
      .use(rehypeSlug)
      .use(rehypeFigure)
      .use(rehypeStringify)
      .process({ value: markdown, path: filePath });

    return processProtectedPostHtml(processed.toString());
  } catch {
    return `<pre>${escapeHtml(markdown)}</pre>`;
  }
}
