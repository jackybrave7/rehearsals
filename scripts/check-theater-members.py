import sqlite3

rid = "92d5052c-2105-4c63-99ba-c5f29cbe2006"
db = sqlite3.connect("/var/www/rehearsals/data/rehearsals.db")
c = db.cursor()
tid = c.execute("SELECT theater_id FROM rehearsals WHERE id=?", (rid,)).fetchone()[0]
print("theater_id", tid)
for row in c.execute(
    "SELECT tm.user_id, tm.role, u.email FROM theater_members tm JOIN users u ON u.id=tm.user_id WHERE tm.theater_id=?",
    (tid,),
):
    print(row)
