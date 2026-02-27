export interface LinkCard {
  title: string;
  url: string;
  description?: string;
  image?: string;
}

const CODE_BLOCK_REGEX = /```card-link\s*([\s\S]*?)```/g;

function cleanValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseBlock(block: string): LinkCard | null {
  const map: Record<string, string> = {};
  const lines = block
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = cleanValue(line.slice(idx + 1));
    if (!value) continue;
    map[key] = value;
  }

  if (!map.title || !map.url) {
    return null;
  }

  return {
    title: map.title,
    url: map.url,
    description: map.description,
    image: map.image,
  };
}

export function parseLinkCards(markdownBody: string): LinkCard[] {
  const cards: LinkCard[] = [];
  let match: RegExpExecArray | null = null;
  CODE_BLOCK_REGEX.lastIndex = 0;

  while ((match = CODE_BLOCK_REGEX.exec(markdownBody)) !== null) {
    const parsed = parseBlock(match[1] ?? "");
    if (parsed) cards.push(parsed);
  }

  return cards;
}
