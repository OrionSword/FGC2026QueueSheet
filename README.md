# FGC 2026 Queue Sheet

A digital replacement for the paper queuing schedule at the FIRST Global Challenge 2026, for queuing volunteers. It runs as a single static web page in Chrome on Android phones, foldables and tablets. Everything is saved on the device, and it never syncs to the cloud.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (HTML, CSS, JS inline). |
| `data.js` | Schedule, team names and flags (`window.FGC_DATA`). **Currently DEMO data.** |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Offline support and "Add to Home screen". |
| `tools/make_demo_data.py` | Generates the placeholder `data.js`. |

## Using it

* **Unit switcher** (top): `F1·2`, `F3`, `F4·5`, `All`. The pair units and All have a sub-switch for single fields.
* **Tap a team** to cycle its mark: none → ✓ full team with robot → R representative only → ? not heard from / unknown → none.
* **Start ▶** crosses the match out and records the start delta from the phone clock (+ = late, − = early). If earlier matches in the view are still open, a toast offers to cross them out too, so you can join mid-event.
* **Tap the match number** (or long-press a match) for every option: status (Not started / Queuing / Played), delta stepper, and explicit per-team marks. A match is shown as *Queuing* automatically once any team is marked present.
* The **header** shows event-local time, the next match in the current view, and how far ahead or behind the unit is running.
* **Jump to next** scrolls to the first open match after the last played one, or to the current time if nothing is marked yet.
* **Search** (magnifier) finds a team by country name, ignoring accents. It shows which unit and field the team must go to next, plus all their matches. Tap one to jump to it.
* **Menu**: filter by match type, hide played matches, keep screen awake, legend, export/import a backup JSON, reset.

Marks are saved to `localStorage` on every tap (keyed by `event.id` in `data.js`). They survive refreshes, navigation and restarts. The app also asks Chrome for persistent storage.

## Deploying to phones

The best option is to serve the folder over HTTPS, e.g. GitHub Pages (Settings → Pages → deploy from this branch). Open it once in Chrome on each phone and use **⋮ → Add to Home screen**. The service worker then caches it so it works offline. "Keep screen awake" needs HTTPS.

Opening `index.html` directly from the phone's storage also works, but offline caching and wake lock are unavailable there.

## Data format (`data.js`)

```js
window.FGC_DATA = {
  event: { id: "fgc2026", name: "...", tz: "Asia/Seoul", source: "results.first.global, fetched 2026-10-08" },
  teams: { "KOR": { name: "<exact name from results.first.global>", flag: "flags/kor.png" }, ... },
  matches: [
    { type: "ranking" /* practice | ranking | playoff */, number: 12, field: 3,
      time: "2026-10-08T10:24:00+09:00", red: ["KOR", "...", "..."], blue: ["...", "...", "..."] },
    ...
  ]
};
```

Team names and flags must come **only** from https://results.first.global/, which is the authority on country names and flags. Do not edit them by hand. Keep `event.id` stable once volunteers start using the app, because changing it starts a fresh, empty sheet.
