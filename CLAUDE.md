# FGC 2026 Queue Sheet: notes for AI-assisted changes

Static offline web app (no build step) replacing paper queuing sheets at the FIRST Global Challenge 2026 (Incheon). See README.md for features and workflows.

## Ground rules
- **Country names and flags come only from https://results.first.global/.** Never type, shorten, "fix" or substitute a name or flag by hand; regenerate with `tools/fetch_fgc_data.py` + `tools/rasterize_flags.mjs`. The only transformation applied is stripping the generic leading "Team " from country teams. Special teams (Team Hope, etc.) keep their full name.
- **`data.js` and `flags/` are generated.** Do not hand-edit them.
- **Keep IDs stable.** Volunteer marks live in `localStorage` under `fgcq:<event.id>` and are keyed by match id (`<tournamentKey>-<id>` from the site). Changing either silently wipes every phone's sheet.
- The alliance colour must stay visible whatever a team is marked (`.alliance` outline + label bar, team left stripe). `S.ui.swap` puts Blue on the left via the `al-swap` body class (grid areas), never by reordering data.
- Flags must never be cropped (`object-fit: contain`). The official artwork is drawn on 5:3 canvases (Nepal is narrower).
- Times always display in the event time zone (`event.tz`, Asia/Seoul), never the phone's.
- Site-played matches (`played: true`) default to *Played*; a volunteer's own status (`S.m[id].s`) always wins, which is how replays are reopened.
- Match stage: `S.m[id].q` is `"deck"` / `"field"` while queuing (absent = In queue); Scheduled / In queue come from the status (`statusOf`). `setStage` is the only writer; Mark done / Start never depend on it.
- Team notes live in `S.n` (`{ <team code>: text }`), edited on team pages; blank notes are removed. They are part of backups and undo snapshots, and *Reset all marks* erases them too.
- Replays live in `S.r` (`ids`, `plan: [{id, s, f}]`, `done`, `mode`, `manual`), keyed by the same match ids. Replays never go on Field 3. A plan is an order of slots (one match per side pair per slot), never clock times. Played replays (`done`) must never move when re-planning.
- Start delta = scheduled minute vs clock minute (`clockDelta`), so any second within the scheduled minute is "On time". `d === 0` (on time) and `d == null` (not recorded) must stay visually distinct. Start-time tracking is opt-in (`S.ui.timing`, default off): when off, the button reads “Mark done ✓”, no delta is recorded or shown, and the sheet has no delta controls.

## Layout of index.html
All CSS and JS are inline. Main sections: persistence (`S`, `save`, `statusOf`), formatting (`fTime`, `hm`/`hmH`, `fmtDelta`, `clockDelta`), breaks and days (`BREAKS`, `DAYS`), view selection, replay planning (`replayFields`, `scorePlan`/`planCoster` with weights `RW`, `optimizeReplays`, `syncReplays`), rendering (`render`, `matchHtml`, `breakHtml`), actions (`startMatch`, `openBefore`/`markEarlierDone`), overlays (match sheet, menu, replay planner `openReplays`/`drawReplays`, team pages `openTeam`/`teamCardHtml` shared with search), long-press handling, service worker registration.

Overlays opened on top of another (`openNested`) stack: every overlay calls `navOpened(snap)` once drawn, Back pops to the screen underneath, ✕ or tapping outside (`exitOverlay`) closes them all and drops the overlay's history entry; `swapOverlay` replaces one overlay with another on the same entry. The overlay holds a single history entry at any depth, so one phone Back always closes or steps back. `closeOverlay` only clears the screen (for popstate). Copies of match cards inside overlays use `matchHtml(m, true)` (no `id`), so `#m-<id>` stays unique to the list. Long-press is timed from pointer events because iOS never fires `contextmenu`; the click that ends a long-press is swallowed, and while a finger is held the `lp` body class makes the whole page unselectable (Android's own long-press would select whatever opened under the finger).

## Before pushing
- `node tools/smoke_test.mjs` must pass (needs the `playwright` package + Chromium).
- Check the layout at phone portrait (~400px), landscape/foldable (~860px) and tablet (~1280px) widths, in light and dark mode.
- `main` is what GitHub Pages serves to volunteers' phones.
