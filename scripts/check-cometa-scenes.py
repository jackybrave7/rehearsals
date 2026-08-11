import json
import sqlite3

db = sqlite3.connect("/var/www/rehearsals/data/rehearsals.db")
c = db.cursor()

plays = c.execute(
    "SELECT id, title, document_url, script_file_name, google_document_id FROM plays WHERE title LIKE '%омет%' OR title LIKE '%Комет%'"
).fetchall()
print("plays:", plays)

for play_id, title, *_ in plays:
    print("\n===", title, play_id, "===")
    scenes = c.execute(
        "SELECT id, title, scene_order, script_anchor FROM scenes WHERE play_id=? ORDER BY scene_order",
        (play_id,),
    ).fetchall()
    for s in scenes:
        anchor = json.loads(s[3]) if s[3] else None
        print(s[2], s[1], anchor)
