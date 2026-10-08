#!/usr/bin/env python3
"""Generate a DEMO data.js with placeholder teams (NOT real country data).

The real data.js must be produced from https://results.first.global/ — see README.
"""
import json, random
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
random.seed(2026)
N_TEAMS = 190
teams = {f"T{i:03d}": {"name": f"Demo Team {i:03d}", "flag": ""} for i in range(1, N_TEAMS + 1)}
codes = list(teams)

CYCLE = 6  # minutes between matches on field 3 (and on each side-field pair)
matches = []
num = {"practice": 0, "ranking": 0, "playoff": 0}

def block(mtype, start, slots, fields_fn):
    pool = []
    t = start
    for s in range(slots):
        for unit, field in fields_fn(s):
            if len(pool) < 6:
                nxt = codes[:]
                random.shuffle(nxt)
                pool += nxt
            six, pool[:] = pool[:6], pool[6:]
            num[mtype] += 1
            matches.append({
                "type": mtype, "number": num[mtype], "field": field,
                "time": t.isoformat(), "red": six[:3], "blue": six[3:],
            })
        t += timedelta(minutes=CYCLE)

all_fields = lambda s: [("12", 1 + s % 2), ("3", 3), ("45", 4 + s % 2)]
# Practice day, two ranking days, playoffs on field 3 only.
block("practice", datetime(2026, 10, 7, 9, 0, tzinfo=KST), 40, all_fields)
for day in (8, 9):
    block("ranking", datetime(2026, 10, day, 9, 0, tzinfo=KST), 45, all_fields)
    block("ranking", datetime(2026, 10, day, 13, 30, tzinfo=KST), 40, all_fields)
block("playoff", datetime(2026, 10, 10, 10, 0, tzinfo=KST), 16, lambda s: [("3", 3)])

data = {
    "event": {"id": "fgc2026-demo", "name": "FIRST Global Challenge 2026 — DEMO DATA",
              "tz": "Asia/Seoul", "demo": True,
              "source": "Synthetic placeholder schedule (not from results.first.global)"},
    "teams": teams,
    "matches": matches,
}
with open("data.js", "w", encoding="utf-8") as f:
    f.write("/* Generated file. See README for how to regenerate from results.first.global. */\n")
    f.write("window.FGC_DATA = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print(len(matches), "matches")
