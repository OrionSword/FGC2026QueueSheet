# FGC 2026 Queue Sheet

A digital replacement for the paper queuing schedule at the FIRST Global Challenge 2026, for queuing volunteers. It runs as a single static web page on Android (Chrome) and iPhone/iPad (Safari) phones, foldables and tablets, and installs to the home screen. Everything is saved on the device, and it never syncs to the cloud.

**Live app:** https://orionsword.github.io/FGC2026QueueSheet/ (GitHub Pages, deployed from `main`).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (HTML, CSS, JS inline). |
| `data.js` | Schedule and teams, generated from results.first.global. Do not edit by hand. |
| `flags/*.png` | Official FIRST Global flags, rendered from the site's SVGs. |
| `sw.js`, `manifest.webmanifest`, `icon.svg`, `apple-touch-icon.png` | Offline support and "Add to Home screen" (the PNG is the iPhone home-screen icon). |
| `tools/fetch_fgc_data.py`, `tools/rasterize_flags.mjs` | Rebuild `data.js` and `flags/` from the results site. |
| `.github/workflows/refresh-data.yml` | Re-runs `fetch_fgc_data.py` on GitHub (by hand or on a timer) and commits `data.js` when the schedule changed. |
| `pronounce.js`, `tools/pronunciations.json`, `tools/build_pronounce.py` | How to say each team's name. Edit the JSON (keyed by the team name as shown), then run the script to regenerate `pronounce.js` (keyed by team code). |
| `tools/make_icons.mjs` | Rebuild `apple-touch-icon.png` from `icon.svg`. |
| `tools/smoke_test.mjs` | End-to-end check in headless Chromium (see *Testing*). |
| `CLAUDE.md` | Notes and ground rules for AI-assisted changes. |

## Using it

