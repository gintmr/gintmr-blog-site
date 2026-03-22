export const TOP_PUB_DATETIME = "top" as const;

export type TopPubDatetime = typeof TOP_PUB_DATETIME;
export type SupportedPubDatetime = Date | TopPubDatetime;

export const isTopPubDatetime = (value: unknown): value is TopPubDatetime => {
  return (
    typeof value === "string" &&
    value.trim().toLowerCase() === TOP_PUB_DATETIME
  );
};

export const isDatePubDatetime = (value: unknown): value is Date => {
  return value instanceof Date && !Number.isNaN(value.getTime());
};

export const getPublishTimestamp = (value: unknown): number | null => {
  if (!isDatePubDatetime(value)) return null;
  return value.getTime();
};

