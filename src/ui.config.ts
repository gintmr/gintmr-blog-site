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

export const UI_COLORS = {
  // 全站主色板（浅色）
  light: {
    background: "#fffaff",
    foreground: "#2f2638",
    accent: "#b992ff",
    muted: "#ecdff8",
    border: "#e4d2ef",
  },
  // 全站主色板（深色）
  dark: {
    background: "#191919",
    foreground: "#f4ecff",
    accent: "#d7a2ff",
    muted: "#67557f",
    border: "#8b74ad4d",
  },
  // 图片霓虹特效颜色（建议高亮色）
  imageNeonGlow: "#4de688",
  // 图片霓虹渐变边框色板（按四边渐变）
  imageNeonGradient: {
    c1: "#ffe45f",
    c2: "#7af9ff",
    c3: "#ff8ad8",
    c4: "#b8ff7d",
  },
  // AI 总结卡片的视觉色板
  aiSummary: {
    border: "#d7b6ff66",
    bgFrom: "#ccadff3a",
    bgVia: "#f4c6f62e",
    bgTo: "#ffc8e32b",
    titleFrom: "#f2c4ff",
    titleTo: "#c995ff",
    starFrom: "#ffd8ff",
    starTo: "#b581ff",
    selectionBg: "#c89dff66",
  },
} as const;

export const UI_EFFECTS = {
  // 页面背景环境光
  ambientGlow: true,
  // 轻量网格纹理
  gridOverlay: true,
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
