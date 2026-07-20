import glob
import json
import os
import sqlite3

rid = "92d5052c-2105-4c63-99ba-c5f29cbe2006"
db = sqlite3.connect("/var/www/rehearsals/data/rehearsals.db")
print("total blocks in db", db.execute("select count(*) from schedule_blocks").fetchone()[0])

backups = sorted(
    glob.glob("/var/www/rehearsals/data/backups/*.json"),
    key=os.path.getmtime,
    reverse=True,
)[:10]
print("checking", len(backups), "recent backups")
for path in backups:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for r in data.get("rehearsals", []):
        if r.get("id") == rid:
            sched = r.get("schedule", [])
            print(os.path.basename(path), "schedule len", len(sched))
            if sched:
                print("  first block:", sched[0].get("title"), sched[0].get("type"))
