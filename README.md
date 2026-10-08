# FGC 2026 Queue Sheet

A digital replacement for the paper queuing schedule at the FIRST Global Challenge 2026, for queuing volunteers. It runs as a single static web page in Chrome on Android phones, foldables and tablets. Everything is saved on the device, and it never syncs to the cloud.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (HTML, CSS, JS inline). |
| `data.js` | Schedule and teams, generated from results.first.global. Do not edit by hand. |
| `flags/*.png` | Official FIRST Global flags, rendered from the site's SVGs. |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Offline support and "Add to Home screen". |
| `tools/fetch_fgc_data.py`, `tools/rasterize_flags.mjs` | Rebuild `data.js` and `flags/` from the results site. |

## Using it

* **Unit switcher** (top): `F1·2`, `F3`, `F4·5`, `All`. The pair units and All have a sub-switch for single fields.
* **Tap a team** to cycle its mark: none → ✓ full team with robot → R representative only → ? not heard from / unknown → none.
* **Start ▶** crosses the match out and records the start delta from the phone clock (+ = late, − = early). If earlier matches in the view are still open, a toast offers to cross them out too, so you can join mid-event.
* **Catching up** (for a volunteer starting mid-day): tap the match number of the first match you are responsible for. Under *Catching up*, mark every open match above it as played, either in the current view or on all fields. Matches reopened for a replay are skipped, and the toast offers *Undo*.
* **Tap the match number** (or long-press a match) for every option: status (Not started / Queuing / Played), delta stepper, and explicit per-team marks. A match is shown as *Queuing* automatically once any team is marked present.
* The **header** shows event-local time, the next match in the current view, and how far ahead or behind the unit is running.
* **Jump to next** scrolls to the first open match after the last played one, or to the current time if nothing is marked yet.
* **Search** (magnifier) finds a team by country name, ignoring accents. It shows which unit and field the team must go to next, plus all their matches. Tap one to jump to it.
* **Menu**: filter by match type, hide played matches, keep screen awake, legend, export/import a backup JSON, reset.

Marks are saved to `localStorage` on every tap (keyed by `event.id` in `data.js`). They survive refreshes, navigation and restarts. The app also asks Chrome for persistent storage.

## Deploying to phones

The best option is to serve the folder over HTTPS, e.g. GitHub Pages (Settings → Pages → deploy from this branch). Open it once in Chrome on each phone and use **⋮ → Add to Home screen**. The service worker then caches it so it works offline. "Keep screen awake" needs HTTPS.

Opening `index.html` directly from the phone's storage also works, but offline caching and wake lock are unavailable there.

### GitHub Pages, step by step

1. Merge this branch into `main` (or pick this branch directly in step 2).
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**. Pick the branch and the `/ (root)` folder, then **Save**.
3. After a minute or two the site is live at `https://<owner>.github.io/<repo>/`. The URL is shown at the top of the Pages settings.
4. On each phone, open that URL in Chrome and choose **⋮ → Add to Home screen → Install**. Every file, flags included, is cached on that first visit, so it then works with no signal.
5. To publish updates, push to the same branch. Pages redeploys automatically, and phones get the new version the next time they open the app while online.

Notes: Pages sites are public, although the URL is not advertised; the schedule is public anyway, and the volunteers' marks never leave the phone. Free accounts need a public repository for Pages. Private repositories need a paid plan.

## Data source and refreshing it

Everything comes from https://results.first.global/, which is the authority for country names, flags and the schedule:

* The schedule and team list are read from the JSON the site embeds in its home page (`__NEXT_DATA__`). Red is stations 11–13 and blue is 21–23, the same rule the site uses.
* Names are shown exactly as published, minus the generic leading "Team " (e.g. "Team Côte d'Ivoire" → "Côte d'Ivoire"). Special teams such as "Team Hope (Refugees)" keep their full name.
* Flags are the site's own SVGs (`/static/flags/4x3/<code>.svg`). Some are over 1 MB, 45 MB in total, so they are rendered once in Chromium to small PNGs (~0.8 MB total) at their original proportions.
* The site's **played** flag is imported. Those matches show as *Played* but stay in the list so they can be looked up. To reopen one for a replay, tap its match number and choose *Not started* or *Queuing*. A volunteer's own status always overrides the site's. Scores and team marks are not imported.

To refresh (e.g. when playoff matches are published):

```sh
python3 tools/fetch_fgc_data.py      # writes data.js, caches official SVGs in tools/.flag-cache/
node tools/rasterize_flags.mjs       # needs the playwright package + Chromium
```

Then commit and push. Match IDs and the event ID stay the same, so marks already on phones are kept. Phones pick up the new data the next time they open the page online.
