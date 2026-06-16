import json
import sqlite3
import sys

db_path = sys.argv[1] if len(sys.argv) > 1 else '/var/www/rehearsals/data/rehearsals.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

users = conn.execute(
    """
    SELECT id, email, name FROM users
    WHERE email LIKE '%evgeny%' OR email LIKE '%alferov%' OR email LIKE '%gmai%'
    """
).fetchall()
print('USERS', json.dumps([dict(row) for row in users], ensure_ascii=False))

for user in users:
    memberships = conn.execute(
        """
        SELECT tm.role, t.id AS theaterId, t.name AS theaterName
        FROM theater_members tm
        JOIN theaters t ON t.id = tm.theater_id
        WHERE tm.user_id = ?
        """,
        (user['id'],),
    ).fetchall()
    print(
        f"MEMBERSHIPS_{user['email']}",
        json.dumps([dict(row) for row in memberships], ensure_ascii=False),
    )

all_members = conn.execute(
    """
    SELECT u.email, tm.role, t.name AS theaterName
    FROM theater_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN theaters t ON t.id = tm.theater_id
    ORDER BY u.email
    """
).fetchall()
print('ALL_MEMBERS', json.dumps([dict(row) for row in all_members], ensure_ascii=False))

plays = conn.execute(
    """
    SELECT t.name AS theaterName, p.title AS playTitle, t.id AS theaterId
    FROM plays p
    JOIN theaters t ON t.id = p.theater_id
    ORDER BY t.name, p.title
    """
).fetchall()
print('PLAYS', json.dumps([dict(row) for row in plays], ensure_ascii=False))
