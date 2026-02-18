import test from "ava";
import { normalizePenUrl, fetchPenMetadata, fetchPen } from "../src/pen-utils.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal HTML page fixture with the CodePen __item payload. */
function makePenPageHtml(item: object, profiled?: object): string {
  // The page encodes __item as a JSON string inside a JSON object, so we need
  // to double-stringify: outer JSON encodes the inner JSON string as a quoted value.
  const itemStr = JSON.stringify(JSON.stringify(item));
  const profiledStr = profiled
    ? `,"__profiled":${JSON.stringify(profiled)}`
    : "";
  return `<script>var d = {"__item":${itemStr}${profiledStr}};</script>`;
}

type MockEntry = { ok: boolean; status?: number; body?: unknown; text?: string };

function makeMockFetch(map: Record<string, MockEntry>): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = input.toString();
    const key = Object.keys(map).find((k) => url.includes(k));
    if (!key) throw new Error(`No mock for URL: ${url}`);
    const entry = map[key];
    return {
      ok: entry.ok,
      status: entry.status ?? (entry.ok ? 200 : 500),
      statusText: entry.ok ? "OK" : "Error",
      text: async () => entry.text ?? JSON.stringify(entry.body ?? {}),
      json: async () => entry.body ?? {},
    } as Response;
  };
}

// Save / restore global.fetch around tests that need it.
let _savedFetch: typeof globalThis.fetch;
test.beforeEach(() => {
  _savedFetch = globalThis.fetch;
});
test.afterEach.always(() => {
  globalThis.fetch = _savedFetch;
});

// ---------------------------------------------------------------------------
// normalizePenUrl
// ---------------------------------------------------------------------------

test("normalizePenUrl: full URL is returned as-is", (t) => {
  t.is(
    normalizePenUrl("https://codepen.io/johndjameson/pen/DwxMqa"),
    "https://codepen.io/johndjameson/pen/DwxMqa"
  );
});

test("normalizePenUrl: trailing slash is stripped", (t) => {
  t.is(
    normalizePenUrl("https://codepen.io/johndjameson/pen/DwxMqa/"),
    "https://codepen.io/johndjameson/pen/DwxMqa"
  );
});

test("normalizePenUrl: slug format is expanded to full URL", (t) => {
  t.is(
    normalizePenUrl("johndjameson/pen/DwxMqa"),
    "https://codepen.io/johndjameson/pen/DwxMqa"
  );
});

test("normalizePenUrl: slug with leading slash is handled", (t) => {
  t.is(
    normalizePenUrl("/johndjameson/pen/DwxMqa"),
    "https://codepen.io/johndjameson/pen/DwxMqa"
  );
});

test("normalizePenUrl: invalid input throws", (t) => {
  t.throws(() => normalizePenUrl("not-a-pen-url"), {
    instanceOf: Error,
    message: /Invalid CodePen URL/,
  });
});

// ---------------------------------------------------------------------------
// fetchPenMetadata (oEmbed)
// ---------------------------------------------------------------------------

const OEMBED_MOCK_RESPONSE = {
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

test("fetchPenMetadata: returns structured oEmbed data", async (t) => {
  globalThis.fetch = makeMockFetch({ "codepen.io/api/oembed": { ok: true, body: OEMBED_MOCK_RESPONSE } });

  const result = await fetchPenMetadata("https://codepen.io/johndjameson/pen/DwxMqa");
  t.is(result.title, "Responsive Sidenotes V2");
  t.is(result.author_name, "John D. Jameson");
  t.truthy(result.html);
});

test("fetchPenMetadata: height option is forwarded in URL", async (t) => {
  let capturedUrl = "";
  globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
    capturedUrl = input.toString();
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify(OEMBED_MOCK_RESPONSE),
      json: async () => OEMBED_MOCK_RESPONSE,
    } as Response;
  };

  await fetchPenMetadata("https://codepen.io/johndjameson/pen/DwxMqa", { height: 500 });
  t.true(capturedUrl.includes("height=500"));
});

