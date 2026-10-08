// Render the official FIRST Global flag SVGs (tools/.flag-cache/*.svg) to PNGs 180px tall in flags/,
// keeping each SVG's own aspect ratio on the white background the results site uses.
// Uses Chromium via Playwright so the result matches what the results site shows in Chrome.
// Usage: node tools/rasterize_flags.mjs   (needs the `playwright` package and a Chromium)
import { chromium } from "playwright";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "tools", ".flag-cache"), out = join(root, "flags");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const H = 180;
const page = await browser.newPage({ viewport: { width: 600, height: H } });
for (const f of readdirSync(src).filter(f => f.endsWith(".svg"))) {
  const svg = readFileSync(join(src, f), "utf8");
  const url = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  await page.setContent(`<html><body style="margin:0;background:#fff"><img src="${url}" style="display:block;height:${H}px"></body></html>`);
  await page.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
  const w = await page.evaluate(() => Math.round(document.images[0].getBoundingClientRect().width));
  await page.screenshot({ path: join(out, f.replace(/\.svg$/, ".png")), clip: { x: 0, y: 0, width: w, height: H } });
}
await browser.close();
console.log("done");
