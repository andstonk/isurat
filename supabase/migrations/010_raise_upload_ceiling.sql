-- Raises the videos.file_size ceiling from 25 MB to 100 MB so an allowlisted user can upload
-- larger videos. The *default* per-user limit is still 25 MB and is enforced in the API
-- (src/lib/upload-limits.ts); this constraint is only the outer bound the database will accept.
--
-- 100 MB, not more, because POST /api/jobs/process holds the whole video in memory, writes it to
-- Vercel's 512 MB /tmp, transcodes it, and reads it back — all inside a 5-minute maxDuration that
-- also covers transcription. Raise this only alongside moving processing off the request.
--
-- Forward: replaces the inline check constraint created in 002_create_subtitle_mvp.sql
--          (file_size <= 26214400) with the same check at 104857600 bytes.
-- Rollback: alter table public.videos drop constraint if exists videos_file_size_check;
--           alter table public.videos add constraint videos_file_size_check
--             check (file_size > 0 and file_size <= 26214400);
--           -- Rows larger than 25 MB must be deleted first or the constraint will not validate.

-- Postgres auto-named the inline constraint from 002 `videos_file_size_check`. Dropping before
-- adding keeps this file re-runnable, per MIGRATIONS.md.
alter table public.videos drop constraint if exists videos_file_size_check;

alter table public.videos
  add constraint videos_file_size_check check (file_size > 0 and file_size <= 104857600);
