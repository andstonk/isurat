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

## Manual SQL fallback

If the Retry button path is ever insufficient (e.g. a video is wedged in a state the API won't accept), reset it directly from the SQL editor, then use Retry from the UI:

```sql
update videos
set status = 'failed', error_message = 'Manually reset — see runbook', updated_at = now()
where id = '<video-id>';
```

Never manually set `status = 'ready'` without also ensuring `subtitle_cues` rows actually exist for that video — the editor and export routes assume a `ready` video has cues.
