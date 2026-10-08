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
async function enableTiming(p) {
  await p.locator("#menuBtn").tap();
  await p.locator('.sheet [data-a="timing"]').check();
  await p.locator('.sheet [data-a="close"]').tap();
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
  // 3a. Start-time tracking is off by default: the button only crosses the match out, and the
  //     sheet has no delta controls. The menu switch turns it on.
  {
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    const r = row(p, open[0].number);
    check((await r.locator(".startbtn").innerText()).includes("Mark done"), "default button reads “Mark done”");
    await r.locator(".mid").tap();
    check(await p.locator('.sheet [data-a="dzero"]').count() === 0, "no delta controls in the match sheet by default");
    await p.locator('.sheet [data-a="close"]').tap();
    await r.locator(".startbtn").tap();
    check((await row(p, open[0].number).locator(".chip").innerText()).trim() === "Played", "Mark done crosses out without a delta");
    await enableTiming(p);
    check((await row(p, open[1].number).locator(".startbtn").innerText()).includes("Start"), "menu switch turns start-time tracking on");
    await ctx.close();
  }
  // 3b. Start delta: any second within the scheduled minute is on time.
  const m = open[0], sched = new Date(Date.parse(m.time));
  sched.setUTCSeconds(0, 0);
  for (const [offsetS, want] of [[0, "On time"], [59, "On time"], [60, "+1"], [-1, "−1"]]) {
    const { ctx, p } = await page(new Date(sched.getTime() + offsetS * 1000).toISOString());
    await enableTiming(p);
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
  // 6. Replays: flag from the match sheet, add by number, plan on the side fields with no team
  //    in two matches at once, and a break wherever a team has to play back-to-back.
  {
    const teamsOf = m => [...m.red, ...m.blue];
    const counts = {};
    D.matches.forEach(m => teamsOf(m).forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
    const X = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const xs = D.matches.filter(m => teamsOf(m).includes(X)).slice(0, 3);
    const rest = D.matches.filter(m => !teamsOf(m).includes(X));
    const extra = [3, 1, 5].map(f => rest.find(m => m.field === f));
    const want = [...xs, ...extra];
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    await row(p, xs[0].number).locator(".mid").tap();
    await p.locator('.sheet [data-a="rpon"]').tap();
    await p.locator('.sheet [data-a="close"]').tap();
    check(await row(p, xs[0].number).locator(".chip.rp").count() === 1, "match flagged from its sheet shows a replay chip");
    await p.locator("#rpBtn").tap();
    await p.fill("#rpNum", String(xs[1].number)); await p.press("#rpNum", "Enter");
    await p.fill("#rpNum", [xs[2], ...extra].map(m => m.number).join(", "));
    await p.locator('.rpl [data-a="add"]').tap();
    const readPlan = () => p.locator(".rmatch").evaluateAll(es => es.map(e => ({
      id: e.dataset.m, s: +e.dataset.slot, f: +e.dataset.f, t: [...e.querySelectorAll(".rteam")].map(t => t.dataset.t) })));
    const plan = await readPlan();
    check(plan.length === want.length && want.every(m => plan.some(q => q.id === m.id)), `all ${want.length} replays planned`);
    check(plan.every(q => [1, 2, 4, 5].includes(q.f)), "replays only on side fields (never F3)");
    const slots = [...new Set(plan.map(q => q.s))];
    check(slots.every(s => {
      const qs = plan.filter(q => q.s === s), ts = qs.flatMap(q => q.t);
      return new Set(ts).size === ts.length && new Set(qs.map(q => q.f <= 2)).size === qs.length;
    }), "no team in two matches at once, one match per pair per slot");
    const xSlots = plan.filter(q => q.t.includes(X)).map(q => q.s).sort((a, b) => a - b);
    let breaksOk = true;
    for (let i = 1; i < xSlots.length; i++)
      if (xSlots[i] - xSlots[i - 1] === 1 && !(await p.locator(`.rpl .brk[data-before="${xSlots[i]}"]`).count())) breaksOk = false;
    check(breaksOk, "a break is shown before every back-to-back replay");
    check(await p.locator(`.rteam.dup[data-t="${X}"] .go`).count() === 3 && await p.locator(`.rp-path[data-t="${X}"]`).count() === 1,
      "team with several replays gets where-to-go-next instructions");
    // Hand edit, then re-optimize.
    await p.locator('.rpl [data-a="edit"]').tap();
    const first = plan.find(q => q.s === 0);
    await p.locator(`.rmatch[data-m="${first.id}"] [data-a="down"]`).tap();
    check((await readPlan()).find(q => q.id === first.id).s === 1 && await p.locator(".rp-sum", { hasText: "Edited by hand" }).count() === 1, "hand edit moves a replay");
    await p.locator('.rpl [data-a="opt"]').tap();
    const again = await readPlan();
    check(JSON.stringify(again) === JSON.stringify(plan), "re-optimize restores the same plan");
    // Mark one played; everything persists across a reload.
    await p.locator(`.rmatch[data-m="${first.id}"] [data-a="done"]`).tap();
    await p.reload(); await p.waitForSelector(".match");
    await p.locator('[data-unit="all"]').tap();
    check(await p.locator(".chip.rp", { hasText: "Replayed" }).count() === 1 && await p.locator(".chip.rp").count() === want.length, "replay flags and played state persist");
    await p.locator("#rpBtn").tap();
    check(JSON.stringify(await readPlan()) === JSON.stringify(plan), "replay plan persists across reload");
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
