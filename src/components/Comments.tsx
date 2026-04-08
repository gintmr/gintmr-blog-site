import { useEffect, useState } from "react";
import Giscus from "@giscus/react";
import {
  PUBLIC_GISCUS_HOST,
  PUBLIC_GISCUS_REPO,
  PUBLIC_GISCUS_REPO_ID,
  PUBLIC_GISCUS_CATEGORY,
  PUBLIC_GISCUS_CATEGORY_ID,
  PUBLIC_GISCUS_LANG,
} from "astro:env/client";
import { UI_LOCALE } from "@/i18n/ui";

function detectTheme(): "light" | "dark" | "preferred_color_scheme" {
  if (typeof window === "undefined") return "preferred_color_scheme";
  const dataTheme = document.documentElement.getAttribute("data-theme");
  if (dataTheme === "dark" || dataTheme === "light") return dataTheme;
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function Comments() {
  const [theme, setTheme] = useState<
    "light" | "dark" | "preferred_color_scheme"
  >(detectTheme());

  // 跟随站内切换
  useEffect(() => {
    // 站内按钮会切换 theme，用 MO 监听
    const mo = new MutationObserver(() => {
      const dataTheme = document.documentElement.getAttribute("data-theme");
      setTheme(dataTheme === "dark" ? "dark" : "light");
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      mo.disconnect();
    };
  }, []);

  // 检查必填字段是否都已配置
  if (PUBLIC_GISCUS_REPO && PUBLIC_GISCUS_REPO_ID) {
    return (
      <section className="discussion-shell">
        <div className="discussion-shell__head">
          <h2 className="discussion-shell__title">
            {UI_LOCALE === "zh-CN" ? "讨论" : "Discussion"}
          </h2>
          <p className="discussion-shell__desc">
            {UI_LOCALE === "zh-CN"
              ? "欢迎留下看法、补充或继续聊下去。"
              : "Thoughts, follow-ups, and side notes are all welcome here."}
          </p>
        </div>
        <div className="discussion-shell__body">
          <Giscus
            host={PUBLIC_GISCUS_HOST || "https://giscus.app"}
            repo={PUBLIC_GISCUS_REPO as `${string}/${string}`}
            repoId={PUBLIC_GISCUS_REPO_ID}
            category={PUBLIC_GISCUS_CATEGORY}
            categoryId={PUBLIC_GISCUS_CATEGORY_ID}
            mapping="pathname"
            strict="0"
            reactionsEnabled="1"
            emitMetadata="0"
            inputPosition="bottom"
            theme={theme}
            loading="lazy"
            lang={PUBLIC_GISCUS_LANG || (UI_LOCALE === "zh-CN" ? "zh-CN" : "en")}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="discussion-shell">
      <div className="discussion-shell__head">
        <h2 className="discussion-shell__title">
          {UI_LOCALE === "zh-CN" ? "讨论" : "Discussion"}
        </h2>
        <p className="discussion-shell__desc">
          {UI_LOCALE === "zh-CN"
            ? "评论区需要先配置 Giscus。"
            : "Giscus needs to be configured before comments can appear."}
        </p>
      </div>
      <div className="discussion-shell__body discussion-shell__body--empty">
        <p>
          Comments require Giscus configuration. Set these environment variables:
          <br />
          <code>PUBLIC_GISCUS_REPO, PUBLIC_GISCUS_REPO_ID</code>
        </p>
      </div>
    </section>
  );
}
