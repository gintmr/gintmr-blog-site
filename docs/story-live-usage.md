# Story + Live Photo Usage

This project now supports:

1. `blog` / `diary` live photo autoplay loop.
2. `story` (swipe-first image-text mode).
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

## 2) Story Content (folder style, recommended)

Create folders in content repo:

`story/dubai-trip/content.md`
`story/dubai-trip/imgs/*`

```md
---
title: Dubai Weekend
description: Swipe-up visual story demo
pubDatetime: 2026-03-10T21:00:00+08:00
draft: false
tags:
  - Story
bgm: attachment/inbox/Music/火星人来过-薛之谦.mp3
# 可选：指定封面（支持 imgs/xxx 相对路径）
cover: imgs/IMG_0001.HEIC
---

正文写在这里。播放器会自动读取当前目录下 `imgs/` 中的媒体文件，
并按文件名顺序展示（例如 IMG_4169 在 IMG_4171 之前）。
```

Then access:

- list: `/story`
- detail: `/story/dubai-trip`

## 3) File Path Rules

Prefer vault-root relative paths:

- `attachment/inbox/xxx.jpg`
- `attachment/inbox/xxx.mov`
- `attachment/inbox/Music/xxx.mp3`

System resolves to site assets automatically.
