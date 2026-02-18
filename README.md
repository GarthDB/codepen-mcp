# CodePen MCP

An [MCP](https://modelcontextprotocol.io) server that gives Cursor (and other MCP clients) tools to **ingest and inspect** CodePen pens: metadata, full source (HTML/CSS/JS), and embed snippet.

## What’s available

CodePen has **no public REST/GraphQL API** for reading pen data. This server uses:

- **oEmbed (official)** – `https://codepen.io/api/oembed?format=json&url=...` for title, author, thumbnail, and embed iframe. Stable and supported by CodePen.
- **Pen page parsing (best-effort)** – Fetches the public pen page and extracts the embedded `__item` JSON to get full source (HTML, CSS, JS), tags, resources, and preprocessors. This can break if CodePen changes their front-end.

## Tools

| Tool | Description |
|------|-------------|
| `get_pen_metadata` | Fetch metadata via oEmbed: title, author, thumbnail, embed HTML. No source code. |
| `get_pen` | Fetch full pen (source + metadata) by parsing the pen page. Use for ingest/inspect/understand. |
| `get_pen_embed_html` | Get the iframe embed HTML via oEmbed, with optional height. |

## Setup

### Install and build

```bash
npm install
npm run build
```

### Run the server (stdio)

The server uses stdio transport so Cursor can spawn it as a subprocess:

```bash
node dist/index.js
```

### Configure Cursor

Add the CodePen MCP server in Cursor (e.g. **Settings → MCP** or your MCP config file). Example:

```json
{
  "mcpServers": {
    "codepen": {
      "command": "node",
      "args": ["/absolute/path/to/codepen-mcp/dist/index.js"]
    }
  }
}
```

Use the path to your cloned repo (e.g. `/Users/you/Projects/codepen-mcp/dist/index.js`).

## Optional: Agent Skill

The repo includes a Cursor Agent Skill at [.cursor/skills/codepen-ingest/](.cursor/skills/codepen-ingest/) that tells the agent when and how to use the CodePen tools (e.g. when the user pastes a pen URL). It’s scoped to this project; you can copy it to `~/.cursor/skills/` for use in all projects.

## Example pen

Example used for design and testing: [Responsive Sidenotes V2](https://codepen.io/johndjameson/pen/DwxMqa) (`johndjameson/pen/DwxMqa`).

## Limitations

- **Full source** depends on parsing the public pen page; no official API. If CodePen changes their HTML/JS, `get_pen` may need updates.
- **oEmbed and pen page** may return 403 or be rate-limited in some environments (e.g. strict Cloudflare or automated networks). In normal browser-like or Cursor usage they usually work.

## License

MIT
