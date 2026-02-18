import test from "ava";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

// ---------------------------------------------------------------------------
// Fixtures and mock helpers
// ---------------------------------------------------------------------------

function makePenPageHtml(item: object, profiled?: object): string {
  const itemStr = JSON.stringify(JSON.stringify(item));
  const profiledStr = profiled
    ? `,"__profiled":${JSON.stringify(profiled)}`
    : "";
  return `<script>var d = {"__item":${itemStr}${profiledStr}};</script>`;
}

const MOCK_PEN_ITEM = {
  title: "Responsive Sidenotes V2",
  description: "A responsive sidenotes demo.",
  html: "<article><p>Hello</p></article>",
  css: "body { color: red; }",
  js: "console.log('hi');",
  tags: ["layout", "text", "responsive", "rwd", "simple"],
  resources: [
    { url: "//cdnjs.cloudflare.com/ajax/libs/jquery/2.1.3/jquery.min.js", resource_type: "js", order: 0 },
  ],
  html_pre_processor: "none",
  css_pre_processor: "scss",
  js_pre_processor: "none",
  hashid: "DwxMqa",
};

const MOCK_OEMBED = {
  success: true,
  type: "rich",
  version: "1.0",
  provider_name: "CodePen",
  provider_url: "https://codepen.io",
  title: "Responsive Sidenotes V2",
  author_name: "John D. Jameson",
  author_url: "https://codepen.io/johndjameson",
  height: "300",
  width: "600",
  thumbnail_url: "https://example.com/thumb.png",
  html: "<iframe src='https://codepen.io/johndjameson/embed/DwxMqa'></iframe>",
};

function makeMockFetch(): typeof globalThis.fetch {
  const penPageHtml = makePenPageHtml(MOCK_PEN_ITEM, {
    username: "johndjameson",
    name: "John D. Jameson",
  });
  return async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("api/oembed")) {
      return { ok: true, status: 200, statusText: "OK", text: async () => JSON.stringify(MOCK_OEMBED), json: async () => MOCK_OEMBED } as Response;
    }
    if (url.includes("codepen.io/johndjameson/pen/DwxMqa")) {
      return { ok: true, status: 200, statusText: "OK", text: async () => penPageHtml, json: async () => ({}) } as Response;
    }
    throw new Error(`No mock for URL: ${url}`);
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let _savedFetch: typeof globalThis.fetch;
test.beforeEach(() => {
  _savedFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch();
});
test.afterEach.always(() => {
  globalThis.fetch = _savedFetch;
});

/** Create a connected client+server pair for a single test. */
async function makeClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

// ---------------------------------------------------------------------------
// Tool discovery
// ---------------------------------------------------------------------------

test.serial("each tool has a non-empty description", async (t) => {
  const { client } = await makeClient();
  const { tools } = await client.listTools();
  for (const tool of tools) {
    t.truthy(tool.description, `${tool.name} should have a description`);
  }
});

// ---------------------------------------------------------------------------
// get_pen_metadata
// ---------------------------------------------------------------------------

test.serial("get_pen_metadata: returns title and author from oEmbed", async (t) => {
  const { client } = await makeClient();
  const result = await client.callTool({
    name: "get_pen_metadata",
    arguments: { pen_url: "https://codepen.io/johndjameson/pen/DwxMqa" },
  });

  t.falsy(result.isError);
  t.is(result.content.length, 1);
  const content = result.content[0];
  t.is(content.type, "text");
  const parsed = JSON.parse((content as { type: "text"; text: string }).text);
  t.is(parsed.title, "Responsive Sidenotes V2");
  t.is(parsed.author_name, "John D. Jameson");
  t.truthy(parsed.embed_html);
});

test.serial("get_pen_metadata: accepts slug format", async (t) => {
  const { client } = await makeClient();
  const result = await client.callTool({
    name: "get_pen_metadata",
    arguments: { pen_url: "johndjameson/pen/DwxMqa" },
  });
  t.falsy(result.isError);
  const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
  t.is(parsed.pen_url, "https://codepen.io/johndjameson/pen/DwxMqa");
});

test.serial("get_pen_metadata: invalid URL returns isError", async (t) => {
  const { client } = await makeClient();
  const result = await client.callTool({
    name: "get_pen_metadata",
    arguments: { pen_url: "not-a-valid-url" },
  });
  t.true(result.isError);
  const text = (result.content[0] as { type: "text"; text: string }).text;
  t.true(text.startsWith("Error:"));
});

// ---------------------------------------------------------------------------
// get_pen
// ---------------------------------------------------------------------------

test.serial("get_pen: returns full pen source", async (t) => {
  const { client } = await makeClient();
  const result = await client.callTool({
    name: "get_pen",
    arguments: { pen_url: "https://codepen.io/johndjameson/pen/DwxMqa" },
  });

  t.falsy(result.isError);
  const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
  t.is(parsed.title, "Responsive Sidenotes V2");
  t.is(parsed.css_pre_processor, "scss");
  t.deepEqual(parsed.tags, ["layout", "text", "responsive", "rwd", "simple"]);
  t.is(parsed.resources.length, 1);
  t.truthy(parsed.html);
  t.truthy(parsed.css);
  t.truthy(parsed.js);
});

test.serial("get_pen: includes author information", async (t) => {
  const { client } = await makeClient();
  const result = await client.callTool({
    name: "get_pen",
    arguments: { pen_url: "https://codepen.io/johndjameson/pen/DwxMqa" },
  });

  t.falsy(result.isError);
  const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
  t.is(parsed.author.username, "johndjameson");
  t.is(parsed.author.name, "John D. Jameson");
});

test.serial("get_pen: fetch error returns isError", async (t) => {
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes("codepen.io/johndjameson/pen/DwxMqa")) {
      return { ok: false, status: 404, statusText: "Not Found", text: async () => "", json: async () => ({}) } as Response;
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const { client } = await makeClient();
  const result = await client.callTool({
    name: "get_pen",
    arguments: { pen_url: "https://codepen.io/johndjameson/pen/DwxMqa" },
  });
  t.true(result.isError);
  const text = (result.content[0] as { type: "text"; text: string }).text;
  t.true(text.includes("404"));
});

// ---------------------------------------------------------------------------
// get_pen_embed_html
// ---------------------------------------------------------------------------

test.serial("get_pen_embed_html: returns embed iframe HTML", async (t) => {
  const { client } = await makeClient();
  const result = await client.callTool({
    name: "get_pen_embed_html",
    arguments: { pen_url: "https://codepen.io/johndjameson/pen/DwxMqa" },
  });

  t.falsy(result.isError);
  const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
  t.is(parsed.title, "Responsive Sidenotes V2");
  t.truthy(parsed.embed_html);
  t.true(parsed.embed_html.includes("<iframe"));
});

test.serial("get_pen_embed_html: height option is forwarded", async (t) => {
  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = input.toString();
    return originalFetch(input, init);
  };

  const { client } = await makeClient();
  await client.callTool({
    name: "get_pen_embed_html",
    arguments: { pen_url: "https://codepen.io/johndjameson/pen/DwxMqa", height: 750 },
  });

  t.true(capturedUrl.includes("height=750"));
});
