import json
import sqlite3

db = sqlite3.connect("/var/www/rehearsals/data/rehearsals.db")
c = db.cursor()
pid = "a19c6651-1547-406a-a3ec-fddd1d7a120d"
for row in c.execute(
    "SELECT number, title, script_anchor FROM scenes WHERE play_id=? ORDER BY number",
    (pid,),
):
    anchor = json.loads(row[2]) if row[2] else None
    print(row[0], row[1], anchor)
