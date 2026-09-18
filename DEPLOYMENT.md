# Deployment checklist

## Build and start

```bash
npm ci
npm run lint
npm test
npm run build
NODE_ENV=production npm start
```

The server serves the Vite build and API from the same process. Set `PORT` in the hosting environment.

## Required production variables

```env
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.example
CORS_ORIGIN=https://your-domain.example
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USER=gesture_eats_app
DB_PASSWORD=strong-password
DB_NAME=gesture_eats
AUTH_TOKEN_SECRET=at-least-32-random-characters
SMART_TAG_API_URL=https://smart-tag-production.example
```

Do not use `192.168.x.x`, `localhost`, or the database root user in production.

## Database

1. Take a backup before changing schema.
2. Run `migrations/001_recipe_outlet.sql` once.
3. Run `migrations/002_order_item_name_compatibility.sql` once when the database is shared with the cashier application; it keeps both `item_name` and `menu_name` compatible.
4. Run `migrations/003_loyalty_order_idempotency.sql` once to prevent duplicate cashback for the same order.
5. Start the app so compatibility checks in `src/db/db.ts` can verify the remaining tables.
6. Check `/health` and the authenticated admin API.

Backup command:

```bash
npm run backup:db
```

The host must have `mysqldump` installed and `DB_BACKUP_DIR` writable.

## Storage and realtime

Payment proofs are stored OUTSIDE the project root, because the project root itself is served as
static files (by Vite in development, by `express.static` in production). Path-based URL
authorization is not a defence: percent-encoded forms (`%73torage`), backslashes, NTFS 8.3 short
names (`paymen~1`, `%7E`), traversal and Vite's `/@fs/` rung all reach files a URL check does not
recognize. Physical separation is the only reliable guarantee.

```env
PAYMENT_PROOF_PATH=../user_billing
```

A relative value is resolved against the project root. The app refuses to start when the resolved
directory is inside the project root, so a misconfiguration fails closed instead of silently
exposing proofs. When the variable is unset the app falls back to a sibling directory outside the
root. On hosts that swap releases through a symlink (`current -> releases/<ts>`), `process.cwd()`
changes on every deploy, so this MUST point outside the release tree or proofs uploaded before a
deploy become unreadable. Legacy files previously written to `public/uploads/payment-proofs` are
moved into the configured directory automatically on startup.

`/uploads` serves a whitelist of known public upload directories only; anything else is answered
with 404 JSON, so missing files never fall through to the SPA fallback as HTTP 200 HTML.

Both `public/uploads` and the payment-proof directory must be persistent volumes or be replaced with object storage before using an ephemeral container. Configure the reverse proxy to forward WebSocket upgrades for Socket.io.

## Release gate

- HTTPS works.
- `/health` returns `{"status":"ok"}`.
- Login works.
- KDS receives `new_order` and `order_updated`.
- Both outlet inventory screens show the correct outlet.
- PO photo upload persists after restart.
- Payment proof upload persists across a release swap and is only readable with a staff token.
- Database backup and restore have been tested.
