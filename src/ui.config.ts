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
  gridOverlay: false,
  // 鼠标跟随辉光（移动端自动关闭）
  cursorGlow: false,
  // 内容滚动显现动画
  revealOnScroll: false,
  // 卡片悬浮光晕
  cardHoverGlow: false,
  // 页面切换轻转场（基于 View Transitions）
  pageTransition: true,
  // 导航栏玻璃高亮层
  navGlass: true,
  // 标题底部的动态强调线
  headingBeam: true,
  // 图片荧光描边与背光
  imageNeonBorder: true,
  // 图片轻微浮起（桌面端）
  imageLift: true,
} as const;