* **Unit switcher** (top): `F1·2`, `F3`, `F4·5`, `All`. The pair units and All have a sub-switch for single fields.
* **Tap a team** to cycle its mark: none → ✓ full team with robot → R representative only → ? not heard from / unknown → none.
* **Mark done ✓** crosses the match out. Start-time tracking is **off by default**, for queuers far upstream who don't need it. Turn on **Menu → Track start times** to change the button to **Start ▶**, which crosses the match out and records the start delta from the phone clock, in whole minutes (+ = late, − = early). Clock minutes are compared, so pressing Start any time during the scheduled minute (e.g. 4:41:00–4:41:59 for a 4:41 match) records **On time**. If earlier matches in the view are still open, a toast offers to cross them out too.
* With tracking on, a delta of 0 is shown as **On time** (blue). A match with no delta recorded shows just *Played*, and its option sheet shows "—" / *Not recorded*. The sheet has −5/−1/+1/+5, **On time**, **Started now** and **Clear delta** buttons.
* **Catching up** (for a volunteer starting mid-day): tap the match number of the first match you are responsible for. Under *Catching up*, mark every open match above it as played, either in the current view or on all fields. Matches reopened for a replay are skipped, and the toast offers *Undo*.
* **Tap the match number** (or long-press a match away from the teams) for every option: stage (Scheduled / In queue / On deck / On field / Played), delta stepper, and explicit per-team marks.
* **Match badge**: every open match shows its stage. It starts as a grey **Scheduled** badge and switches to **In queue** (amber) automatically once any team is marked present. Tap the badge to step through **Scheduled → In queue → On deck** (cyan) **→ On field** (green) and back to *Scheduled*; this works with or without team marks. The stage is separate from Mark done / Start, which still cross the match out.
* **Breaks** are found automatically from gaps in the schedule: per day, any gap between match slots at least 6 minutes longer than the normal cycle. A gap of 40+ extra minutes is lunch (bold yellow banner); shorter ones (~15 min) get a dashed bar. Both show the last match before the break and when play resumes. Between competition days, a dark **End of day** bar shows the day's last match and when play resumes the next day.
* **Alliances**: each alliance has a thin red or blue outline with a *RED* / *BLUE* bar on top, and every team keeps its alliance-coloured left stripe, so the alliance stays obvious even when every team is checked off. **Menu → Alliance on the left: Red / Blue** puts the alliances on the side matching how the field looks from where you stand (saved per phone; also used in the replay planner and the match sheet).
* **Field colours** match the event: F1 orange, F2 pink, F3 purple, F4 light blue, F5 green.
* **First-visit dots**: a tiny dot in the top-right corner of a team's tile marks its first match (of any type) on that pair of fields, split in the pair's two colours (F1·2 orange|pink, F4·5 light blue|green), or on Field 3 (solid purple). A tiny ring marks its first match on the other field of a pair it has already played on. Explained in the menu legend.
* Times are always in event-local time, **12-hour (AM/PM) by default**; the menu has a 24-hour option.
* The **header** shows event-local time, the next match in the current view, and how far ahead or behind the unit is running.
* **Jump to next** scrolls to the first open match after the last played one, or to the current time if nothing is marked yet.
* **Team pages.** **Long-press a team** in the list (or tap a team's name in a match's options) to open its page: which unit and field it must go to next, its pending replays, and every match it plays. Tap a match to expand the full match card, with both alliances and their marks; it works like the list (tap a team to mark it, tap the badge to change the stage, Mark done). Long-press a partner or opponent there to open their page; **‹** or the phone's Back returns to the previous screen and ✕ closes them all. **Show in schedule** jumps to the match in the main list. The page also has a **Notes** box for free-text notes about the team (contact person, robot issues, …); notes are saved on the phone as you type, show under the team's name in each match's options, and are included in backups. *Reset all marks, replays and notes* erases them too.
* **Pronunciation.** Each team page, search result and match sheet shows how to say the team's name under it (🗣 *af-**GAN**-ih-stan*: stressed syllables in bold capitals; ay = day, ah = father, aw = law, ee = see, eye/y = fly, oh = go, oo = boot, ow = cow, zh = measure, g always hard), plus a tip for the trip-wires (Niger vs Nigeria, Dominica vs Dominican Republic, Kiribati, Lesotho, Côte d'Ivoire, Team Hope).
* **Search** (magnifier) finds a team by country name, ignoring accents, and shows the same team page for each hit (tap the team name to open it full screen).
* **Replays** (↻ button at the top; the badge counts replays still to play). Flag a match from its sheet (*↻ Flag for replay*) or type match numbers into the planner (`112`, or several at once: `112 140, 151`). Flagged matches get a purple *↻ Replay · S2 F4* chip in the list, and team pages show a team's pending replays. The planner:
  * plans the order only, no clock times. A **slot** is one match on each side pair (F1·2, F4·5) at the same time. **Field 3 never plays replays.**
  * **Fields**: *Auto* (default) keeps each pair's replays on that pair while no pair has more than two (F3's go to either pair), otherwise spreads them over both pairs. *Own pair*, *Both pairs*, *F1·2 only* and *F4·5 only* force a choice.
  * never puts a team in two matches in the same slot, avoids back-to-back slots for a team, and shows a **Break** banner where it cannot be avoided. Then it keeps the number of slots low and the walking short (fields 1–5 are in a line), alternating the two fields of a pair.
  * lists teams with more than one replay in the summary, outlines them in purple with *1/2*, *2/2*…, and tells them where to go next: *Stay at F2 Red*, *Stay on F2, switch to Blue*, or *Go to F4 Blue (2 fields toward F5)*.
  * *Played ✓* marks a replay done; played replays never move again. *✎ Edit order* moves a replay to an earlier/later slot or another field (swapping with whatever is there). After hand edits, newly added replays are slotted in without moving the others, and *↻ Re-optimize* re-plans everything not yet played.
