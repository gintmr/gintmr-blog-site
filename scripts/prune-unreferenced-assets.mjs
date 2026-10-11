/**
 * 构建后收尾：剪掉产物里没有任何地方引用到的媒体文件。
 *
 * 为什么需要：这个站点的媒体（Story 视频、附件）有 1GB 量级，而 Vercel 的
 * Deployment Storage 是按每次部署的快照计的。构建时被拉进产物的文件远比真正
 * 被引用到的多 —— Story 目录里的草稿、没有任何页面与 RSS 用到的附件，都会照样
 * 落进产物，于是每一次推送都在为它们付存储。
 *
 * 判据用的是文件名，不是 URL 拼串：
 *   产物里出现过的引用，无论写法如何，URL 里一定带着那个文件名（_astro 下的
 *   文件名还含内容哈希，天然唯一）。只要「原始名 / %20 编码名 / encodeURIComponent
 *   名」三种写法都没在产物文本里出现过，这个文件就不可能被访问到。
 *   反过来，判不到的文件我们一律保留 —— 宁可部署大，不可部署坏。
 *
 * 安全网：先搬到 dist/.prune-staging 而不是直接删，搬完复查那条不变式
 * （被剪掉的文件，文件名确实一次都没出现），任何一处不符合就整批搬回并退出 1。
 */

import { mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}
import path from "node:path";

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".xml",
  ".txt",
  ".lrc",
]);
const PRUNABLE_ROOTS = ["_astro", path.join("src", "data", "attachment")];
const STAGING = ".prune-staging";
// 小文件省不下多少，却会放大误剪的概率，只处理有点分量的
const MIN_SIZE = 64 * 1024;

async function walk(dir, onFile) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, onFile);
    else if (entry.isFile()) await onFile(full);
  }
}

async function readOutputText(distDir) {
  const parts = [];
  await walk(distDir, async file => {
    if (file.includes(`${path.sep}${STAGING}${path.sep}`)) return;
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) return;
    try {
      parts.push(await readFile(file, "utf8"));
    } catch {
      /* 读不了就跳过，只影响「是否认得出来」，不会导致误剪 */
    }
  });
  return parts.join("\n");
}

/* 文件名在产物里的三种可能写法 */
function nameVariants(basename) {
  return [...new Set([basename, basename.replace(/ /g, "%20"), encodeURIComponent(basename)])];
}

function isReferenced(blob, basename) {
  return nameVariants(basename).some(variant => blob.includes(variant));
}

async function main() {
  const rootDir = process.cwd();
  // 默认剪 dist；CI 里 vercel build 会把产物放进 .vercel/output/static，
  // 那里也可以直接剪，两条路都用同一个脚本，判据只有一处。
  const targetDir = process.argv[2] || "dist";
  const distDir = path.isAbsolute(targetDir) ? targetDir : path.join(rootDir, targetDir);
  if (!(await exists(distDir))) {
    console.warn(`[prune] ${targetDir} 不存在，跳过剪裁`);
    return;
  }
  const stagingDir = path.join(distDir, STAGING);

  const blob = await readOutputText(distDir);
  if (!blob) {
    console.warn("[prune] 产物里没读到任何文本，跳过剪裁");
    return;
  }

  const candidates = [];
  for (const root of PRUNABLE_ROOTS) {
    await walk(path.join(distDir, root), async file => {
      const info = await stat(file);
      if (info.size < MIN_SIZE) return;
      if (isReferenced(blob, path.basename(file))) return;
      candidates.push({
        file,
        url: `/${path.relative(distDir, file).split(path.sep).join("/")}`,
        size: info.size,
      });
    });
  }

  if (candidates.length === 0) {
    console.log("[prune] 没有可剪的资源");
    return;
  }

  await mkdir(stagingDir, { recursive: true });
  const moved = [];
  for (const item of candidates) {
    const target = path.join(stagingDir, item.url);
    await mkdir(path.dirname(target), { recursive: true });
    await rename(item.file, target);
    moved.push(item);
  }

  /* 复查不变式：剪掉的每一个，文件名都不该在产物里出现过 */
  const violated = moved.filter(item => isReferenced(blob, path.basename(item.file)));
  if (violated.length > 0) {
    for (const item of moved) {
      const from = path.join(stagingDir, item.url);
      await mkdir(path.dirname(item.file), { recursive: true });
      await rename(from, item.file);
    }
    await rm(stagingDir, { recursive: true, force: true });
    console.error(`[prune] 复查没过：${violated.length} 个被剪文件其实仍被引用，已全部搬回`);
    console.error(`[prune] 前几个：${violated.slice(0, 5).map(v => path.basename(v.file)).join("  ")}`);
    process.exit(1);
  }

  await rm(stagingDir, { recursive: true, force: true });
  const freed = moved.reduce((sum, item) => sum + item.size, 0);
  console.log(
    `[prune] 剪掉 ${moved.length} 个无引用文件，释放 ${(freed / 1048576).toFixed(0)}MB`
  );
}

main().catch(error => {
  console.error("[prune] 剪裁失败");
  console.error(error);
  process.exit(1);
});
