import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const rootDir = process.cwd();
  const distDir = path.join(rootDir, "dist");
  const srcAttachmentDir = path.join(rootDir, "src", "data", "attachment");
  const destAttachmentDir = path.join(
    distDir,
    "src",
    "data",
    "attachment"
  );

  if (!(await exists(distDir))) {
    console.warn("[postbuild] dist directory not found, skip copying attachments.");
    return;
  }

  if (!(await exists(srcAttachmentDir))) {
    console.warn(
      "[postbuild] src/data/attachment not found, skip copying attachments."
    );
    return;
  }

  await rm(destAttachmentDir, { recursive: true, force: true });
  await mkdir(path.dirname(destAttachmentDir), { recursive: true });
  await cp(srcAttachmentDir, destAttachmentDir, {
    recursive: true,
    force: true,
  });

  console.log(
    `[postbuild] attachment assets copied to ${path.relative(
      rootDir,
      destAttachmentDir
    )}`
  );
}

main().catch(error => {
  console.error("[postbuild] failed to copy attachment assets.");
  console.error(error);
  process.exit(1);
});
