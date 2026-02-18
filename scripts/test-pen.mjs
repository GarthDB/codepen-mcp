/**
 * Quick test: fetch metadata and full pen for johndjameson/pen/DwxMqa
 * Run from repo root: node scripts/test-pen.mjs
 */
import { fetchPenMetadata, fetchPen, normalizePenUrl } from "../dist/pen-utils.js";

const PEN = "https://codepen.io/johndjameson/pen/DwxMqa";

async function main() {
  console.log("1. Normalize URL:", normalizePenUrl(PEN));
  console.log("2. get_pen_metadata (oEmbed):");
  const meta = await fetchPenMetadata(PEN);
  console.log("   title:", meta.title);
  console.log("   author:", meta.author_name);
  console.log("3. get_pen (full source):");
  const pen = await fetchPen(PEN);
  console.log("   title:", pen.title);
  console.log("   tags:", pen.tags);
  console.log("   html length:", pen.html?.length ?? 0);
  console.log("   css length:", pen.css?.length ?? 0);
  console.log("   js length:", pen.js?.length ?? 0);
  console.log("   resources:", pen.resources?.length ?? 0);
  console.log("   css_pre_processor:", pen.css_pre_processor);
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
