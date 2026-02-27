import { SITE } from "@/config";

type Locale = "en" | "zh-CN";

const locale = (SITE.uiLocale ?? "en") as Locale;

const EN = {
  nav: {
    blog: "Blog",
    about: "About",
    links: "Links",
    archives: "Archives",
  },
  breadcrumb: {
    home: "Timeline",
    blog: "Blog",
    diary: "Diary",
    archives: "Archives",
    about: "About",
    search: "Search",
    links: "Links",
    postsPage: (page: number) => (page <= 1 ? "Blog" : `Blog (Page ${page})`),
    tagPage: (tag: string, page: number) =>
      page <= 1 ? tag : `${tag} (Page ${page})`,
  },
  common: {
    back: "Back",
    backToTop: "Back to top",
    contactMe: "Contact",
  },
  pages: {
    blogTitle: "Blog",
    allPosts: "All Posts",
    tags: "Tags",
    taggedPosts: (tag: string) => `Posts tagged "${tag}"`,
    searchTitle: "Search",
    searchDesc: "Search what you're looking for...",
    timelineTitle: "Timeline",
    linksTitle: "Links",
    linksDesc: "Friends and creators I recommend.",
    linksEmpty: "No links yet.",
    linksVisit: "Visit site",
    archivesTitle: "Archives",
    notFound: "Page not found",
    goHome: 'Back to "Timeline"',
  },
  post: {
    previous: "Previous",
    next: "Next",
  },
  diary: {
    noEntryInQuarter: "No diary entries in this quarter.",
    empty: "No diary entries yet...",
    loading: "Loading...",
    loadingAria: "Loading more diary entries",
    loadingHint: "Loading more diary content. Please wait.",
    noMore: "No more entries.",
    noMoreHint: (count: number) => `All ${count} diary entries are shown.`,
    loadMore: "Load more entries",
    loadMoreHint:
      "Click to load more entries, or keep scrolling to auto-load.",
  },
};

const ZH = {
  nav: {
    blog: "文章",
    about: "关于",
    links: "友链",
    archives: "收集箱",
  },
  breadcrumb: {
    home: "时间档案",
    blog: "文章",
    diary: "日记",
    archives: "收集箱",
    about: "关于",
    search: "搜索",
    links: "友链",
    postsPage: (page: number) => (page <= 1 ? "文章" : `文章 (第 ${page} 页)`),
    tagPage: (tag: string, page: number) =>
      page <= 1 ? tag : `${tag} (第 ${page} 页)`,
  },
  common: {
    back: "返回",
    backToTop: "返回顶部",
    contactMe: "联系我",
  },
  pages: {
    blogTitle: "文章",
    allPosts: "全部文章",
    tags: "标签",
    taggedPosts: (tag: string) => `标签 "${tag}" 的所有文章`,
    searchTitle: "搜索",
    searchDesc: "搜索你想了解的内容...",
    timelineTitle: "时间档案",
    linksTitle: "友链",
    linksDesc: "这里是我推荐的网站与创作者。",
    linksEmpty: "暂无友链内容。",
    linksVisit: "访问网站",
    archivesTitle: "收集箱",
    notFound: "页面未找到",
    goHome: "返回「时间档案」",
  },
  post: {
    previous: "上一篇",
    next: "下一篇",
  },
  diary: {
    noEntryInQuarter: "这个季度还没有日记",
    empty: "还没有任何日记...",
    loading: "加载中...",
    loadingAria: "正在加载更多日记条目",
    loadingHint: "正在为您加载更多日记内容，请稍候",
    noMore: "没有更多内容了",
    noMoreHint: (count: number) => `已显示全部 ${count} 条日记记录`,
    loadMore: "加载更多日记",
    loadMoreHint: "点击此按钮加载更多日记条目，或继续向下滚动自动加载",
  },
};

export const UI = locale === "zh-CN" ? ZH : EN;
export const UI_LOCALE = locale;
export const MONTHS =
  locale === "zh-CN"
    ? [
        "一月",
        "二月",
        "三月",
        "四月",
        "五月",
        "六月",
        "七月",
        "八月",
        "九月",
        "十月",
        "十一月",
        "十二月",
      ]
    : [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
