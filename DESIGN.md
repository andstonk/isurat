# Design Reference

Current-state architecture reference for Subframe (package name `video-subtitle`). This describes what exists and why. For what's planned next, see `ROADMAP.md`; for operational procedures, see `MIGRATIONS.md` and `RUNBOOK.md`. Update this file when the architecture changes — it's meant to be revisited, not written once.

## Stack

- **Next.js App Router + TypeScript** — single deployable, API routes under `src/app/api/*`, pages under `src/app/*`. Deployed on Vercel.
- **Supabase (Postgres + Auth)** — system of record for users, videos, subtitle cues, fonts, and error logs. Auth is Supabase-managed (email/password, Google, GitHub).
- **Azure Blob Storage** — private storage for uploaded MP4s and uploaded font files. Browsers never talk to Supabase or Azure with long-lived credentials; they use short-lived SAS URLs (uploads) or a Supabase session JWT (API routes).
- **Soniox** — asynchronous transcription, language detection, and one-way translation, with word-level timestamps.

## Data model

Source of truth is `supabase/migrations/*.sql`, applied in numeric order (see `MIGRATIONS.md`). Summary:

- **`videos`** — one row per uploaded video. Ownership via `user_id` (FK to `auth.users`). `status` is `uploading -> queued -> processing -> ready`, or `failed`. Carries project-level subtitle style defaults (`subtitle_*`/`translation_*` columns: font, color, size, weight, backdrop, glow) added incrementally across `003`, `005`, `006`. `translation_target_language`/`translation_status` track the optional translation track.
- **`subtitle_cues`** — one row per subtitle line, FK to `videos`, unique on `(video_id, cue_index)`. Holds `start_ms`/`end_ms`, `text`, optional `translated_text`, optional `words` (jsonb array of word-level timing + style, from `005_add_karaoke_subtitles.sql`), and optional `style_override` (jsonb, from `006_add_advanced_subtitle_styles.sql`).
- **`user_fonts`** — private font uploads per user (WOFF2/WOFF/TTF/OTF), quota-limited to 50 active fonts, with archiving instead of hard delete so saved projects that reference an archived font keep working (`004_add_user_fonts.sql`).
- **`waitlist`** — pre-launch email capture, unrelated to the core product (`001_create_waitlist.sql`).
- **`error_logs`** — best-effort failure log for the upload/transcription/save flows (`007_add_error_logs.sql`). See "Error telemetry" below.

**RLS pattern, consistent across every table**: `enable row level security` with no `insert` policy. All writes go through `createAdminSupabase()` (`src/lib/supabase.ts`), which uses the service-role key and bypasses RLS entirely. Browser clients (`createBrowserSupabase()`) get `select`/`update`/`delete` policies scoped to `auth.uid() = user_id`, used only for the parts of the app that read Supabase directly (currently: none of the core flow — even reads go through API routes that use the admin client and re-check `user_id` themselves). New tables should follow this pattern unless there's a specific reason a browser client needs direct access.

## Request flows

**Upload**: `POST /api/uploads` (`src/app/api/uploads/route.ts`) validates the file (MP4, <=25MB), creates a `videos` row (`status='uploading'`), and returns an Azure SAS URL scoped to `create+write` on one blob, expiring in 15 minutes. The browser `PUT`s the file directly to Azure. `POST /api/uploads/complete` (`src/app/api/uploads/complete/route.ts`) flips `status` to `queued`, but only if it's currently `uploading` and owned by the caller — this is the guard against completing a job that was never actually uploaded.

**Processing**: `POST /api/jobs/process` (`src/app/api/jobs/process/route.ts`, `maxDuration=300`) runs synchronously inside the request: downloads the blob from Azure, uploads it to Soniox, waits for transcription (and translation, if `translation_target_language` is set), converts Soniox tokens to subtitle cues (`tokensToSubtitleCues`/`tokensToBilingualCues` in `src/lib/soniox.ts`), and writes them to `subtitle_cues`. This route is also the retry path — see "Retry and recovery" below. There is no queue; `README.md` notes that production-scale usage should move this to a background worker with a Soniox webhook instead of blocking the request.

**Edit/save**: The editor (`src/app/editor/[id]/page.tsx`, `src/components/subtitle-editor.tsx`) loads cues and settings, lets the user adjust timing/text/styling, and saves via `PUT /api/videos/[id]/subtitles` (`src/app/api/videos/.../subtitles/route.ts`), which validates every cue and style object server-side before replacing all `subtitle_cues` rows for the video and updating the project-level style columns on `videos`.

**Export**: `GET /api/videos/[id]/export?format=srt|vtt|txt&mode=original|translated|bilingual` (`src/app/api/videos/[id]/export/route.ts`) reads cues and serializes them with `toSrt`/`toVtt`/`toTxt` (`src/lib/subtitles.ts`). Text-only formats intentionally drop all styling/font/glow/karaoke data — there is no styled export format yet (that's Phase 4 on the roadmap: burned-in MP4 rendering).

## Subtitle styling cascade

Three levels, word overrides beating cue overrides beating project defaults:

1. **Project defaults** — `videos.subtitle_*` / `videos.translation_*` columns, loaded into `SubtitleSettings`/`SubtitleTrackStyle` (`src/lib/subtitles.ts`).
2. **Cue overrides** — `subtitle_cues.style_override` (jsonb, validated by `isSubtitleTrackStyle`). Applied to the cue's container element in the editor preview.
3. **Word overrides** — `subtitle_cues.words[].style` (jsonb, validated by `isSubtitleWordStyle`). Applied as an inline style on each word's `<span>`, so it visually overrides both cue and project styling.

Known gap (tracked on the roadmap, not yet fixed): `resegmentCues()` (`src/lib/subtitles.ts`) preserves word-level styles when cues are regrouped by word limit, but drops cue-level `style_override` on the regrouped cues. There is no manual split/merge feature yet, so today this is only reachable via "Apply word limit" in the editor.

## Error telemetry

`src/lib/error-log.ts`'s `logError()` writes a row to `error_logs` from the catch blocks in the upload, transcription, and subtitle-save routes. It's best-effort and self-contained: a logging failure is caught and `console.warn`'d, never allowed to mask or replace the original error response. No third-party APM is wired up — see `RUNBOOK.md` for how to query `error_logs` directly.

## Retry and recovery

`POST /api/jobs/process` accepts a video in `queued`, `failed`, or `processing`-but-stuck (no update in over 6 minutes, past the 5-minute `maxDuration`) state, and re-runs the same processing logic used for the initial attempt — there's no separate retry code path. The dashboard (`src/app/dashboard/page.tsx`) surfaces a Retry button for `failed` videos and a "Retry (stuck)" button for ones it detects as stuck (`isStuckProcessing`).

## Conventions

- Every API route starts with `const user = await getRequestUser(request); if (!user) return 401`. `getRequestUser` (`src/lib/api-auth.ts`) verifies the bearer token against Supabase Auth using the publishable key — it does not trust a client-supplied user ID.
- Ownership is re-checked per-request via `.eq("user_id", user.id)` on every query, not inferred from RLS (since the admin client bypasses RLS).
- Server-side validation helpers live in `src/lib/subtitles.ts` (`isSubtitleTrackStyle`, `isSubtitleWordStyle`, `hasValidWordTimings`) and are the single source of truth for what a valid cue/style looks like — both the save route and the editor should stay consistent with these, not duplicate the rules.
- Env var access is lazy (inside functions, not at module load), which is why `npm run build` succeeds with no env vars set and why CI (`.github/workflows/ci.yml`) doesn't need secrets for lint/build.
