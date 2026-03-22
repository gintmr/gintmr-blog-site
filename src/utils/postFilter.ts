import type { CollectionEntry } from "astro:content";
import { SITE } from "@/config";
import { getPublishTimestamp } from "@/utils/pubDatetime";

const postFilter = ({ data }: CollectionEntry<"blog">) => {
  const publishTimestamp = getPublishTimestamp(data.pubDatetime);
  if (publishTimestamp === null) return false;

  const isPublishTimePassed =
    Date.now() > publishTimestamp - SITE.scheduledPostMargin;
  return !data.draft && (import.meta.env.DEV || isPublishTimePassed);
};

export default postFilter;
