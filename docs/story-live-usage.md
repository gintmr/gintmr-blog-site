# Story Usage (Video Backup Mode)

Story now uses a simple 1:1 file pair format:

- `story/<same-name>.md`
- `story/<same-name>.mov` or `story/<same-name>.mp4`

Example:

- `story/老广的吃商我认可了.md`
- `story/老广的吃商我认可了.mov`

## 1) Markdown format

```md
---
title: 老广的吃商我认可了
description: 202603广州 backup
author: Gintmr
pubDatetime: 2026-03-13T00:00:00+08:00
draft: false
tags:
  - Story
---
淡淡的，顺顺的～
```

Notes:

- `title` optional, but recommended.
- `pubDatetime` controls ordering (newer first).
- Body supports normal markdown and is rendered in the right panel of detail page.

## 2) Rendering behavior

- `/story`:
  - Masonry-style video wall.
  - Each card shows video preview, date, title.
- `/story/<slug>`:
  - Left: main video stage.
  - Right: title/date/description/body in scrollable panel.
  - Click video to play and request fullscreen stage.

## 3) Filename matching rule

Story video is matched by stem:

- `story/abc.md` -> tries `story/abc.mov` / `story/abc.mp4` (and other supported video extensions).
- Chinese filenames are supported.

## 4) Recommended publishing constraints

- GitHub rejects a **single file > 100MB**.
- If your source video is too large:
  - convert/compress to smaller mp4, or
  - use Git LFS.
