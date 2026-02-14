# Database Migrations

This document describes the minimal SQL migration system for Careconnect.

## Overview

The migration system provides:
- ✅ Ordered SQL migration execution
- ✅ Migration tracking in `schema_migrations` table
- ✅ Idempotent operations (safe to run multiple times)
- ✅ Bootstrap from existing schema
- ✅ Status monitoring
- ✅ No ORM dependencies (uses `pg` library only)

## File Structure

```
backend/
├── database/
│   ├── migrations/
│   │   ├── 20260213_01_payment_status_enum.sql
│   │   ├── 20260213_02_create_payments_table.sql
│   │   ├── 20260213_03_ledger_transactions_unique_index.sql
│   │   └── 20260214_01_initial_schema.sql
│   └── schema.sql
└── scripts/
    └── migrate.js
```

## Migration Files

### Naming Convention
- Format: `YYYYMMDD_NN_description.sql`
- Example: `20260214_01_initial_schema.sql`
- Files are executed in alphabetical order

### File Content
- Plain SQL files
- Use `IF NOT EXISTS` for idempotency
- Include comments for documentation
- End with `COMMIT;` for transaction safety

## Available Commands

### Run Pending Migrations
```bash
npm run migrate
# or
node scripts/migrate.js migrate
```

### Check Migration Status
```bash
npm run migrate:status
# or
node scripts/migrate.js status
```

### Bootstrap Initial Schema
```bash
npm run migrate:bootstrap
# or
node scripts/migrate.js bootstrap
```

## Usage Examples

### Initial Setup
For a fresh database:

```bash
# 1. Bootstrap the initial schema
npm run migrate:bootstrap

# 2. Run any pending migrations
npm run migrate

# 3. Check status
npm run migrate:status
```

### Adding New Migrations

1. Create new migration file:
   ```bash
   # Format: YYYYMMDD_NN_description.sql
   touch backend/database/migrations/20260214_02_add_user_preferences.sql
   ```

2. Add SQL content:
   ```sql
   -- Add user preferences table
   CREATE TABLE IF NOT EXISTS user_preferences (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       preferences JSONB NOT NULL DEFAULT '{}',
       created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
       UNIQUE(user_id)
   );

   -- Add indexes
   CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

   -- Add trigger for updated_at
   CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   COMMIT;
   ```

3. Run migration:
   ```bash
   npm run migrate
   ```

### Checking Status
```bash
$ npm run migrate:status

📊 Migration Status:
==================
✅ APPLIED 20260213_01_payment_status_enum.sql
✅ APPLIED 20260213_02_create_payments_table.sql
✅ APPLIED 20260213_03_ledger_transactions_unique_index.sql
⏳ PENDING 20260214_01_initial_schema.sql

Summary: 3 applied, 1 pending
```

## Docker Integration

The migration system is integrated with Docker Compose:

```yaml
# docker-compose.prod.yml
services:
  migrate:
    build: ./backend
    command: npm run migrate
    depends_on:
      postgres:
        condition: service_healthy
```

Run migrations with Docker:
```bash
# Production
docker-compose --profile migrate up migrate

# Or run manually
docker-compose exec backend npm run migrate
```

## Environment Variables

The migration runner uses the same database configuration as the application:

```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=careconnect
DATABASE_USER=careconnect
DATABASE_PASSWORD=your_password
```

## Migration Tracking

Migrations are tracked in the `schema_migrations` table:

```sql
SELECT * FROM schema_migrations ORDER BY filename;
```

Output:
```
 id |                filename                |          applied_at          
----+------------------------------------------+----------------------------
  1 | 20260213_01_payment_status_enum.sql    | 2024-02-14 10:30:00.123+00
  2 | 20260213_02_create_payments_table.sql   | 2024-02-14 10:30:00.456+00
  3 | 20260213_03_ledger_transactions_unique_index.sql | 2024-02-14 10:30:00.789+00
```

## Best Practices

### ✅ Do
- Use `IF NOT EXISTS` for all DDL statements
- Include descriptive comments
- End files with `COMMIT;`
- Test migrations on development first
- Use timestamp prefixes for ordering

### ❌ Don't
- Include `DROP` statements (destructive)
- Use `UPDATE` or `DELETE` on critical tables
- Forget to add indexes for performance
- Mix multiple unrelated changes in one file

### 🔄 Rollback Strategy
The system doesn't support automatic rollbacks. To rollback:

1. Create a new migration file that reverses the changes
2. Apply the rollback migration
3. Test thoroughly

Example rollback migration:
```sql
-- 20260214_03_remove_user_preferences.sql
DROP TABLE IF EXISTS user_preferences;
COMMIT;
```

## Troubleshooting

### Migration Failed
```bash
❌ Failed to apply migration 20260214_01_initial_schema.sql: relation "users" already exists
```

**Solution**: Check if migration was partially applied:
```bash
npm run migrate:status
```

If the migration is marked as applied but failed, manually remove the record:
```sql
DELETE FROM schema_migrations WHERE filename = '20260214_01_initial_schema.sql';
```

Then fix the SQL and re-run.

### Database Connection Issues
```bash
❌ Failed to connect: password authentication failed
```

**Solution**: Check environment variables:
```bash
echo $DATABASE_PASSWORD
```

Ensure database is running and accessible.

### Permission Issues
```bash
❌ Permission denied: CREATE EXTENSION
```

**Solution**: Use a database with proper permissions or ask your DBA to run:
```sql
GRANT CREATE ON DATABASE careconnect TO careconnect;
```

## Migration History

| Date | Migration | Description |
|------|-----------|-------------|
| 2024-02-13 | 20260213_01_* | Payment system setup |
| 2024-02-13 | 20260213_02_* | Payments table |
| 2024-02-13 | 20260213_03_* | Ledger indexes |
| 2024-02-14 | 20260214_01_* | Complete initial schema |

## Development Workflow

1. **Make schema changes**:
   ```bash
   # Create new migration
   touch backend/database/migrations/20260214_02_my_feature.sql
   ```

2. **Write SQL**:
   ```sql
   -- My feature migration
   CREATE TABLE IF NOT EXISTS my_feature (...);
   COMMIT;
   ```

3. **Test locally**:
   ```bash
   npm run migrate
   npm run migrate:status
   ```

4. **Commit changes**:
   ```bash
   git add backend/database/migrations/20260214_02_my_feature.sql
   git commit -m "Add my feature table"
   ```

5. **Deploy**:
   ```bash
   # Docker will auto-run migrations on startup
   docker-compose up -d
   ```

This migration system provides a robust, minimal solution for database schema management without heavy dependencies.
