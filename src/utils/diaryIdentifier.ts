const RANGE_SEPARATOR_PATTERN =
  "(?:到|至|~|～|to|TO|_to_|-to-|--|—|–|_|\\.{2,}|\\s+to\\s+)";

const SINGLE_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const RANGE_DATE_REGEX = new RegExp(
  `^(\\d{4}-\\d{2}-\\d{2})\\s*${RANGE_SEPARATOR_PATTERN}\\s*(\\d{4}-\\d{2}-\\d{2})$`
);

export interface DiaryIdentifierMeta {
  rawId: string;
  startDate: string;
  endDate: string;
  isRange: boolean;
  quarterKey: string;
  sortKey: string;
}

function normalizeIdentifier(id: string): string {
  return id.replace(/\.mdx?$/i, "").trim();
}

function isValidDateString(dateString: string): boolean {
  const match = dateString.match(SINGLE_DATE_REGEX);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function parseDatesFromIdentifier(raw: string): {
  startDate: string;
  endDate: string;
  isRange: boolean;
} {
  const rangeMatch = raw.match(RANGE_DATE_REGEX);
  if (rangeMatch) {
    const start = rangeMatch[1];
    const end = rangeMatch[2];
    if (isValidDateString(start) && isValidDateString(end)) {
      return start <= end
        ? { startDate: start, endDate: end, isRange: true }
        : { startDate: end, endDate: start, isRange: true };
    }
  }

  if (isValidDateString(raw)) {
    return { startDate: raw, endDate: raw, isRange: false };
  }

  const candidates = raw.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  const validCandidates = candidates.filter(isValidDateString);

  if (validCandidates.length >= 2) {
    const [a, b] = validCandidates;
    return a <= b
      ? { startDate: a, endDate: b, isRange: true }
      : { startDate: b, endDate: a, isRange: true };
  }

  if (validCandidates.length === 1) {
    return {
      startDate: validCandidates[0],
      endDate: validCandidates[0],
      isRange: false,
    };
  }

  // Fallback to a safe value to avoid runtime failures.
  return { startDate: "1970-01-01", endDate: "1970-01-01", isRange: false };
}

function toQuarterKey(date: string): string {
  const [year, month] = date.split("-");
  const quarter = Math.ceil(Number(month) / 3);
  return `${year}-Q${quarter}`;
}

export function parseDiaryIdentifier(id: string): DiaryIdentifierMeta {
  const rawId = normalizeIdentifier(id);
  const { startDate, endDate, isRange } = parseDatesFromIdentifier(rawId);

  return {
    rawId,
    startDate,
    endDate,
    isRange,
    quarterKey: toQuarterKey(startDate),
    sortKey: endDate,
  };
}
