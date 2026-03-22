import type { CollectionEntry } from "astro:content";
import { getPublishTimestamp } from "@/utils/pubDatetime";

const getSortedStories = (stories: CollectionEntry<"story">[]) => {
  return stories
    .filter(story => getPublishTimestamp(story.data.pubDatetime) !== null)
    .filter(story => !story.data.draft)
    .sort((a, b) => {
      const bTimestamp = getPublishTimestamp(b.data.pubDatetime) ?? 0;
      const aTimestamp = getPublishTimestamp(a.data.pubDatetime) ?? 0;
      return Math.floor(bTimestamp / 1000) - Math.floor(aTimestamp / 1000);
    });
};

export default getSortedStories;
