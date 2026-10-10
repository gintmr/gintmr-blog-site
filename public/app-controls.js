// 浏览历史栈：记录最近访问过的页面，供返回按钮使用。
// 主题、视频、Live Photo、音频歌词、图片查看器均已移交 vendor/gintmr-ui。
(function () {
  "use strict";

  const readStack = () => {
    try {
      return JSON.parse(sessionStorage.getItem("lastPages") || "[]");
    } catch {
      return [];
    }
  };

  const writeStack = arr => {
    // 只保留最近 10 条
    sessionStorage.setItem("lastPages", JSON.stringify(arr.slice(-10)));
  };

  const currentBase = () => location.pathname + location.search;

  const pushCurrentPageToStack = () => {
    const stack = readStack();
    const cur = currentBase();
    if (stack[stack.length - 1] !== cur) {
      stack.push(cur); // 去重：仅当与栈顶不同才写
      writeStack(stack);
    }
  };

  // Astro 客户端路由换页前记录；整页跳转走 pagehide / beforeunload
  document.addEventListener("astro:before-preparation", pushCurrentPageToStack);
  window.addEventListener("pagehide", pushCurrentPageToStack, { capture: true });
  window.addEventListener("beforeunload", pushCurrentPageToStack);
})();
