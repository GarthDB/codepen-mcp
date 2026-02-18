# codepen-mcp

## 1.0.0

### Major Changes

- d169994: Initial release of the CodePen MCP server.

  Provides three tools for ingesting and inspecting CodePen pens in Cursor (and other MCP clients):

  - `get_pen_metadata` — fetch title, author, thumbnail, and embed iframe via the official oEmbed API
  - `get_pen` — fetch full pen source (HTML, CSS, JS), tags, external resources, and preprocessors by parsing the public pen page
  - `get_pen_embed_html` — get the iframe embed snippet via oEmbed, with optional height

  Includes a Cursor Agent Skill that tells the agent when and how to use these tools when a user shares a CodePen URL.
