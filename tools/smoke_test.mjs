// End-to-end smoke test for the queue sheet. Serves the repo on a local port and drives
// it in headless Chromium. Expectations are derived from data.js, so it keeps working
// after a data refresh.
// Usage (from the repo root): node tools/smoke_test.mjs   (needs `playwright` + Chromium)
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
}).listen(0);
const URL_ = `http://localhost:${server.address().port}/`;

// Load data.js the same way the page does.
const sandbox = { self: {} };
vm.runInNewContext(readFileSync(join(root, "data.js"), "utf8"), sandbox);
const D = sandbox.self.FGC_DATA;
const played = D.matches.filter(m => m.played).length;
const open = D.matches.filter(m => !m.played).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };

const browser = await chromium.launch();
const errors = [];
async function page(isoNow, { frozen = true, viewport = { width: 400, height: 860 } } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
  if (isoNow) await ctx.addInitScript(([t, frozen]) => {
    const T = Date.parse(t), real = Date.now.bind(Date), off = T - real();
    Date.now = frozen ? () => T : () => real() + off;
  }, [isoNow, frozen]);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  await p.goto(URL_);
  await p.waitForSelector(".match");
  return { ctx, p };
}
const row = (p, n) => p.locator(".match", { has: p.locator(".mnum", { hasText: new RegExp(`^${n}$`) }) });

try {
  // 1. Everything renders; site-played matches show as played; breaks are marked.
  {
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    check(await p.locator(".match").count() === D.matches.length, `All view shows all ${D.matches.length} matches`);
    check(await p.locator(".match.st-done").count() === played, `${played} matches imported as played`);
    check(await p.locator(".brk.lunch").count() >= 1, "lunch break marker present");
    check(await p.locator(".team img.flag").count() > 0, "flags render");
    await ctx.close();
  }
  // 2. Team marks cycle and persist across a reload.
  {
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    const r = row(p, open[0].number);
    await r.locator(".team").first().tap();
    await r.locator(".team").nth(1).tap(); await r.locator(".team").nth(1).tap();
    await p.reload(); await p.waitForSelector(".match");
    const cls = await row(p, open[0].number).locator(".team").evaluateAll(es => es.slice(0, 2).map(e => e.className));
    check(cls[0].includes("m-full") && cls[1].includes("m-rep"), "team marks persist across reload");
    await ctx.close();
  }
  // 3. Start delta: any second within the scheduled minute is on time.
  const m = open[0], sched = new Date(Date.parse(m.time));
  sched.setUTCSeconds(0, 0);
  for (const [offsetS, want] of [[0, "On time"], [59, "On time"], [60, "+1"], [-1, "−1"]]) {
    const { ctx, p } = await page(new Date(sched.getTime() + offsetS * 1000).toISOString());
    await p.locator('[data-unit="all"]').tap();
    await row(p, m.number).locator(".startbtn").tap();
    const chip = (await row(p, m.number).locator(".chip").innerText()).replace(/\s+/g, " ");
    check(chip.endsWith(want), `Start at ${offsetS >= 0 ? "+" : ""}${offsetS}s → "${want}" (got "${chip}")`);
    await ctx.close();
  }
  // 4. Catching up marks earlier matches played, and Undo restores them.
  {
    const target = open[Math.min(10, open.length - 1)];
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    await row(p, target.number).locator(".mid").tap();
    await p.locator('[data-a="bulk"]').first().tap();
    const before = open.filter(o => Date.parse(o.time) < Date.parse(target.time)).length;
    check(await p.locator(".match.st-done").count() >= played + before, "catch-up marks earlier matches played");
    await p.locator(".toast button", { hasText: "Undo" }).tap();
    check(await p.locator(".match.st-done").count() === played, "Undo restores the previous state");
    await ctx.close();
  }
  // 5. Works offline after the first visit (service worker cache).
  {
    const { ctx, p } = await page(null);
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.waitForTimeout(1500);
    await ctx.setOffline(true);
    await p.reload(); await p.waitForSelector(".match");
    await p.locator('[data-unit="all"]').tap();
    const broken = await p.evaluate(() => [...document.querySelectorAll("img.flag")].filter(i => i.complete && !i.naturalWidth).length);
    check(await p.locator(".match").count() === D.matches.length && broken === 0, "loads offline with all flags");
    await ctx.close();
  }
  check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
