---
name: codepen-ingest
description: Use CodePen MCP tools to fetch, inspect, and summarize CodePen pens when the user shares a pen URL or asks about a pen.
---

# CodePen Ingest

## When to use

- User shares a CodePen URL (e.g. `https://codepen.io/username/pen/XXXXX`) or a slug like `username/pen/XXXXX`
- User asks to "look at this pen," "explain this pen," "get the code from this pen," or "what does this pen do?"

## How to use

1. **Prefer `get_pen`** when the user needs:
   - Source code (HTML, CSS, JS)
   - An explanation of what the pen does
   - Tags, external resources, or preprocessors

2. **Use `get_pen_metadata`** when the user only needs:
   - Title, author, thumbnail
   - Embed iframe snippet (e.g. for pasting into a blog)

3. **Use `get_pen_embed_html`** when the user explicitly wants the embed code (iframe HTML), optionally with a custom height.

## After fetching

When you have pen data (from `get_pen` or `get_pen_metadata`):

- **Summarize** what the pen does: HTML structure, CSS approach (e.g. layout, preprocessor), JS behavior
- **List** tags and external resources (e.g. libraries from cdnjs)
- If the user asked for code, present the relevant parts (HTML/CSS/JS) in a clear, readable way

## Note

- Full source comes from parsing the public pen page; it may break if CodePen changes their front-end
- Metadata and embed HTML use the official oEmbed API and are stable
