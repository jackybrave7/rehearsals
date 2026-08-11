import json
import sqlite3

db = sqlite3.connect("/var/www/rehearsals/data/rehearsals.db")
c = db.cursor()

plays = c.execute(
    "SELECT id, title, document_url, google_document_id, script_file_name FROM plays WHERE title LIKE '%омет%' OR title LIKE '%Комет%'"
).fetchall()
print("plays:", plays)

for play_id, title, *_ in plays:
    print(f"\n=== {title} ({play_id}) ===")
    scenes = c.execute(
        "SELECT id, title, scene_order, script_anchor FROM scenes WHERE play_id=? ORDER BY scene_order, title",
        (play_id,),
    ).fetchall()
    print("scene count:", len(scenes))
    for s in scenes:
        print(" ", s)
