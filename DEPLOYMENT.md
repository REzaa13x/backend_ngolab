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
3. Start the app so compatibility checks in `src/db/db.ts` can verify the remaining tables.
4. Check `/health` and the authenticated admin API.

Backup command:

```bash
npm run backup:db
```

The host must have `mysqldump` installed and `DB_BACKUP_DIR` writable.

## Storage and realtime

`public/uploads` must be a persistent volume or be replaced with object storage before using an ephemeral container. Configure the reverse proxy to forward WebSocket upgrades for Socket.io.

## Release gate

- HTTPS works.
- `/health` returns `{"status":"ok"}`.
- Login works.
- KDS receives `new_order` and `order_updated`.
- Both outlet inventory screens show the correct outlet.
- PO photo upload persists after restart.
- Database backup and restore have been tested.
