import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Code, Html } from "mdast";
import type { Node } from "unist";
import { getAudioPath, getCoverPath, getLyricPath } from "./audioUtils";

interface Parent extends Node {
  children: Node[];
}

interface AudioCardData {
  title: string;
  artist?: string;
  album?: string;
  audio: string;
  cover?: string;
  lrc?: string;
}

interface RemarkAudioCardOptions {
  enableDebug?: boolean;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function readField(
  data: Record<string, string>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (value) return value;
  }
  return undefined;
}

function parseAudioCardContent(content: string): AudioCardData | null {
  const rows = content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith("#"));

  const data: Record<string, string> = {};

  for (const row of rows) {
    const separatorIndex = row.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = row.slice(0, separatorIndex).trim().toLowerCase();
    const value = stripQuotes(row.slice(separatorIndex + 1).trim());

    if (!key || !value) continue;
    data[key] = value;
  }

  const audio = readField(data, ["audio", "src", "file", "song"]);
  if (!audio) return null;

  const decodedAudio = decodeURIComponentSafe(audio);
  const fallbackTitle =
    decodedAudio.split("/").pop()?.replace(/\.[^.]+$/, "").trim() || "Untitled Track";

  return {
    title: readField(data, ["title", "name", "song_name"]) || fallbackTitle,
    artist: readField(data, ["artist", "singer", "author"]),
    album: readField(data, ["album"]),
    audio,
    cover: readField(data, ["cover", "image", "poster"]),
    lrc: readField(data, ["lrc", "lyric", "lyrics"]),
  };
}

function buildAudioCardHtml(audioData: AudioCardData): string {
  const audioSrc = getAudioPath(audioData.audio);
  const coverSrc = audioData.cover ? getCoverPath(audioData.cover) : "";
  const lyricSrc = audioData.lrc ? getLyricPath(audioData.lrc) : "";

  const title = escapeHtml(audioData.title);
  const artist = escapeHtml(audioData.artist || "Unknown Artist");
  const album = audioData.album ? escapeHtml(audioData.album) : "";

  const cardAttrs = [
    `class="audio-card rehype-figure"`,
    `data-audio-card="true"`,
    `data-audio-title="${escapeHtmlAttr(audioData.title)}"`,
    `data-audio-artist="${escapeHtmlAttr(audioData.artist || "Unknown Artist")}"`,
  ];

  if (lyricSrc) {
    cardAttrs.push(`data-lrc-src="${escapeHtmlAttr(lyricSrc)}"`);
  }

  const backdropStyle = coverSrc
    ? ` style="--audio-cover-url: url('${escapeHtmlAttr(coverSrc)}');"`
    : "";

  const coverHtml = coverSrc
    ? `<div class="audio-card__cover-wrap"><img src="${escapeHtmlAttr(coverSrc)}" alt="${escapeHtmlAttr(audioData.title)} cover" loading="lazy" class="audio-card__cover" /></div>`
    : `<div class="audio-card__cover-wrap audio-card__cover-wrap--empty" aria-hidden="true"><span class="audio-card__cover-fallback">♫</span></div>`;

  const albumHtml = album
    ? `<p class="audio-card__album" title="${escapeHtmlAttr(audioData.album || "")}">${album}</p>`
    : "";

  const lyricsHtml = lyricSrc
    ? `<div class="audio-card__lyrics" data-audio-lyrics hidden><p class="audio-card__lyrics-empty">歌词加载中...</p></div>`
    : "";

  return `<figure ${cardAttrs.join(" ")}>
    <div class="audio-card__surface">
      <div class="audio-card__backdrop"${backdropStyle}></div>
      <div class="audio-card__scrim" aria-hidden="true"></div>
      <div class="audio-card__body">
        <div class="audio-card__main">
          <div class="audio-card__cover-stage">
            ${coverHtml}
          </div>
          <div class="audio-card__top">
            <header class="audio-card__head">
              <p class="audio-card__title" title="${escapeHtmlAttr(audioData.title)}">${title}</p>
              <p class="audio-card__artist" title="${escapeHtmlAttr(audioData.artist || "Unknown Artist")}">${artist}</p>
              ${albumHtml}
            </header>
            ${lyricsHtml}
          </div>
        </div>
        <div class="audio-card__controls">
          <audio data-audio-source class="audio-card__player" controls preload="metadata" src="${escapeHtmlAttr(audioSrc)}" aria-label="${escapeHtmlAttr(audioData.title)}"></audio>
        </div>
      </div>
    </div>
  </figure>`;
}

export const remarkAudioCard: Plugin<[RemarkAudioCardOptions?], Root> = (
  options = {}
) => {
  const { enableDebug = false } = options;

  return tree => {
    const nodesToReplace: Array<{
      index: number;
      parent: Parent;
      html: string;
    }> = [];

    visit(tree, "code", (node: Code, index?: number, parent?: Parent) => {
      if (!parent || index === undefined || !parent.children) {
        return;
      }

      if (!/^card-(audio|song|mp3)$/i.test(node.lang || "")) {
        return;
      }

      const parsed = parseAudioCardContent(node.value || "");
      if (!parsed) {
        if (enableDebug) {
          console.warn("[remark-audio-card] invalid audio card:", node.value);
        }
        return;
      }

      nodesToReplace.push({
        index,
        parent,
        html: buildAudioCardHtml(parsed),
      });
    });

    for (let i = nodesToReplace.length - 1; i >= 0; i--) {
      const target = nodesToReplace[i];
      const htmlNode: Html = {
        type: "html",
        value: target.html,
      };
      target.parent.children.splice(target.index, 1, htmlNode as unknown as Node);
    }
  };
};

export default remarkAudioCard;
