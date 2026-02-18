import * as z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchPenMetadata, fetchPen, normalizePenUrl } from "./pen-utils.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "codepen-mcp",
    version: "1.0.0",
    description: "Ingest and inspect CodePen pens via oEmbed and pen page parsing",
  });

  server.registerTool(
    "get_pen_metadata",
    {
      title: "Get Pen Metadata",
      description:
        "Fetch CodePen pen metadata from the official oEmbed API. Returns title, author, thumbnail, and embed iframe HTML. Does not include source code. Use when you only need metadata or embed snippet.",
      inputSchema: {
        pen_url: z
          .string()
          .describe(
            "Full CodePen URL (e.g. https://codepen.io/johndjameson/pen/DwxMqa) or slug (e.g. johndjameson/pen/DwxMqa)"
          ),
      },
    },
    async ({ pen_url }): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> => {
      try {
        const url = normalizePenUrl(pen_url);
        const data = await fetchPenMetadata(url);
        const out: Record<string, unknown> = {
          pen_url: url,
          title: data.title,
          author_name: data.author_name,
          author_url: data.author_url,
          thumbnail_url: data.thumbnail_url,
          height: data.height,
          width: data.width,
          embed_html: data.html,
        };
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "get_pen",
    {
      title: "Get Pen (Full Source)",
      description:
        "Fetch a CodePen pen's full source (HTML, CSS, JS), metadata, tags, external resources, and preprocessors by parsing the public pen page. Use when you need to ingest, inspect, or understand the code. Note: This parses the pen page and may break if CodePen changes their front-end.",
      inputSchema: {
        pen_url: z
          .string()
          .describe(
            "Full CodePen URL (e.g. https://codepen.io/johndjameson/pen/DwxMqa) or slug (e.g. johndjameson/pen/DwxMqa)"
          ),
      },
    },
    async ({ pen_url }): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> => {
      try {
        const pen = await fetchPen(pen_url);
        return { content: [{ type: "text", text: JSON.stringify(pen, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "get_pen_embed_html",
    {
      title: "Get Pen Embed HTML",
      description:
        "Get the iframe embed HTML for a CodePen pen via oEmbed. Optionally specify height. Use when the user wants embed code to paste into a blog or page.",
      inputSchema: {
        pen_url: z
          .string()
          .describe("Full CodePen URL or slug (e.g. johndjameson/pen/DwxMqa)"),
        height: z
          .number()
          .optional()
          .describe("Optional iframe height in pixels (default from oEmbed)"),
      },
    },
    async ({ pen_url, height }): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> => {
      try {
        const url = normalizePenUrl(pen_url);
        const data = await fetchPenMetadata(url, height != null ? { height } : undefined);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ pen_url: url, title: data.title, embed_html: data.html }, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  return server;
}