* **Playoffs** (2026 Game Manual §6.4–6.7). Eight four-team **tournament alliances**, fixed for the rest of the event (Table 6-1: alliance N = ranked #N, #N+8, #25−N plus a random draw). Sixteen **playoff matches** in a fixed order (Table 6-2), four per alliance, no elimination inside them. The top three alliances by total playoff score play three **finals** (Table 6-3: #1 v #3, #3 v #2, #2 v #1). Only three of an alliance's four teams play each match, and **every team must play at least one playoff match (T01)**; finals have no such rule.
  * Playoff matches show their stage (*Round Robin*, *Finals*) and the alliance on each bar (*Red · Alliance 4*). Each side of four has a **Who sits out?** button: pick the team sitting out, and it shows faded with *Sits out*.
  * Tags on open playoff matches: *Not played yet* (orange) on a team the alliance has not used yet, **Must play** (red) on the alliance's last playoff match, and *Sits out · has not played!* when the line-up would break T01. They only appear once line-ups are recorded (a *?* means some earlier line-up is missing).
  * **🏆 Alliances** (menu, the Playoffs day header, or a playoff match's options): one card per alliance, with a ✓ / – / ? grid of who played each of its matches, how many each team played, and T01 warnings.
  * **Getting the schedule in.** results.first.global publishes the alliances and all 16 matches (all four members of each alliance listed per side) once alliances are formed. `tools/fetch_fgc_data.py` imports them; run it, or the GitHub workflow below, and phones show a yellow **New schedule** bar (they check every 3 minutes while open and online, or at once with **Menu → Check for schedule update**). Tap **Load now**. Marks are kept.
  * **If the site is late:** in 🏆 Alliances, fill the alliances on the phone (tap each slot and search, or paste text such as `1: KAZ, ARU, BOL, JAM`, one alliance per line, codes or country names), set the field and start time, and tap **Build schedule**. The app builds the 16 matches from Table 6-2 with the same match ids the site uses (`t3-1`…`t3-16`), with estimated times (shown *~2:00*). *Copy alliances as text* shares them with other queuers to paste. For the finals, pick the top three. When the official schedule arrives it replaces the phone's, and every mark and line-up is kept.
* **Menu**: filter by match type, hide played matches, alliance on the left, track start times, keep screen awake, legend, export/import a backup JSON (marks, stages, replays and notes; not display settings), reset.

Marks, stages, replays and notes are saved to `localStorage` on every tap (keyed by `event.id` in `data.js`). They survive refreshes, navigation and restarts. The app also asks the browser for persistent storage. They are per phone and never shared between phones (move them with a backup if needed).

## Deploying to phones

The best option is to serve the folder over HTTPS, e.g. GitHub Pages (Settings → Pages → deploy from this branch). Open it once in Chrome on each Android phone and use **⋮ → Add to Home screen**, or in Safari on each iPhone and use **Share → Add to Home Screen**. The service worker then caches it so it works offline. "Keep screen awake" needs HTTPS.

Opening `index.html` directly from the phone's storage also works, but offline caching and wake lock are unavailable there.

### GitHub Pages, step by step

1. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Pick `main` and the `/ (root)` folder, then **Save**.
3. After a minute or two the site is live at `https://<owner>.github.io/<repo>/`. The URL is shown at the top of the Pages settings.
4. On each phone, open that URL and install it. Every file, flags included, is cached on that first visit, so it then works with no signal.
   * **Android:** in Chrome, **⋮ → Add to Home screen → Install**.
   * **iPhone / iPad:** in Safari (or, on iOS 16.4+, Chrome or Edge), **Share → Add to Home Screen → Add**. On iOS the installed app keeps its own data, separate from Safari's, so install first and mark only in the installed app. (A Safari tab's marks can be moved with **Menu → Export backup** there and **Import backup** in the app; display settings are not included.)
5. To publish updates, push to the same branch. Pages redeploys automatically, and phones get the new version the next time they open the app while online.

Notes: Pages sites are public, although the URL is not advertised; the schedule is public anyway, and the volunteers' marks never leave the phone. Free accounts need a public repository for Pages. Private repositories need a paid plan.

## Data source and refreshing it

Everything comes from https://results.first.global/, which is the authority for country names, flags and the schedule:

* The schedule and team list are read from the JSON the site embeds in its home page (`__NEXT_DATA__`). Red is stations 11–13 and blue is 21–23, the same rule the site uses.
* Names are shown exactly as published, minus the generic leading "Team " (e.g. "Team Côte d'Ivoire" → "Côte d'Ivoire"). Special teams such as "Team Hope (Refugees)" keep their full name.
* Flags are the site's own SVGs (`/static/flags/4x3/<code>.svg`). Some are over 1 MB, 45 MB in total, so they are rendered once in Chromium to small PNGs (~0.8 MB total) at their original proportions.
* The site's **played** flag is imported. Those matches show as *Played* but stay in the list so they can be looked up. To reopen one for a replay, tap its match number and choose any other stage. A volunteer's own status always overrides the site's. Scores and team marks are not imported.

To refresh (e.g. when playoff matches are published):

```sh
python3 tools/fetch_fgc_data.py      # writes data.js if the schedule changed, caches official SVGs in tools/.flag-cache/
node tools/rasterize_flags.mjs       # only when it reports flags not yet rendered (needs playwright + Chromium)
```

`rasterize_flags.mjs` renders whatever SVGs `fetch_fgc_data.py` cached, so run them in that order. `data.js` carries a `rev` (a hash of teams, schedule and alliances, not of played flags), and is only rewritten when it changes; `--force` rewrites it anyway (to refresh played flags).

Playoffs: every match that is not practice or ranking is a `playoff` match with a `stage` (*Round Robin*, *Finals*), placed on Field 3 (`PLAYOFF_FIELD`: the site lists them all as field 1, but they are played on the centre field), and the alliances (`alliances_*` on the site: captain + three picks) are written to `alliances` with the rounds each is in and its playoff rank. The site does not publish which three teams played; volunteers record it.

**Playoff day, fastest path.** The site has no CORS, so phones cannot read it directly; they read `data.js` from GitHub Pages instead.
1. Before the alliances are announced (e.g. at the end of ranking matches): GitHub → **Actions → Refresh schedule → Run workflow** (works from the GitHub mobile app). One run keeps watching: it checks results.first.global every minute for the chosen number of minutes (default 300, i.e. 5 hours, enough for the playoffs and finals) and commits `data.js` to `main` each time the schedule changes; Pages redeploys in about a minute. Each push shows as a *Pushed a new schedule* notice on the run. GitHub's own timer (every 5 minutes, 12:00–21:00 Korea time, 8–11 October) is only a fallback: in practice GitHub drops most of those runs.
2. Phones show the **New schedule** bar within 3 minutes (or straight away with *Check for schedule update*).
3. If the site is slow, queuers can build the schedule on their phones from the announced alliances (see *Playoffs* above) and keep working; the official data replaces it later without losing marks.

**Rehearsing** with a past event, whose playoffs used the same format (2022–2025 manuals match 2026 for Table 6-1/6-2/6-3 and T01): `python3 tools/fetch_fgc_data.py --source /history/2025 --out /tmp/data2025.js`, then serve that file as `data.js` (never commit it). Then run the smoke test, commit and push. Match IDs and the event ID stay the same, so marks already on phones are kept. Phones pick up the new data the next time they open the page online (the first open after an update may still show the old version).

## Testing

```sh
node tools/smoke_test.mjs            # needs the playwright package + Chromium
```

It serves the folder locally and checks, in a phone-sized headless Chromium:
* every match renders, site-played matches show as played, and break, lunch and end-of-day markers and flags appear;
* team marks persist across a reload, and the alliance side setting works;
* the stage badge (Scheduled → In queue → On deck → On field), its colours and persistence;
* pronunciations: every team has one, and team pages show it with the stress in bold;
* team pages: search cards, expanding matches, real touch long-presses (team page vs match sheet, no mark changed, no text selected), team names in the match sheet, Back/✕ navigation and history;
* team notes: saving, showing in the match sheet, clearing, and Reset;
* start-time tracking off by default (Mark done), and the on-time rule at the minute boundaries;
* catch-up and Undo;
* replays: flagging, adding by number, no clashes, side fields only, breaks for back-to-back teams, hand edits and persistence;
* playoffs: alliances pasted as text, the 16 matches built from Table 6-2 and finals from Table 6-3, who sits out, the T01 tags and warnings, an official schedule replacing the phone's (marks kept, a three-team side showing the fourth as sitting out), and the *New schedule* bar;
* offline loading.

Expectations come from `data.js`, so it keeps passing after a data refresh. It exits non-zero on any failure.
