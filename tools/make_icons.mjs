// Render icon.svg to apple-touch-icon.png (180×180) for the iOS home screen, which ignores SVG icons.
// iOS rounds the corners itself and shows transparency as black, so the background is drawn full-bleed.
// Usage: node tools/make_icons.mjs   (needs the `playwright` package and a Chromium)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "icon.svg"), "utf8").replace(/(<rect width="64" height="64") rx="\d+"/, "$1");
const S = 180;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: S, height: S } });
await page.setContent(`<html><body style="margin:0;background:#1b2330">${svg.replace("<svg ", `<svg width="${S}" height="${S}" style="display:block" `)}</body></html>`);
await page.screenshot({ path: join(root, "apple-touch-icon.png"), clip: { x: 0, y: 0, width: S, height: S } });
await browser.close();
console.log("done");
