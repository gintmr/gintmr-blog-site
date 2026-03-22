import type { CollectionEntry } from "astro:content";
import postFilter from "./postFilter";
import { getPublishTimestamp } from "@/utils/pubDatetime";

const getSortedPosts = (posts: CollectionEntry<"blog">[]) => {
  return posts
    .filter(postFilter)
    .sort((a, b) => {
      const bTimestamp =
        getPublishTimestamp(b.data.modDatetime ?? b.data.pubDatetime) ?? 0;
      const aTimestamp =
        getPublishTimestamp(a.data.modDatetime ?? a.data.pubDatetime) ?? 0;
      return Math.floor(bTimestamp / 1000) - Math.floor(aTimestamp / 1000);
    });
};

export default getSortedPosts;
