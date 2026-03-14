export const BLOG_PATH = "src/data/blog";
export const DIARY_PATH = "src/data/diary";
export const STORY_PATH = "src/data/story";

export const SITE = {
  website: "https://gintmr.20250130.xyz/", // replace this with your deployed domain
  author: "Gintmr",
  profile: "https://gintmr.20250130.xyz/",
  desc: "一个时间长河中的个人档案馆。",
  title: "Gintmr's Home 🤗",
  favicon: "favicon.png",
  faviconVersion: "20260226",
  ogImage: "og.jpg",
  lightAndDarkMode: false,
  postPerIndex: 5,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "https://github.com/gintmr/gintmr-blog-site",
  },
  comments: {
    enabled: true, // 启用评论功能
  },
  dynamicOgImage: false,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  uiLocale: "en", // "en" | "zh-CN"
  timezone: "Asia/Shanghai", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
