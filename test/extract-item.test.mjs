/**
 * Unit test for __item extraction using a minimal HTML fixture.
 * Run: node test/extract-item.test.mjs
 */

// Minimal fixture: HTML containing __item (same escaping as real pen page)
// In the string we need: "__item":"{\"key\":\"value\"}" so backslash-quote for inner JSON
const fixture = 'x"__item":"{\\"title\\":\\"Responsive Sidenotes V2\\",\\"tags\\":[\\"layout\\",\\"text\\"],\\"hashid\\":\\"DwxMqa\\",\\"html\\":\\"<p>Hi</p>\\",\\"css\\":\\"body{}\\",\\"js\\":\\"console.log(1)\\"}"}y';

function unescapeJsonString(s) {
  return s
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function extractItemJson(html) {
  const match = html.match(/"__item"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (match) return unescapeJsonString(match[1]);
  throw new Error("Could not find __item");
}

const extracted = extractItemJson(fixture);
const parsed = JSON.parse(extracted);

if (parsed.title !== "Responsive Sidenotes V2" || !Array.isArray(parsed.tags) || parsed.hashid !== "DwxMqa") {
  console.error("FAIL: parsed", parsed);
  process.exit(1);
}
console.log("OK: __item extraction and parse");
console.log("  title:", parsed.title, "tags:", parsed.tags, "hashid:", parsed.hashid);
