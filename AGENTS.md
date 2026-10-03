# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Театральный планировщик репетиций ("Репетиции"). React 19 + Vite 8 SPA frontend that talks to an Express 4 + SQLite backend. Data lives in server-side SQLite at `data/rehearsals.db`; the frontend does not load without the API running.

### Services
Two dev services run together via `npm run dev` (concurrently):
- Web (Vite): http://127.0.0.1:3003 (fixed `strictPort`; Vite proxies `/api` → `:3001`)
- API (Express + SQLite): http://localhost:3001 (`API_PORT`, default 3001)

Standard scripts live in `package.json` (`dev`, `dev:web`, `dev:api`, `build`, `start`, `test`, `lint`). Run the app with `npm run dev`, not the production `npm start`/`npm run build`.

### Non-obvious caveats
- SQLite uses Node's built-in `node:sqlite` (`DatabaseSync`). It prints an `ExperimentalWarning: SQLite is an experimental feature` on startup — this is harmless, not an error.
- The DB auto-creates and self-migrates on first API start (`server/db.ts` runs `schema.sql` + idempotent inline migrations). No manual migration step.
- On `npm run dev`, the web server boots faster than the API, so you'll briefly see `[vite] http proxy error: /api/auth/me ECONNREFUSED` until the API finishes starting. Not a real failure.
- Registration (`POST /api/auth/register`) returns `503 MAIL_NOT_CONFIGURED` unless SMTP env vars are set, and login requires a verified email (`email_verified_at`). To test logged-in flows locally without SMTP, seed a verified user directly in `data/rehearsals.db` (insert into `users` with `email_verified_at` and `registration_approved_at` set; password hash format is `salt:scryptSync(password, salt, 64)` hex, see `hashPassword` in `server/auth.ts`). Default registration mode is `normal`, so no admin approval is needed once the email is verified.
- All third-party integrations are optional and off by default: Telegram (`TELEGRAM_BOT_TOKEN`), Google Docs OAuth, S3, SMTP. The reminder scheduler and Telegram poller start in-process but no-op without a bot token.
- `lint` currently reports many pre-existing errors in `src/` (unrelated to environment setup); the linter itself works.
