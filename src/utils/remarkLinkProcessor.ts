import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Link } from "mdast";
import { processLink } from "./linkProcessor";

interface RemarkLinkProcessorOptions {
  enableDebug?: boolean;
}

/**
 * Remark插件：处理markdown中的相对链接
 * 将指向blog文件夹下md/mdx文件的相对链接转换为/blog/[slug]格式
 */
export const remarkLinkProcessor: Plugin<
  [RemarkLinkProcessorOptions?],
  Root
> = (options = {}) => {
  const { enableDebug = false } = options;

  return (tree, file) => {
    // 获取当前文件路径，用于解析相对路径
    const currentFilePath = file.path || file.history?.[0];

    if (enableDebug) {
      console.log("Processing file:", currentFilePath);
    }

    visit(tree, "link", (node: Link) => {
      const originalUrl = node.url;

      // 跳过绝对URL、锚点链接等
      if (
        originalUrl.startsWith("http://") ||
        originalUrl.startsWith("https://") ||
        originalUrl.startsWith("#") ||
        originalUrl.startsWith("mailto:") ||
        originalUrl.startsWith("tel:")
      ) {
        return;
      }

      // 处理链接
      const processedUrl = processLink(originalUrl, currentFilePath);

      if (processedUrl !== originalUrl) {
        if (enableDebug) {
          console.log(`Link processed: ${originalUrl} -> ${processedUrl}`);
        }
        node.url = processedUrl;

        // 对站内文章链接保持站内跳转，不强制新开标签。
        if (/^\/(blog|story|diary)\//.test(processedUrl) && node.data?.hProperties) {
          delete (node.data.hProperties as Record<string, string>).target;
          delete (node.data.hProperties as Record<string, string>).rel;
        }
      }
    });
  };
};

export default remarkLinkProcessor;
