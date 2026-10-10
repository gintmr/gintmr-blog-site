/**
 * 构建前补齐 submodule。
 *
 * 背景：Vercel 的克隆拿不到本仓库的私有 submodule，日志里是一行警告，
 * 然后内容目录和库目录都是空的，astro check 直接报错退出：
 *
 *   Warning: Failed to fetch one or more git submodules
 *   [glob-loader] The base directory "src/data/blog/" does not exist.
 *   error ts(2307): Cannot find module '../../vendor/gintmr-ui/src/primitives/index.js'
 *
 * 换 HTTPS 地址也救不了（那是 Vercel 侧没有私有库凭据，不是 URL 形式的问题），
 * 所以这里自己拉：有 token 就走 HTTPS，没有就让 git 按原样试一次，
 * 两种情况都会在失败时把该做什么讲清楚，不再是一个看不懂的 ts(2307)。
 *
 * 本地开发不受影响：submodule 已就位时这一步直接跳过。
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const REQUIRED = [
  { path: 'src/data/blog', label: 'src/data（站点内容）' },
  { path: 'vendor/gintmr-ui/src', label: 'vendor/gintmr-ui（组件库源码）' },
];

const missing = REQUIRED.filter(item => !existsSync(item.path));
if (missing.length === 0) {
  console.log('[submodules] 已就位，跳过');
  process.exit(0);
}

console.log(
  `[submodules] 缺少 ${missing.map(item => item.label).join('、')}，尝试拉取`
);

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const args = ['submodule', 'update', '--init', '--recursive'];
if (token) {
  // 用 token 走 HTTPS：Vercel 上没有 SSH 密钥，只能靠这一条
  args.unshift(
    '-c',
    `url."https://x-access-token:${token}@github.com/".insteadOf="https://github.com/"`
  );
}

let error = '';
try {
  execFileSync('git', args, { stdio: 'inherit' });
} catch (caught) {
  error = caught instanceof Error ? caught.message : String(caught);
}

const stillMissing = REQUIRED.filter(item => !existsSync(item.path));
if (stillMissing.length === 0) {
  console.log('[submodules] 拉取完成');
  process.exit(0);
}

console.error(
  [
    '',
    `[submodules] 仍然缺少：${stillMissing.map(item => item.label).join('、')}`,
    error ? `git 报错：${error.split('\n')[0]}` : '',
    '',
    '这两个都是私有仓库，构建环境必须有凭据才能拉取。二选一：',
    '',
    'A. 给构建环境一个只读 token（推荐）',
    '   在 GitHub 建一个 fine-grained PAT，仓库访问只勾 gintmr-blog-content 与 gintmr-ui、',
    '   权限只给 Contents: Read，然后在 Vercel 项目的 Environment Variables 里加',
    '   GITHUB_TOKEN=<那个 PAT>（Production / Preview / Development 全勾上），重新部署。',
    '',
    'B. 本地构建后直接发布（submodule 在本地是有的，这一步会自动跳过）',
    '   pnpm build && npx vercel --prod',
    '',
  ]
    .filter(Boolean)
    .join('\n')
);
process.exit(1);
