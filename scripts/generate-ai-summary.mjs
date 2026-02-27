#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

async function loadDotenvFromProjectRoot() {
  const envPath = path.resolve(process.cwd(), ".env");
  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIndex = line.indexOf("=");
      if (eqIndex < 1) continue;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env 不存在时忽略
  }
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  pnpm ai:summary -- <post-file> [--force]",
      "  pnpm ai:summary -- --all [--force] [--include-disabled]",
      "",
      "Examples:",
      "  pnpm ai:summary -- src/data/blog/reading-bookmarks-and-media-cards.md",
      "  pnpm ai:summary -- --all",
      "  pnpm ai:summary -- --all --force",
    ].join("\n")
  );
}

async function listBlogFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listBlogFiles(absolute)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(md|mdx)$/i.test(entry.name)) continue;
    files.push(absolute);
  }
  return files.sort();
}

function extractFrontmatter(rawContent, targetPath) {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error(`Missing YAML frontmatter in: ${targetPath}`);
  }
  return {
    frontmatter: match[1],
    body: rawContent.slice(match[0].length),
  };
}

function findTitle(frontmatter, fallback) {
  const match = frontmatter.match(/^title:\s*(.+)$/m);
  if (!match) return fallback;
  return match[1].trim().replace(/^['"]|['"]$/g, "");
}

function parseBooleanScalar(frontmatter, key, fallback = false) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) return fallback;
  const raw = match[1].trim().toLowerCase();
  return raw === "true" || raw === "yes" || raw === "1";
}

function hasNonEmptySummary(frontmatter) {
  const match = frontmatter.match(/^summary:\s*(.*)$/m);
  if (!match) return false;
  const raw = match[1].trim();
  if (!raw) return false;
  if (raw === "null" || raw === "~") return false;
  if (raw === `""` || raw === `''`) return false;
  return true;
}

function upsertScalar(frontmatter, key, scalarValue) {
  const line = `${key}: ${scalarValue}`;
  const keyPattern = new RegExp(`^${key}:.*$`, "m");
  if (keyPattern.test(frontmatter)) {
    return frontmatter.replace(keyPattern, line);
  }
  const normalized = frontmatter.trimEnd();
  return `${normalized}\n${line}\n`;
}

function normalizeSummary(text, maxChars) {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxChars) return singleLine;
  return `${singleLine.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
}

async function requestSummary({
  apiKey,
  baseUrl,
  model,
  temperature,
  maxInputChars,
  maxSummaryChars,
  title,
  body,
}) {
  const input = body.replace(/\r/g, "").trim().slice(0, maxInputChars);
  const prompt = [
    `文章标题：${title}`,
    "",
    "请输出一段中文 AI 摘要，要求：",
    `1. 长度不超过 ${maxSummaryChars} 字`,
    "2. 语气自然、准确，不要夸张",
    "3. 只输出摘要正文，不要附加前缀",
    "",
    "文章内容：",
    input,
  ].join("\n");

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        {
          role: "system",
          content:
            "你是一个博客摘要助手。你只输出高质量、简洁、事实一致的中文摘要正文。",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("DeepSeek API returned empty summary");
  }

  return normalizeSummary(content, maxSummaryChars);
}

async function updatePostSummary(targetPath, config) {
  const raw = await fs.readFile(targetPath, "utf8");
  const { frontmatter, body } = extractFrontmatter(raw, targetPath);
  const title = findTitle(frontmatter, path.basename(targetPath));
  const summaryExists = hasNonEmptySummary(frontmatter);
  const summaryEnabled = parseBooleanScalar(frontmatter, "enableAISummary", false);

  if (!config.force) {
    if (config.onlyEnabled && !summaryEnabled) {
      console.log(
        `Skipped (enableAISummary=false): ${path.relative(process.cwd(), targetPath)}`
      );
      return false;
    }

    if (summaryExists) {
      console.log(
        `Skipped (summary exists): ${path.relative(process.cwd(), targetPath)}`
      );
      return false;
    }
  }

  const summary = await requestSummary({
    ...config,
    title,
    body,
  });

  let updatedFrontmatter = frontmatter;
  updatedFrontmatter = upsertScalar(
    updatedFrontmatter,
    "summary",
    JSON.stringify(summary)
  );
  if (!summaryEnabled || config.force) {
    updatedFrontmatter = upsertScalar(
      updatedFrontmatter,
      "enableAISummary",
      "true"
    );
  }

  const next = `---\n${updatedFrontmatter.trimEnd()}\n---\n\n${body.trimStart()}`;
  await fs.writeFile(targetPath, next, "utf8");
  console.log(`Updated summary: ${path.relative(process.cwd(), targetPath)}`);
  return true;
}

async function main() {
  await loadDotenvFromProjectRoot();

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is missing. Please set it in .env");
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/$/,
    ""
  );
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
  const maxInputChars = Number(process.env.DEEPSEEK_MAX_INPUT_CHARS || "12000");
  const maxSummaryChars = Number(
    process.env.DEEPSEEK_SUMMARY_MAX_CHARS || "180"
  );
  const temperature = Number(process.env.DEEPSEEK_TEMPERATURE || "0.4");

  const rawArgs = process.argv.slice(2);
  const force = rawArgs.includes("--force");
  const all = rawArgs.includes("--all");
  const onlyEnabled = !rawArgs.includes("--include-disabled");
  const targetsFromArgs = rawArgs.filter(arg => !arg.startsWith("--"));

  if (!all && targetsFromArgs.length === 0) {
    printUsage();
    process.exit(1);
  }

  const targets =
    all
      ? await listBlogFiles(path.resolve(process.cwd(), "src/data/blog"))
      : targetsFromArgs.map(file => path.resolve(process.cwd(), file));

  if (targets.length === 0) {
    throw new Error("No blog files found");
  }

  let updatedCount = 0;
  for (const targetPath of targets) {
    const updated = await updatePostSummary(targetPath, {
      apiKey,
      baseUrl,
      model,
      maxInputChars,
      maxSummaryChars,
      temperature,
      force,
      onlyEnabled,
    });
    if (updated) updatedCount += 1;
  }

  if (updatedCount === 0) {
    console.log("No post required AI summary update.");
  }
}

main().catch(error => {
  console.error(`[ai:summary] ${error.message}`);
  process.exit(1);
});
