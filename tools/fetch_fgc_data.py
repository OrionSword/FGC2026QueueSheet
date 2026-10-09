#!/usr/bin/env python3
"""Build data.js and flags/ from https://results.first.global/ (the authority for
country names, flags and the match schedule).

Usage (from the repo root):  python3 tools/fetch_fgc_data.py [--source PATH] [--out FILE]

  --source PATH  page to read instead of the home page, e.g. /history/2025 (a past event, to
                 rehearse with real playoff data; write it with --out, never over data.js)
  --out FILE     where to write (default: data.js)

data.js is only rewritten when the schedule, teams or alliances changed (its "rev" is a hash
of those; played flags alone do not count, use --force to refresh them), so this can run on a timer (.github/workflows/refresh-data.yml) and commit only
real changes. Playoff matches and alliances are imported as soon as the site publishes them.

The results site is a Next.js app; the schedule and team list are embedded in the
home page as __NEXT_DATA__ JSON. Flags are the site's own SVGs from
/static/flags/4x3/<code>.svg, cached in tools/.flag-cache/ and then rendered to
small PNGs in flags/ by tools/rasterize_flags.mjs (some official SVGs are >1 MB).
Only the site's "played" flag is imported (shown as already played; volunteers can
reopen a match for a replay). Scores and team marks are not imported.

Playoffs: every tournament other than practice/ranking (Round Robin, Finals, ...) is a
"playoff" match with a "stage" (its name minus "Match N"). The site lists all four alliance
members of a playoff match (stations 11-14 red, 21-24 blue); which three actually play is
not published, so volunteers record it in the app. Alliances come from the site's
alliances_* lists (captain, pick1..pick3) and are written to "alliances".
"""
import argparse
import hashlib
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

BASE = "https://results.first.global"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLAG_DIR = os.path.join(ROOT, "tools", ".flag-cache")
# Special (non-ISO) flag codes, mirrored from the site's getFlagUrl().
SPECIAL_FLAGS = {"10": "10_hope", "11": "11_south-america", "12": "12_oceania",
                 "13": "13_north-america", "14": "14_europe"}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "FGC-queue-sheet-builder"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def match_type(name):
    n = name.lower()
    if "practice" in n:
        return "practice"
    if "ranking" in n or "qualif" in n:
        return "ranking"
    return "playoff"


def stage_of(name):
    """'Round Robin Match 3' -> 'Round Robin'; 'Finals Match 1' -> 'Finals'."""
    return re.sub(r"\s*(Match)?\s*\d+\s*$", "", name).strip() or name


