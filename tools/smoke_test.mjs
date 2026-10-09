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
// A real touch long-press (touchstart, hold, touchend) through the DevTools protocol.
// Returns what was true while the finger was still down: whether text selection was blocked.
async function longPress(p, loc) {
  await loc.evaluate(e => e.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(150);
  const b = await loc.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await p.waitForTimeout(700);
  const held = await p.evaluate(() => {
    // Simulate what Android's long-press does next: select the text now under the finger.
    const ok = document.dispatchEvent(new Event("selectstart", { cancelable: true }));
    return { blocked: !ok, userSelect: getComputedStyle(document.querySelector("#overlayRoot *") || document.body).userSelect };
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(400);
  return held;
}
const row = (p, n) => p.locator("#list .match", { has: p.locator(".mnum", { hasText: new RegExp(`^${n}$`) }) });

try {
  // 1. Everything renders; site-played matches show as played; breaks are marked.
  {
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    check(await p.locator(".match").count() === D.matches.length, `All view shows all ${D.matches.length} matches`);
    check(await p.locator(".match.st-done").count() === played, `${played} matches imported as played`);
    check(await p.locator(".brk.lunch").count() >= 1, "lunch break marker present");
    const days = new Set(D.matches.map(m => new Date(m.time).toLocaleDateString("en-CA", { timeZone: D.event.tz }))).size;
    check(days > 1 && await p.locator(".brk.eod").count() === days - 1, `an end-of-day divider between each of the ${days} days`);
    // First-visit dots: one filled dot per team per unit (F1·2 / F3 / F4·5), one ring per extra field of a pair.
    const unitOf = f => f <= 2 ? "12" : f === 3 ? "3" : "45";
    const units = new Set(), fields = new Set();
    D.matches.forEach(m => [...m.red, ...m.blue].forEach(c => { units.add(c + unitOf(m.field)); fields.add(c + "F" + m.field); }));
    check(await p.locator("#list .fv.unit").count() === units.size && await p.locator("#list .fv.field").count() === fields.size - units.size,
      `first-visit dots: ${units.size} first-at-pair, ${fields.size - units.size} first-at-other-field`);
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
    // Marked teams keep their alliance colour (left stripe), and the menu can put Blue on the left.
    const stripe = await row(p, open[0].number).locator(".alliance.red .team.m-full").first().evaluate(e => getComputedStyle(e).borderLeftColor);
    const red = await row(p, open[0].number).locator(".alliance.red").evaluate(e => getComputedStyle(e).borderTopColor);
    check(stripe === red, "marked team keeps the red alliance stripe");
    const leftOf = async () => { const r = row(p, open[0].number);
      return (await r.locator(".alliance.red").boundingBox()).x < (await r.locator(".alliance.blue").boundingBox()).x ? "red" : "blue"; };
    const before = await leftOf();
    await p.locator("#menuBtn").tap(); await p.locator('.sheet [data-a="swap"][data-v="1"]').tap(); await p.locator('.sheet [data-a="close"]').tap();
    await p.reload(); await p.waitForSelector(".match");
    check(before === "red" && await leftOf() === "blue", "alliance side setting puts Blue on the left and persists");
    await ctx.close();
  }
  // 2b. Every open match has a stage badge: Scheduled until a team is marked, then In queue; tapping it
  //     steps Scheduled → In queue → On deck → On field → Scheduled, separately from Mark done.
  {
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    const r = () => row(p, open[2].number), chip = () => r().locator(".chip.st-queue");
    const badge = async () => (await chip().innerText()).trim();
    const color = async () => chip().evaluate(e => getComputedStyle(e).backgroundColor + getComputedStyle(e).color);
    check(await badge() === "Scheduled", "an unmarked match shows “Scheduled”");
    const cs = [await color()];
    await r().locator(".team").first().tap();
    check(await badge() === "In queue", "marking the first team switches to “In queue”");
    cs.push(await color());
    await chip().tap();
    check(await badge() === "On deck", "tapping the badge advances to “On deck”");
    cs.push(await color());
    await chip().tap();
    check(await badge() === "On field", "tapping again advances to “On field”");
    cs.push(await color());
    check(new Set(cs).size === 4, "each stage has its own colour");
    check(await p.locator(".sheet").count() === 0, "tapping the badge does not open the match sheet");
    await p.reload(); await p.waitForSelector(".match");
    check(await badge() === "On field", "stage persists across reload");
    check((await r().locator(".startbtn").innerText()).includes("Done ✓"), "Mark done button unaffected by the stage");
    await chip().tap();
    check(await badge() === "Scheduled", "a further tap wraps back to “Scheduled”");
    await r().locator(".startbtn").tap();
    check((await r().locator(".chip").innerText()).trim() === "Played", "Mark done still crosses out a staged match");
    // Without any team marks the badge can still be advanced.
    const r2 = () => row(p, open[3].number), chip2 = () => r2().locator(".chip.st-queue");
    await chip2().tap(); await chip2().tap();
    check((await chip2().innerText()).trim() === "On deck", "an unmarked match can be advanced to “On deck”");
    await r2().locator(".team").first().tap();
    check((await chip2().innerText()).trim() === "On deck", "marking a team keeps a later stage");
    await chip2().tap(); await chip2().tap();
    check((await chip2().innerText()).trim() === "Scheduled", "a marked match can be set back to “Scheduled”");
    await ctx.close();
  }
  // 2c. Team pages: search results expand each match into the full card; long-press on a team opens
  //     its page; a team name in the match sheet opens it too; Back returns to the screen underneath.
  {
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    const m = open[4], c = m.red[0], cName = D.teams[c].country || D.teams[c].name, partner = m.red[1];
    // Search: expand one of the team's matches.
    await p.locator("#searchBtn").tap();
    await p.locator("#q").fill(cName);
    const card = p.locator(`.sres[data-c="${c}"]`);
    const item = card.locator(`details[data-k="${m.id}"]`);
    check(await item.locator(".match").isHidden(), "search result matches start collapsed");
    await item.locator("summary").tap();
    check(await item.locator(".match.mini .team").count() === m.red.length + m.blue.length, "expanded match shows both full alliances");
    check(await item.locator(`.team.me[data-t="${c}"]`).count() === 1, "the searched team is outlined in its match");
    await item.locator(`.team[data-t="${partner}"]`).tap();
    check(await card.locator(`details[data-k="${m.id}"][open] .team.m-full[data-t="${partner}"]`).count() === 1, "marking a team inside the card works and keeps it expanded");
    await card.locator(`details[data-k="${m.id}"] [data-a="go"]`).tap();
    await p.waitForTimeout(1200);
    check(await p.locator(".search").count() === 0 && await row(p, m.number).locator(`.team.m-full[data-t="${partner}"]`).count() === 1, "Show in schedule closes search; the mark is on the list");
    // Long-press a team in the list: its page opens and the team is not marked.
    const before = await row(p, m.number).locator(`.team[data-t="${c}"]`).getAttribute("class");
    const held = await longPress(p, row(p, m.number).locator(`.team[data-t="${c}"]`));
    check(await p.locator(`.tpage .ttl`).innerText() === cName, "long-press on a team opens its team page");
    check(held.blocked && held.userSelect === "none", "text under the finger cannot be selected while the long-press is held");
    check(await p.evaluate(() => !document.body.classList.contains("lp") && !String(getSelection())), "selection works again once the finger lifts; nothing selected");
    check(await row(p, m.number).locator(`.team[data-t="${c}"]`).getAttribute("class") === before, "long-press does not change the team's mark");
    check(await p.locator('.tpage [data-a="back"]').count() === 0, "team page from the list has no Back button");
    await p.goBack(); await p.waitForTimeout(100);
    check(await p.locator(".tpage").count() === 0, "phone Back closes the team page");
    // Long-press elsewhere on a match: its sheet. Tap a team name there: that team's page, then Back.
    await longPress(p, row(p, m.number).locator(".time"));
    check(await p.locator(".sheet h2").count() === 1, "long-press on a match opens its sheet");
    await p.locator(`.sheet [data-a="tpage"][data-t="${partner}"]`).tap();
    check(await p.locator(".tpage .ttl").innerText() === (D.teams[partner].country || D.teams[partner].name), "team name in the match sheet opens its team page");
    await p.locator(`.tpage details[data-k="${m.id}"] summary`).tap();
    await longPress(p, p.locator(`.tpage details[data-k="${m.id}"] .team[data-t="${c}"]`));
    check(await p.locator(".tpage .ttl").innerText() === cName, "long-press on a partner inside a team page opens the partner's page");
    await p.locator('.tpage [data-a="back"]').tap(); await p.waitForTimeout(100);
    check(await p.locator(`.tpage details[data-k="${m.id}"][open]`).count() === 1, "Back returns to the previous team page as it was");
    await p.goBack(); await p.waitForTimeout(100);
    check(await p.locator(".sheet h2").count() === 1, "phone Back returns from a team page to the match sheet");
    await p.locator(`.sheet [data-a="tpage"][data-t="${partner}"]`).tap();
    await p.locator('.tpage [data-a="close"]').tap(); await p.waitForTimeout(100);
    check(await p.locator("#overlayRoot").innerHTML() === "", "✕ closes every stacked screen");
    check(await p.evaluate(() => history.state) === null, "✕ leaves no stray history entries (Back then leaves the app)");
    // The match sheet too: ✕, tapping outside it, and going on to the replay planner.
    const noEntry = async () => p.evaluate(() => history.state === null && !document.querySelector("#overlayRoot").innerHTML);
    await row(p, m.number).locator(".mid").tap(); await p.locator('.sheet [data-a="close"]').tap(); await p.waitForTimeout(150);
    check(await noEntry(), "match sheet ✕ drops its history entry");
    await row(p, m.number).locator(".mid").tap(); await p.mouse.click(5, 5); await p.waitForTimeout(150);
    check(await noEntry(), "tapping outside the match sheet drops its history entry");
    await row(p, m.number).locator(".mid").tap(); await p.locator('.sheet [data-a="rpon"]').tap(); await p.locator('.sheet [data-a="rpopen"]').tap();
    check(await p.locator(".rpl").count() === 1, "Replay planner opens from the match sheet");
    await p.goBack(); await p.waitForTimeout(150);
    check(await noEntry(), "one Back closes the planner opened from the match sheet");
    await ctx.close();
  }
  // 2d. Team notes: typed on the team page, saved, shown in search and the match sheet.
  {
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    const m = open[5], c = m.blue[0], name = D.teams[c].country || D.teams[c].name;
    await longPress(p, row(p, m.number).locator(`.team[data-t="${c}"]`));
    await p.locator(`.tpage textarea[data-note="${c}"]`).fill("Robot battery issue\nAsk for Ana");
    await p.locator('.tpage [data-a="close"]').tap(); await p.waitForTimeout(100);
    await p.reload(); await p.waitForSelector(".match");
    await p.locator("#searchBtn").tap(); await p.locator("#q").fill(name);
    check(await p.locator(`.sres textarea[data-note="${c}"]`).inputValue() === "Robot battery issue\nAsk for Ana", "team note persists across reload and shows in search");
    await p.locator(`.sres[data-c="${c}"] details[data-k="${m.id}"] summary`).tap();
    await p.locator(`.sres[data-c="${c}"] details[data-k="${m.id}"] .mid`).tap();
    check((await p.locator(`.sheet [data-a="tpage"][data-t="${c}"] .tn`).innerText()).includes("Robot battery issue"), "team note shows under the team in the match sheet");
    await p.locator('.sheet [data-a="back"]').tap(); await p.waitForTimeout(100);
    await p.locator(`.sres textarea[data-note="${c}"]`).fill("");
    await p.locator('.search [data-a="close"]').tap(); await p.waitForTimeout(100);
    check(await p.evaluate(k => Object.keys(JSON.parse(localStorage.getItem(k)).n || {}).length, Object.keys(await p.evaluate(() => ({ ...localStorage }))).find(k => k.startsWith("fgcq:"))) === 0, "clearing a note removes it");
    const key = Object.keys(await p.evaluate(() => ({ ...localStorage }))).find(k => k.startsWith("fgcq:"));
    await p.locator("#searchBtn").tap(); await p.locator("#q").fill(name);
    await p.locator(`.sres textarea[data-note="${c}"]`).fill("Keep me?");
    await p.locator('.search [data-a="close"]').tap(); await p.waitForTimeout(100);
    p.once("dialog", d => d.accept());
    await p.locator("#menuBtn").tap(); await p.locator('.sheet [data-a="reset"]').tap();
    check(await p.evaluate(k => Object.keys(JSON.parse(localStorage.getItem(k)).n || {}).length, key) === 0, "Reset all marks also erases team notes");
    await ctx.close();
  }
  // 3a. Start-time tracking is off by default: the button only crosses the match out, and the
  //     sheet has no delta controls. The menu switch turns it on.
  {
    const { ctx, p } = await page(null);
    await p.locator('[data-unit="all"]').tap();
    const r = row(p, open[0].number);
    check((await r.locator(".startbtn").innerText()).includes("Done ✓"), "default button reads “Done ✓” (short for Mark done on phones)");
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
