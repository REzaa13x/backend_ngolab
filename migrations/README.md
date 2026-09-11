# Database migrations

The application currently keeps compatibility migrations in `src/db/db.ts` so an existing local database can start safely. For production, review and run the SQL files in this directory during deployment before starting the server.

Run migrations against a backup first. Never run them against production for the first time without a rollback/restore plan.
