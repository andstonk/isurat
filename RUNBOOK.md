# Runbook: Failed and Stuck Processing Jobs

## Recognizing a problem

A video's `status` column (`videos` table) moves through `uploading -> queued -> processing -> ready`, or to `failed` if transcription errors out.

- **Failed**: `status = 'failed'`. The dashboard shows a red status chip and the `error_message` column inline under the file name.
- **Stuck**: `status = 'processing'` but it's been stuck there for a long time. `POST /api/jobs/process` (`src/app/api/jobs/process/route.ts`) has `maxDuration = 300` (5 minutes) — if the Vercel function is killed mid-run (timeout, crash, deploy), the video is left in `processing` forever with no automatic recovery. The dashboard treats a video as stuck once `updated_at` is more than 6 minutes old while `status = 'processing'` (see `isStuckProcessing` in `src/app/dashboard/page.tsx`).

## Recovering from the UI

The dashboard shows a **Retry** button for any video that is `failed`, and a **Retry (stuck)** button for one detected as stuck. Both call `POST /api/jobs/process` with the video's ID, which:

1. Re-validates the video is owned by the requesting user and in an eligible state (`queued`, `failed`, or stuck `processing`).
2. Resets `status` to `processing` and clears `error_message`.
3. Re-downloads the source video from Azure Blob Storage, re-runs Soniox transcription (and translation, if configured), and re-inserts subtitle cues on success.
4. On failure, sets `status = 'failed'` with the new `error_message`, and writes an entry to `error_logs` (see below).

This is the same code path used for the original processing attempt — there is no separate "retry" implementation to maintain.

## Diagnosing root cause via `error_logs`

`src/lib/error-log.ts`'s `logError()` writes a row to the `error_logs` table (added in `supabase/migrations/007_add_error_logs.sql`) whenever the upload, transcription, or subtitle-save flow throws. It's service-role only (no RLS policies), so query it from the Supabase SQL editor or table view:

```sql
-- Most recent errors for a specific video
select created_at, route, message, stack, metadata
from error_logs
where video_id = '<video-id>'
order by created_at desc;

-- Most recent errors across all videos, e.g. after a deploy
select created_at, route, video_id, message
from error_logs
order by created_at desc
limit 50;
```

`route` tells you which of the three instrumented flows failed:

- `POST /api/uploads` — upload initialization (Azure SAS URL / DB row creation) failed.
- `POST /api/jobs/process` — transcription/translation failed (Soniox, Azure download, or cue insert). This is the most common source of `failed` videos.
- `PUT /api/videos/[id]/subtitles` — saving edited subtitles failed (DB insert/update failed).

## Phase 3 manual check (version history and share links)

The collaboration features added in `009_add_collaboration.sql` talk to the database on every path, and there is no automated test suite. After applying migration `009`, walk this once against a real project:

1. **Snapshot** — open a project, edit a cue, open **History**, name a snapshot, save it. Confirm the snapshot's cue count matches the editor and that the edit was persisted first (the panel saves before snapshotting).
2. **Restore** — change several cues, save, then restore the earlier snapshot. The editor should reload with the old cues, and a new `Before restoring "…"` snapshot should appear at the top of the list.
3. **Undo a restore** — restore that `Before restoring …` entry. This is the recovery path that replaces database intervention; if it fails, treat it as a release blocker.
4. **Pruning** — a project keeps only its 20 most recent snapshots (`MAX_VERSIONS_PER_PROJECT` in `src/lib/collaboration.ts`). Confirm the oldest disappears rather than the insert failing.
5. **Share link** — create a 7-day link, open it in a private window with no session. The video, styled captions (including custom fonts), and cue list should render with no editing controls.
6. **Revoke** — revoke the link and reload the shared page. It should show "This link was turned off", not the project.
7. **Expiry** — to test expiry without waiting, set `expires_at` into the past directly:
   ```sql
   update share_links set expires_at = now() - interval '1 day' where id = '<link-id>';
   ```
   The shared page should then show the expired state.

Useful queries:

```sql
-- Snapshot history for a project (payload omitted; `cues` is large)
select id, label, created_at, cue_count from project_versions
where video_id = '<video-id>' order by created_at desc;

-- Live share links and their usage
select id, created_at, expires_at, revoked_at, view_count, last_viewed_at
from share_links where video_id = '<video-id>' order by created_at desc;
```

`share_links.token_hash` holds only a SHA-256 hash — the raw token is shown once at creation and cannot be recovered from the database. If a viewer loses their link, revoke it and create a new one.

## Manual SQL fallback

If the Retry button path is ever insufficient (e.g. a video is wedged in a state the API won't accept), reset it directly from the SQL editor, then use Retry from the UI:

```sql
update videos
set status = 'failed', error_message = 'Manually reset — see runbook', updated_at = now()
where id = '<video-id>';
```

Never manually set `status = 'ready'` without also ensuring `subtitle_cues` rows actually exist for that video — the editor and export routes assume a `ready` video has cues.
