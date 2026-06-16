import Database from 'better-sqlite3';

const dbPath = process.argv[2] ?? '/app/data/rehearsals.db';
const db = new Database(dbPath, { readonly: true });

const users = db
  .prepare(
    `SELECT id, email, name FROM users WHERE email LIKE '%evgeny%' OR email LIKE '%alferov%' OR email LIKE '%gmai%'`
  )
  .all();

console.log('USERS', JSON.stringify(users, null, 2));

for (const user of users) {
  const memberships = db
    .prepare(
      `SELECT tm.role, t.id AS theaterId, t.name AS theaterName
       FROM theater_members tm
       JOIN theaters t ON t.id = tm.theater_id
       WHERE tm.user_id = ?`
    )
    .all(user.id);
  console.log(`MEMBERSHIPS_${user.email}`, JSON.stringify(memberships, null, 2));
}

const allMembers = db
  .prepare(
    `SELECT u.email, tm.role, t.name AS theaterName
     FROM theater_members tm
     JOIN users u ON u.id = tm.user_id
     JOIN theaters t ON t.id = tm.theater_id
     ORDER BY u.email`
  )
  .all();

console.log('ALL_MEMBERS', JSON.stringify(allMembers, null, 2));
