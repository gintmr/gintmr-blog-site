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
          <p className="discussion-shell__eyebrow">
            {UI_LOCALE === "zh-CN" ? "讨论" : "Discussion"}
          </p>
          <h2 className="discussion-shell__title">
            {UI_LOCALE === "zh-CN" ? "留言与回响" : "Notes from readers"}
          </h2>
          <p className="discussion-shell__desc">
            {UI_LOCALE === "zh-CN"
              ? "把评论区也当成文章的一部分。欢迎留下补充、质疑，或者你自己的线索。"
              : "Treat the discussion as part of the piece: additions, disagreements, and side notes all belong here."}
          </p>
        </div>

        <div className="discussion-shell__embed">
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
    <section className="discussion-shell discussion-shell--empty">
      <div className="discussion-shell__head">
        <p className="discussion-shell__eyebrow">
          {UI_LOCALE === "zh-CN" ? "讨论" : "Discussion"}
        </p>
        <h2 className="discussion-shell__title">
          {UI_LOCALE === "zh-CN" ? "评论区尚未接通" : "Discussion is not connected yet"}
        </h2>
        <p className="discussion-shell__desc">
          {UI_LOCALE === "zh-CN"
            ? "需要配置 Giscus 环境变量后，这里才会显示真实评论区。"
            : "Configure Giscus environment variables and this panel will turn into the live discussion area."}
        </p>
      </div>
      <div className="discussion-shell__empty-note">
        <code>PUBLIC_GISCUS_REPO</code>
        <code>PUBLIC_GISCUS_REPO_ID</code>
      </div>
    </section>
  );
}