test("fetchPenMetadata: HTTP error throws descriptive error", async (t) => {
  globalThis.fetch = makeMockFetch({ "codepen.io/api/oembed": { ok: false, status: 403, text: "Forbidden" } });

  await t.throwsAsync(
    () => fetchPenMetadata("https://codepen.io/johndjameson/pen/DwxMqa"),
    { message: /oEmbed request failed \(403\)/ }
  );
});

test("fetchPenMetadata: success: false in body throws", async (t) => {
  globalThis.fetch = makeMockFetch({
    "codepen.io/api/oembed": { ok: true, body: { ...OEMBED_MOCK_RESPONSE, success: false } },
  });

  await t.throwsAsync(
    () => fetchPenMetadata("https://codepen.io/johndjameson/pen/DwxMqa"),
    { message: /success: false/ }
  );
});

// ---------------------------------------------------------------------------
// fetchPen (page scrape)
// ---------------------------------------------------------------------------

const MOCK_ITEM = {
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

const MOCK_PROFILED = {
  username: "johndjameson",
  name: "John D. Jameson",
  type: "user",
};

test("fetchPen: extracts full pen from page HTML", async (t) => {
  const html = makePenPageHtml(MOCK_ITEM, MOCK_PROFILED);
  globalThis.fetch = makeMockFetch({ "codepen.io/johndjameson/pen/DwxMqa": { ok: true, text: html } });

  const pen = await fetchPen("https://codepen.io/johndjameson/pen/DwxMqa");

  t.is(pen.title, "Responsive Sidenotes V2");
  t.is(pen.css_pre_processor, "scss");
  t.is(pen.hashid, "DwxMqa");
  t.deepEqual(pen.tags, ["layout", "text", "responsive", "rwd", "simple"]);
  t.is(pen.resources.length, 1);
  t.is(pen.resources[0].type, "js");
});

test("fetchPen: author is populated from __profiled", async (t) => {
  const html = makePenPageHtml(MOCK_ITEM, MOCK_PROFILED);
  globalThis.fetch = makeMockFetch({ "codepen.io/johndjameson/pen/DwxMqa": { ok: true, text: html } });

  const pen = await fetchPen("https://codepen.io/johndjameson/pen/DwxMqa");

  t.is(pen.author?.username, "johndjameson");
  t.is(pen.author?.name, "John D. Jameson");
  t.is(pen.author?.url, "https://codepen.io/johndjameson");
});

test("fetchPen: falls back to URL username when __profiled is absent", async (t) => {
  const html = makePenPageHtml(MOCK_ITEM);
  globalThis.fetch = makeMockFetch({ "codepen.io/johndjameson/pen/DwxMqa": { ok: true, text: html } });

  const pen = await fetchPen("https://codepen.io/johndjameson/pen/DwxMqa");

  t.is(pen.author?.username, "johndjameson");
});

test("fetchPen: HTTP error throws", async (t) => {
  globalThis.fetch = makeMockFetch({ "codepen.io/johndjameson/pen/DwxMqa": { ok: false, status: 404 } });

  await t.throwsAsync(
    () => fetchPen("https://codepen.io/johndjameson/pen/DwxMqa"),
    { message: /Failed to fetch pen page \(404\)/ }
  );
});

test("fetchPen: missing __item in page HTML throws descriptive error", async (t) => {
  globalThis.fetch = makeMockFetch({
    "codepen.io/johndjameson/pen/DwxMqa": { ok: true, text: "<html>no data here</html>" },
  });

  await t.throwsAsync(
    () => fetchPen("https://codepen.io/johndjameson/pen/DwxMqa"),
    { message: /Could not find __item/ }
  );
});

test("fetchPen: slug input is accepted", async (t) => {
  const html = makePenPageHtml(MOCK_ITEM, MOCK_PROFILED);
  globalThis.fetch = makeMockFetch({ "codepen.io/johndjameson/pen/DwxMqa": { ok: true, text: html } });

  const pen = await fetchPen("johndjameson/pen/DwxMqa");
  t.is(pen.pen_url, "https://codepen.io/johndjameson/pen/DwxMqa");
});
