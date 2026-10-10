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
  const album = audioData.album
    ? `<p class="gintmr_ui-track__album" title="${escapeHtmlAttr(audioData.album)}">${escapeHtml(audioData.album)}</p>`
    : "";

  // 外观与播放行为都由组件库提供：一条描边、一层表面色、自绘播放条。
  const cardAttrs = ["class=\"gintmr_ui-track\"", "data-gintmr_ui-track"];
  if (lyricSrc) {
    cardAttrs.push(`data-gintmr_ui-lrc="${escapeHtmlAttr(lyricSrc)}"`);
  }

  const coverHtml = coverSrc
    ? `<div class="gintmr_ui-track__cover"><img src="${escapeHtmlAttr(coverSrc)}" alt="${escapeHtmlAttr(audioData.title)} cover" loading="lazy" /></div>`
    : `<div class="gintmr_ui-track__cover gintmr_ui-track__cover--empty" aria-hidden="true">♫</div>`;

  const lyricsHtml = lyricSrc
    ? `<div class="gintmr_ui-track__lyrics" data-gintmr_ui-lyrics></div>`
    : "";

  return `<figure ${cardAttrs.join(" ")}>
    <div class="gintmr_ui-track__row">
      ${coverHtml}
      <div class="gintmr_ui-track__meta">
        <p class="gintmr_ui-track__title" title="${escapeHtmlAttr(audioData.title)}">${title}</p>
        <p class="gintmr_ui-track__artist" title="${escapeHtmlAttr(audioData.artist || "Unknown Artist")}">${artist}</p>
        ${album}
      </div>
      <button class="gintmr_ui-track__play" type="button" data-gintmr_ui-play aria-label="播放 ${escapeHtmlAttr(audioData.title)}"></button>
      <span class="gintmr_ui-track__time"><span data-gintmr_ui-time="current">0:00</span><span aria-hidden="true"> / </span><span data-gintmr_ui-time="total">--:--</span></span>
    </div>
    <div class="gintmr_ui-progress" data-gintmr_ui-progress role="slider" tabindex="0" aria-label="播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <span class="gintmr_ui-progress__fill"></span>
      <span class="gintmr_ui-progress__thumb"></span>
    </div>
    ${lyricsHtml}
    <audio data-gintmr_ui-source src="${escapeHtmlAttr(audioSrc)}" preload="metadata" aria-label="${escapeHtmlAttr(audioData.title)}"></audio>
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
