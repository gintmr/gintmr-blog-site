import { STORY_PATH } from "@/config";
import { slugifyStr } from "./slugify";

export function getStoryPath(
  id: string,
  filePath: string | undefined,
  includeBase = true
) {
  const pathSegments = filePath
    ?.replace(STORY_PATH, "")
    .split("/")
    .filter(path => path !== "")
    .filter(path => !path.startsWith("_"))
    .slice(0, -1)
    .map(segment => slugifyStr(segment));

  const basePath = includeBase ? "/stories" : "";
  const storyId = id.split("/");
  const slug = storyId.length > 0 ? storyId.slice(-1) : storyId;

  if (!pathSegments || pathSegments.length < 1) {
    return [basePath, slug].join("/");
  }

  return [basePath, ...pathSegments, slug].join("/");
}

