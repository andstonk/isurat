# Database Migration Checklist

This project has no Supabase CLI project link and no automated migration runner. Migrations in `supabase/migrations/` are plain SQL files, applied by pasting their contents into the Supabase SQL editor, in filename order (`001_...` before `002_...`, etc.), as described in `README.md`.

This checklist is the validation process to follow every time a new migration file is added, until (if ever) that changes.

**Note on the numbering gap:** there is no `008` on `main`. `008_add_subscriptions.sql` is part of the billing work parked in a `git stash` (see `ROADMAP.md`, "Monetization: Payment Tiers"), so `009_add_collaboration.sql` follows `007`. The gap is deliberate — it keeps the stashed file applicable unchanged if billing is ever restored. Apply the files that exist, in filename order; a missing number is not a missing migration.

## 1. Local validation

Use a scratch Supabase project (not shared, not staging/prod) for this step.

- Apply every existing migration in order, then the new one, on a clean project. Confirm each statement runs without error.
- Re-run the new migration file a second time. Every statement in this repo's migrations uses `if not exists` / `if exists` guards (see existing files for the pattern) — re-running should be a no-op, not an error. If your new migration doesn't follow that pattern, fix it before moving on.
- If the migration touches `videos` or `subtitle_cues`, exercise the affected app flow locally against this scratch project (upload, edit, save, export) to confirm the app still works end-to-end.
- Spot-check Row Level Security: confirm a browser (anon/publishable key) client still cannot read/write the new/changed table or columns, and that server routes using the service role key (`createAdminSupabase()` in `src/lib/supabase.ts`) still work. New tables should default to `enable row level security` with no public policies added, matching every table in this project so far.

## 2. Staging validation

- Apply the migration to a staging Supabase project.
- Point a staging deployment (or local dev pointed at staging env vars) at it and run the same affected flow end-to-end.
- Confirm `pnpm lint` and `pnpm build` still pass (CI does this automatically on every push/PR — see `.github/workflows/ci.yml`).

## 3. Production

- Apply during a low-traffic window.
- Have the rollback SQL for the migration written down before applying (see template below) — don't improvise a rollback under pressure.
- After applying, run a quick smoke check: a `select` against the new/changed table/columns from the SQL editor, and one real pass through the affected app flow in production.
- Update `README.md`'s migration list (the numbered list under "Create the Supabase table") to include the new file.

## New migration template

For every new migration file, document this alongside the PR/commit that adds it (in the commit message or a code comment at the top of the file):

```
Forward: <what the migration does, one or two lines>
Rollback: <the SQL to undo it, or "not reversible — see note" if genuinely irreversible>
```

### Worked example: `007_add_error_logs.sql`

```
Forward: creates the error_logs table (RLS enabled, no public policies — service-role only)
         used by src/lib/error-log.ts to record failures from the upload, transcription,
         and subtitle-save flows.
Rollback: drop table if exists public.error_logs;
```
