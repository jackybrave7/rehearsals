import glob
import json
import os
import sqlite3

rid = "92d5052c-2105-4c63-99ba-c5f29cbe2006"
db = sqlite3.connect("/var/www/rehearsals/data/rehearsals.db")
c = db.cursor()
r = c.execute(
    "SELECT id, date, start_time, theater_id, scene_ids, task_ids FROM rehearsals WHERE id=?",
    (rid,),
).fetchone()
print("rehearsal", r)
print("blocks", c.execute("SELECT COUNT(*) FROM schedule_blocks WHERE rehearsal_id=?", (rid,)).fetchone()[0])

backups = sorted(glob.glob("/var/www/rehearsals/data/backups/*.json"), key=os.path.getmtime, reverse=True)
found = 0
for path in backups:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for rehearsal in data.get("rehearsals", []):
        if rehearsal.get("id") == rid:
            n = len(rehearsal.get("schedule", []))
            if n > 0:
                print("FOUND", os.path.basename(path), "schedule", n)
                found += 1
print("backups with schedule:", found, "of", len(backups))