def alliances_of(data):
    """All playoff alliances, from every alliances_<round> list the site publishes.
    An alliance keeps its four teams through the playoffs; "rounds" lists the rounds it is in."""
    out = {}
    for key, lst in data.items():
        if not key.startswith("alliances_") or not isinstance(lst, list):
            continue
        rnd = key[len("alliances_"):]
        for a in lst:
            members = [a.get(k) for k in ("captain", "pick1", "pick2", "pick3")]
            members = [x for x in members if x and x.get("team")]
            if not members:
                continue
            name = a.get("name") or members[0].get("allianceNameLong") or ""
            num = re.search(r"(\d+)\s*$", name)
            al = out.setdefault(name, {
                "n": int(num.group(1)) if num else len(out) + 1,
                "name": name,
                "teams": [x["team"]["country"] for x in members],
                "rounds": [],
            })
            if rnd not in al["rounds"]:
                al["rounds"].append(rnd)
            # Standing within that round (alliances_round_robin: the playoff ranking that
            # decides the top three for the finals).
            if isinstance(a.get("rank"), int):
                al.setdefault("rank", {})[rnd] = a["rank"]
    return sorted(out.values(), key=lambda a: a["n"])


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--source", default="/", help="page path on results.first.global (default: /)")
    ap.add_argument("--out", default=os.path.join(ROOT, "data.js"), help="output file (default: data.js)")
    ap.add_argument("--force", action="store_true", help="write even if the schedule is unchanged (refreshes played flags)")
    args = ap.parse_args()
    html = get(BASE + args.source).decode("utf-8")
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        sys.exit("Could not find __NEXT_DATA__ on the results page; the site layout changed.")
    data = json.loads(m.group(1))["props"]["pageProps"]["data"]

    # Teams: names exactly as published by FIRST Global.
    teams = {}
    for r in data.get("rankings", []):
        t = r["team"]
        teams[t["country"]] = {"name": t["name"], "cc": t["countryCode"]}
    alliances = alliances_of(data)
    # A team missing from the rankings (it happens on past events) still has its published
    # name on its alliance entry.
    for key, lst in data.items():
        if key.startswith("alliances_") and isinstance(lst, list):
            for a in lst:
                for k in ("captain", "pick1", "pick2", "pick3"):
                    t = (a.get(k) or {}).get("team")
                    if t and t["country"] not in teams:
                        teams[t["country"]] = {"name": t["name"], "cc": t["countryCode"]}
    for mt in data["matches"]:
        for p in mt["participants"]:
            if p["country"] not in teams:
                sys.exit(f"Team {p['country']} appears in a match but has no published name.")

    for a in alliances:
        for c in a["teams"]:
            if c not in teams:
                sys.exit(f"Team {c} is in {a['name']} but has no published name.")

    os.makedirs(FLAG_DIR, exist_ok=True)
    missing = []
    for code, t in sorted(teams.items()):
        cc = t.pop("cc").lower()
        fname = SPECIAL_FLAGS.get(cc, cc) + ".svg"
        path = os.path.join(FLAG_DIR, fname)
        png = os.path.join(ROOT, "flags", fname[:-4] + ".png")
        # A flag already rendered to flags/ is not downloaded again (keeps timed refreshes fast).
        if not os.path.exists(png):
            missing.append(fname[:-4])
        if not os.path.exists(path) and not os.path.exists(png):
            svg = get(f"{BASE}/static/flags/4x3/{fname}")
            if b"<svg" not in svg[:2000]:
                sys.exit(f"Flag for {code} ({fname}) is not an SVG.")
            with open(path, "wb") as f:
                f.write(svg)
        t["flag"] = "flags/" + fname[:-4] + ".png"
        # Display name: the published name minus the generic "Team " prefix, for country
        # teams only (special teams such as "Team Hope (Refugees)" keep their full name).
        if cc not in SPECIAL_FLAGS and t["name"].startswith("Team "):
            t["country"] = t["name"][len("Team "):]

    matches = []
    for mt in data["matches"]:
        num = re.search(r"(\d+)\s*$", mt["name"])
        ps = sorted(mt["participants"], key=lambda p: p["station"])
        kind = match_type(mt["name"])
        matches.append({
            "id": f"{mt['tournamentKey']}-{mt['id']}",
            "type": kind,
            "number": int(num.group(1)) if num else mt["id"],
            "name": mt["name"],
            "field": mt["field"],
            "time": mt["scheduledTime"],
            "red": [p["country"] for p in ps if p["station"] < 20],
            "blue": [p["country"] for p in ps if p["station"] > 20],
        })
        if kind == "playoff":
            matches[-1]["stage"] = stage_of(mt["name"])
        if mt.get("played"):
            matches[-1]["played"] = True
    matches.sort(key=lambda x: (x["time"], x["field"], x["id"]))

    event_key = data["matches"][0]["eventKey"] if data["matches"] else "FGC"
    fetched = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    teams = dict(sorted(teams.items()))
    # Revision: changes only when the schedule, teams or alliances change, not on every fetch nor
    # when a match is played (volunteers mark those themselves). The app compares it to tell a
    # new schedule from the one it already has.
    sched = [{k: v for k, v in m.items() if k != "played"} for m in matches]
    # Alliance standings move with every playoff score; only the finals line-up counts.
    als = [{k: v for k, v in a.items() if k != "rank"} for a in alliances]
    rev = hashlib.sha1(json.dumps([teams, sched, als], sort_keys=True,
                                  ensure_ascii=False).encode("utf-8")).hexdigest()[:10]
    out = {
        "event": {"id": event_key, "name": "2026 FIRST Global Challenge", "tz": "Asia/Seoul",
                  "source": f"results.first.global, fetched {fetched}", "rev": rev},
        "teams": teams,
        "matches": matches,
        "alliances": alliances,
    }
    if args.source != "/":
        out["event"]["name"] = f"Rehearsal: {args.source}"
    old = open(args.out, encoding="utf-8").read() if os.path.exists(args.out) else ""
    playoffs = [m for m in matches if m["type"] == "playoff"]
    summary = (f"{len(teams)} teams, {len(matches)} matches ({len(playoffs)} playoff, "
               f"{sum(1 for m in playoffs if m.get('played'))} played), {len(alliances)} alliances")
    if f'"rev": "{rev}"' in old and not args.force:
        print(f"No change (rev {rev}): {summary}")
    else:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write("/* Generated by tools/fetch_fgc_data.py from results.first.global. Do not edit by hand. */\n")
            f.write("self.FGC_DATA = ")
            json.dump(out, f, ensure_ascii=False, indent=0)
            f.write(";\n")
        print(f"Written (rev {rev}): {summary}")
        for a in alliances:
            print(f"  {a['name']}: {', '.join(a['teams'])}  [{', '.join(a['rounds'])}]")
    if missing:
        print(f"Flags not yet rendered: {', '.join(missing)}. Now run: node tools/rasterize_flags.mjs")
        sys.exit(3)


if __name__ == "__main__":
    main()
