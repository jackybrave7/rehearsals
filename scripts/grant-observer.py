import json
import sqlite3
from datetime import datetime, timezone

db_path = '/var/www/rehearsals/data/rehearsals.db'
theater_id = 'f5a4af3d-feb5-4536-a059-a9c563f55c27'  # ШАИ онлайн - Бетта (Чайка)
target_email = 'evgeny.alferov@gmail.com'
role = 'observer'

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

user = conn.execute('SELECT id, email, name FROM users WHERE email = ?', (target_email,)).fetchone()
if not user:
    raise SystemExit(f'USER_NOT_FOUND: {target_email}')

theater = conn.execute('SELECT id, name FROM theaters WHERE id = ?', (theater_id,)).fetchone()
if not theater:
    raise SystemExit(f'THEATER_NOT_FOUND: {theater_id}')

existing = conn.execute(
    'SELECT role FROM theater_members WHERE theater_id = ? AND user_id = ?',
    (theater_id, user['id']),
).fetchone()
if existing:
    conn.execute(
        'UPDATE theater_members SET role = ? WHERE theater_id = ? AND user_id = ?',
        (role, theater_id, user['id']),
    )
else:
    conn.execute(
        'INSERT INTO theater_members (theater_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
        (theater_id, user['id'], role, datetime.now(timezone.utc).isoformat()),
    )
conn.commit()

membership = conn.execute(
    """
    SELECT u.email, tm.role, t.name AS theaterName
    FROM theater_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN theaters t ON t.id = tm.theater_id
    WHERE u.email = ?
    """,
    (target_email,),
).fetchall()
print('OK', json.dumps([dict(row) for row in membership], ensure_ascii=False))
