import json
import sqlite3

db = sqlite3.connect("/var/www/rehearsals/data/rehearsals.db")
c = db.cursor()
pid = "a19c6651-1547-406a-a3ec-fddd1d7a120d"
play = c.execute(
    "SELECT script_google_scene_anchors FROM plays WHERE id=?",
    (pid,),
).fetchone()
print("script_google_scene_anchors:", play[0] if play else None)
if play and play[0]:
    for i, item in enumerate(json.loads(play[0])):
        print(i, item)

print()
for row in c.execute(
    "SELECT number, title, script_anchor FROM scenes WHERE play_id=? ORDER BY number",
    (pid,),
):
    anchor = json.loads(row[2]) if row[2] else None
    print(row[0], row[1], anchor)
