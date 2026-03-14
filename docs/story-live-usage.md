# Story + Live Photo Usage

This project now supports:

1. `blog` / `diary` live photo autoplay loop.
2. `stories` (swipe-first image-text mode).
3. Live photo hover/click play in story mode.

## 1) Blog / Diary Live Photo

### Auto-loop live photo (recommended for iPhone Live export `.mov`)

```md
![[attachment/inbox/IMG_3818.mov|迪拜机场转机]]
```

Behavior:

- Autoplay + muted + loop.
- Keeps original aspect ratio.
- No manual hover/click required.

### Force as normal video (disable live mode)

```md
![[attachment/inbox/clip.mov|video|普通视频说明]]
```

Behavior:

- Renders with `controls`.
- No autoplay loop.

### Force live hover-play

```md
![[attachment/inbox/IMG_3818.mov|hover|把鼠标放上去才播放]]
```

Behavior:

- Hover/click to play.
- Leave/click again to stop and reset.

## 2) Story Content (new `story` collection)

Create file in content repo:

`story/dubai-trip.md`

```md
---
title: Dubai Weekend
description: Swipe-up visual story demo
pubDatetime: 2026-03-10T21:00:00+08:00
draft: false
tags:
  - Story
bgm: attachment/inbox/Music/火星人来过-薛之谦.mp3
slides:
  - media: attachment/inbox/IMG_0001.jpg
    text: "晚上抵达机场，先去吃点东西。"
    caption: "Day 1 · Arrival"

  - media: attachment/inbox/IMG_0002.mov
    live: true
    text: "这个是实况片段，支持 hover / click 播放。"
    caption: "Live Photo · Hover Play"

  - media: attachment/inbox/IMG_0003.jpg
    text: "最后一张收尾。"
    caption: "The End"
---

这段正文会显示在图文播放器下方（可选）。
```

Then access:

- list: `/stories`
- detail: `/stories/dubai-trip`

## 3) File Path Rules

Prefer vault-root relative paths:

- `attachment/inbox/xxx.jpg`
- `attachment/inbox/xxx.mov`
- `attachment/inbox/Music/xxx.mp3`

System resolves to site assets automatically.

