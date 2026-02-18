/**
 * Normalize a CodePen URL or slug to a full pen URL.
 * Accepts: full URL, or "username/pen/slug" or "username/pen/slug/"
 */
export function normalizePenUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("https://codepen.io/")) {
    try {
      const u = new URL(trimmed);
      const path = u.pathname.replace(/\/$/, "");
      const match = path.match(/^\/([^/]+)\/pen\/([^/]+)/);
      if (match) return `https://codepen.io/${match[1]}/pen/${match[2]}`;
    } catch {
      // fall through
    }
  }
  if (trimmed.includes("/pen/")) {
    const withoutLeadingSlash = trimmed.replace(/^\//, "");
    if (/^[^/]+\/pen\/[^/]+/.test(withoutLeadingSlash)) {
      return `https://codepen.io/${withoutLeadingSlash.replace(/\/$/, "")}`;
    }
  }
  throw new Error(`Invalid CodePen URL or slug: ${input}. Expected format: https://codepen.io/username/pen/slug or username/pen/slug`);
}

const OEMBED_BASE = "https://codepen.io/api/oembed";

export interface OEmbedResult {
  success: boolean;
  type: string;
  version: string;
  provider_name: string;
  provider_url: string;
  title: string;
  author_name: string;
  author_url: string;
  height: string;
  width: string;
  thumbnail_url?: string;
  thumbnail_width?: string;
  thumbnail_height?: string;
  html: string;
}

/**
 * Fetch pen metadata from CodePen oEmbed API (official, stable).
 */
export async function fetchPenMetadata(
  penUrl: string,
  options?: { height?: number }
): Promise<OEmbedResult> {
  const url = new URL(OEMBED_BASE);
  url.searchParams.set("format", "json");
  url.searchParams.set("url", penUrl);
  if (options?.height != null) {
    url.searchParams.set("height", String(options.height));
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`oEmbed request failed (${res.status}): ${text || res.statusText}`);
  }
  const data = (await res.json()) as OEmbedResult;
  if (!data.success) {
    throw new Error("CodePen oEmbed returned success: false");
  }
  return data;
}

/** Normalized pen data extracted from the pen page (best-effort scraping). */
export interface NormalizedPen {
  title: string;
  description: string;
  html: string;
  css: string;
  js: string;
  tags: string[];
  resources: Array<{ url: string; type: string; order: number }>;
  html_pre_processor: string;
  css_pre_processor: string;
  js_pre_processor: string;
  author?: { username: string; name: string; url: string };
  pen_url: string;
  hashid: string;
}

/**
 * Unescape a JSON string value (content only, no surrounding quotes).
 * Handles \\, \", \n, \r, \t per JSON spec. Order matters: \\ first.
 */
function unescapeJsonString(s: string): string {
  return s
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

/**
 * Extract the __item JSON string from the pen page HTML.
 * The page embeds a script with a global object containing "__item":"{\"key\":...}".
 */
function extractItemJson(html: string): string {
  // Match "__item":"..." where the value is a JSON string (escaped quotes and backslashes inside).
  const match = html.match(/"__item"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (match) {
    return unescapeJsonString(match[1]);
  }
  throw new Error("Could not find __item in pen page. CodePen may have changed their page structure.");
}

interface CodePenItem {
  title?: string;
  description?: string;
  html?: string;
  css?: string;
  js?: string;
  tags?: string[];
  resources?: Array<{ url?: string; resource_type?: string; order?: number }>;
  html_pre_processor?: string;
  css_pre_processor?: string;
  js_pre_processor?: string;
  hashid?: string;
}

/**
 * Fetch the pen page and extract full source from embedded __item (best-effort).
 * May break if CodePen changes their front-end.
 */
export async function fetchPen(penUrl: string): Promise<NormalizedPen> {
  const url = normalizePenUrl(penUrl);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "CodePen-MCP/1.0 (ingest tool)",
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch pen page (${res.status}): ${res.statusText}`);
  }
  const html = await res.text();
  const itemJson = extractItemJson(html);
  let item: CodePenItem;
  try {
    item = JSON.parse(itemJson) as CodePenItem;
  } catch (e) {
    throw new Error(`Failed to parse pen __item JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!item || typeof item !== "object") {
    throw new Error("Pen __item is not an object");
  }
  // Optional: extract __profiled for author (username, name). It may be in the same blob.
  let author: NormalizedPen["author"];
  const profiledMatch = html.match(/"__profiled"\s*:\s*(\{[^}]+\})/);
  if (profiledMatch) {
    try {
      const profiled = JSON.parse(profiledMatch[1]) as { username?: string; name?: string };
      if (profiled?.username) {
        author = {
          username: profiled.username,
          name: profiled.name ?? profiled.username,
          url: `https://codepen.io/${profiled.username}`,
        };
      }
    } catch {
      // ignore
    }
  }
  const slug = url.match(/\/([^/]+)\/pen\/([^/]+)/);
  const username = slug ? slug[1] : "";
  if (!author && username) {
    author = {
      username,
      name: username,
      url: `https://codepen.io/${username}`,
    };
  }
  return {
    title: item.title ?? "Untitled",
    description: item.description ?? "",
    html: item.html ?? "",
    css: item.css ?? "",
    js: item.js ?? "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    resources: (item.resources ?? []).map((r) => ({
      url: r.url ?? "",
      type: r.resource_type ?? "js",
      order: typeof r.order === "number" ? r.order : 0,
    })),
    html_pre_processor: item.html_pre_processor ?? "none",
    css_pre_processor: item.css_pre_processor ?? "none",
    js_pre_processor: item.js_pre_processor ?? "none",
    author,
    pen_url: url,
    hashid: item.hashid ?? "",
  };
}
