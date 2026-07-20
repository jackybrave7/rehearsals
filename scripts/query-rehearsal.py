import sqlite3
import sys

rid = sys.argv[1] if len(sys.argv) > 1 else "5a7f792c-1513-4022-8fc2-31d83d34876b"
db = sqlite3.connect("/var/www/rehearsals/data/rehearsals.db")
c = db.cursor()
r = c.execute(
    "SELECT id, date, start_time, scene_ids FROM rehearsals WHERE id=?",
    (rid,),
).fetchone()
print("rehearsal", r)
n = c.execute(
    "SELECT COUNT(*) FROM schedule_blocks WHERE rehearsal_id=?",
    (rid,),
).fetchone()[0]
print("blocks", n)
rows = c.execute(
    "SELECT id, title, type, block_order FROM schedule_blocks WHERE rehearsal_id=? ORDER BY block_order",
    (rid,),
).fetchall()
for row in rows:
    print(row)
