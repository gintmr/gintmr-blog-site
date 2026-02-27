export const UI_THEME = {
  // 设为 true 后站点固定深色模式（并隐藏主题切换按钮）。
  forceDarkMode: true,
} as const;

export const UI_FONTS = {
  // 全站中英文无衬线字体（导航、按钮等）
  sans:
    "'Noto Sans SC Variable', 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
  // 全站正文衬线字体（文章主体）
  serif:
    "'Noto Serif SC Variable', 'Source Han Serif SC', 'Songti SC', 'Times New Roman', serif",
  // 代码与等宽字体
  mono:
    "'JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Consolas', monospace",
} as const;

export const UI_EFFECTS = {
  // 页面背景环境光
  ambientGlow: true,
  // 轻量网格纹理
  gridOverlay: true,
  // 鼠标跟随辉光（移动端自动关闭）
  cursorGlow: true,
  // 内容滚动显现动画
  revealOnScroll: true,
  // 卡片悬浮光晕
  cardHoverGlow: true,
} as const;

