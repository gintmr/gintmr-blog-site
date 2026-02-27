import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { SITE, BLOG_PATH, DIARY_PATH } from "@/config";

const normalizeOptionalString = (value: unknown): unknown => {
  if (value == null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["其他"]),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
      summary: z.preprocess(
        normalizeOptionalString,
        z.string().optional()
      ),
      enableAISummary: z.boolean().default(false),
      keywords: z.array(z.string()).optional(),
      mainPoints: z.array(z.string()).optional(),
      password: z.preprocess(
        normalizeOptionalString,
        z.string().min(1).optional()
      ),
      passwordHint: z.preprocess(
        normalizeOptionalString,
        z.string().optional()
      ),
    }),
});

const diary = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${DIARY_PATH}` }),
  schema: z.object({
    tags: z.array(z.string()).default(["Diary"]),
    draft: z.boolean().optional(),
  }),
});

const links = defineCollection({
  loader: glob({ pattern: "links/**/[^_]*.{md,mdx}", base: "./src/data" }),
  schema: z.object({
    title: z.preprocess(
      normalizeOptionalString,
      z.string().optional()
    ),
    description: z.preprocess(
      normalizeOptionalString,
      z.string().optional()
    ),
    draft: z.boolean().optional(),
    order: z.number().optional(),
  }),
});

export const collections = { blog, diary, links };
