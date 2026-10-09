# FGC 2026 Queue Sheet

A digital replacement for the paper queuing schedule at the FIRST Global Challenge 2026, for queuing volunteers. It runs as a single static web page in Chrome on Android phones, foldables and tablets. Everything is saved on the device, and it never syncs to the cloud.

**Live app:** https://orionsword.github.io/FGC2026QueueSheet/ (GitHub Pages, deployed from `main`).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (HTML, CSS, JS inline). |
| `data.js` | Schedule and teams, generated from results.first.global. Do not edit by hand. |
| `flags/*.png` | Official FIRST Global flags, rendered from the site's SVGs. |
| `sw.js`, `manifest.webmanifest`, `icon.svg`, `apple-touch-icon.png` | Offline support and "Add to Home screen" (the PNG is the iPhone home-screen icon). |
| `tools/fetch_fgc_data.py`, `tools/rasterize_flags.mjs` | Rebuild `data.js` and `flags/` from the results site. |
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
* Times are always in event-local time, **12-hour (AM/PM) by default**; the menu has a 24-hour option.
* The **header** shows event-local time, the next match in the current view, and how far ahead or behind the unit is running.
* **Jump to next** scrolls to the first open match after the last played one, or to the current time if nothing is marked yet.
* **Team pages.** **Long-press a team** in the list (or tap a team's name in a match's options) to open its page: which unit and field it must go to next, its pending replays, and every match it plays. Tap a match to expand the full match card, with both alliances and their marks; it works like the list (tap a team to mark it, tap the badge to change the stage, Mark done). Long-press a partner or opponent there to open their page; **‹** or the phone's Back returns to the previous screen and ✕ closes them all. **Show in schedule** jumps to the match in the main list. The page also has a **Notes** box for free-text notes about the team (contact person, robot issues, …); notes are saved on the phone as you type, show under the team's name in each match's options, and are included in backups. *Reset all marks and replays* erases notes too.
* **Search** (magnifier) finds a team by country name, ignoring accents, and shows the same team page for each hit (tap the team name to open it full screen).
* **Replays** (↻ button at the top; the badge counts replays still to play). Flag a match from its sheet (*↻ Flag for replay*) or type match numbers into the planner (`112`, or several at once: `112 140, 151`). Flagged matches get a purple *↻ Replay · S2 F4* chip in the list, and team search shows a team's pending replays. The planner:
  * plans the order only, no clock times. A **slot** is one match on each side pair (F1·2, F4·5) at the same time. **Field 3 never plays replays.**
  * **Fields**: *Auto* (default) keeps each pair's replays on that pair while no pair has more than two (F3's go to either pair), otherwise spreads them over both pairs. *Own pair*, *Both pairs*, *F1·2 only* and *F4·5 only* force a choice.
  * never puts a team in two matches in the same slot, avoids back-to-back slots for a team, and shows a **Break** banner where it cannot be avoided. Then it keeps the number of slots low and the walking short (fields 1–5 are in a line), alternating the two fields of a pair.
  * lists teams with more than one replay in the summary, outlines them in purple with *1/2*, *2/2*…, and tells them where to go next: *Stay at F2 Red*, *Stay on F2, switch to Blue*, or *Go to F4 Blue (2 fields toward F5)*.
  * *Played ✓* marks a replay done; played replays never move again. *✎ Edit order* moves a replay to an earlier/later slot or another field (swapping with whatever is there). After hand edits, newly added replays are slotted in without moving the others, and *↻ Re-optimize* re-plans everything not yet played.
* **Menu**: filter by match type, hide played matches, alliance on the left, track start times, keep screen awake, legend, export/import a backup JSON, reset.

Marks and replays are saved to `localStorage` on every tap (keyed by `event.id` in `data.js`). They survive refreshes, navigation and restarts. The app also asks Chrome for persistent storage.

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
python3 tools/fetch_fgc_data.py      # writes data.js, caches official SVGs in tools/.flag-cache/
node tools/rasterize_flags.mjs       # needs the playwright package + Chromium
```

`rasterize_flags.mjs` renders whatever SVGs `fetch_fgc_data.py` cached, so run them in that order. Then run the smoke test, commit and push. Match IDs and the event ID stay the same, so marks already on phones are kept. Phones pick up the new data the next time they open the page online (the first open after an update may still show the old version).

## Testing

```sh
node tools/smoke_test.mjs            # needs the playwright package + Chromium
```

It serves the folder locally and checks, in a phone-sized headless Chromium:
* every match renders, site-played matches show as played, and break markers and flags appear;
* team marks persist across a reload;
* start-time tracking off by default (Mark done), and the on-time rule at the minute boundaries;
* catch-up and Undo;
* replays: flagging, adding by number, no clashes, side fields only, breaks for back-to-back teams, hand edits and persistence;
* offline loading.

Expectations come from `data.js`, so it keeps passing after a data refresh. It exits non-zero on any failure.
