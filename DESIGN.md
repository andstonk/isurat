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
- **`project_versions`** — manual subtitle snapshots (`009_add_collaboration.sql`). Each row holds the full cue array as jsonb plus the project's style columns, so a restore reads one row and needs no join. `cue_count` is denormalized so the history list renders without loading the payload.
- **`share_links`** — read-only public links (`009_add_collaboration.sql`). Stores `token_hash` (SHA-256), never the token itself, alongside `expires_at`, `revoked_at`, and view accounting.
- **`project_members`** — owner/editor/viewer role flags (`009_add_collaboration.sql`). Nothing writes to it yet; ownership still comes from `videos.user_id`. It exists so `resolveProjectAccess()` has one place to answer "what may this user do", and so adding an invite flow later needs no changes to the collaboration routes.
- **`waitlist`** — pre-launch email capture, unrelated to the core product (`001_create_waitlist.sql`).
- **`error_logs`** — best-effort failure log for the upload/transcription/save flows (`007_add_error_logs.sql`). See "Error telemetry" below.

**RLS pattern, consistent across every table**: `enable row level security` with no `insert` policy. All writes go through `createAdminSupabase()` (`src/lib/supabase.ts`), which uses the service-role key and bypasses RLS entirely. Browser clients (`createBrowserSupabase()`) get `select`/`update`/`delete` policies scoped to `auth.uid() = user_id`, used only for the parts of the app that read Supabase directly (currently: none of the core flow — even reads go through API routes that use the admin client and re-check `user_id` themselves). New tables should follow this pattern unless there's a specific reason a browser client needs direct access.

## Request flows

**Upload**: `POST /api/uploads` (`src/app/api/uploads/route.ts`) validates the file (MP4/MOV/M4V by extension+MIME pair, <=25MB), creates a `videos` row (`status='uploading'`), and returns an Azure SAS URL scoped to `create+write` on one blob, expiring in 15 minutes. The browser `PUT`s the file directly to Azure. `POST /api/uploads/complete` (`src/app/api/uploads/complete/route.ts`) flips `status` to `queued`, but only if it's currently `uploading` and owned by the caller — this is the guard against completing a job that was never actually uploaded.

**Processing**: `POST /api/jobs/process` (`src/app/api/jobs/process/route.ts`, `maxDuration=300`) runs synchronously inside the request: downloads the blob from Azure, **re-encodes it to H.264/AAC MP4 via `transcodeToH264Mp4` (`src/lib/transcode.ts`)**, overwrites the same blob with the transcoded bytes, uploads that buffer to Soniox, waits for transcription (and translation, if `translation_target_language` is set), converts Soniox tokens to subtitle cues (`tokensToSubtitleCues`/`tokensToBilingualCues` in `src/lib/soniox.ts`), and writes them to `subtitle_cues`. This route is also the retry path — see "Retry and recovery" below. There is no queue; `README.md` notes that production-scale usage should move this to a background worker with a Soniox webhook instead of blocking the request.

**Video transcoding**: every upload is unconditionally re-encoded on the way through, regardless of source codec — this normalizes HEVC (the default codec on iPhones, usually wrapped in `.mov`) into H.264, which is universally supported by `<video>` playback in browsers, unlike HEVC which only reliably decodes in Safari. `transcodeToH264Mp4` shells out to `@ffmpeg-installer/ffmpeg`'s bundled static binary via `child_process.execFile`, using `/tmp` for scratch files (Vercel's writable ephemeral disk). Two `next.config.ts` settings exist specifically to keep this working under Vercel's build: `serverExternalPackages: ["@ffmpeg-installer/ffmpeg"]` (the package resolves its binary path via `__dirname` at module load time, which breaks if webpack bundles/rewrites the module — confirmed locally, this is not theoretical) and `outputFileTracingIncludes` forcing the Linux ffmpeg binary into the deployed function output as a safety net alongside Next.js's own automatic file tracing.

**Edit/save**: The editor (`src/app/editor/[id]/page.tsx`, `src/components/subtitle-editor.tsx`) loads cues and settings, lets the user adjust timing/text/styling, and saves via `PUT /api/videos/[id]/subtitles` (`src/app/api/videos/.../subtitles/route.ts`), which validates every cue and style object server-side before replacing all `subtitle_cues` rows for the video and updating the project-level style columns on `videos`.

**Export**: `GET /api/videos/[id]/export?format=srt|vtt|txt&mode=original|translated|bilingual` (`src/app/api/videos/[id]/export/route.ts`) reads cues and serializes them with `toSrt`/`toVtt`/`toTxt` (`src/lib/subtitles.ts`). Text-only formats intentionally drop all styling/font/glow/karaoke data — there is no styled export format yet (that's Phase 4 on the roadmap: burned-in MP4 rendering).

## Subtitle styling cascade

Three levels, word overrides beating cue overrides beating project defaults:

1. **Project defaults** — `videos.subtitle_*` / `videos.translation_*` columns, loaded into `SubtitleSettings`/`SubtitleTrackStyle` (`src/lib/subtitles.ts`).
2. **Cue overrides** — `subtitle_cues.style_override` (jsonb, validated by `isSubtitleTrackStyle`). Applied to the cue's container element in the editor preview.
3. **Word overrides** — `subtitle_cues.words[].style` (jsonb, validated by `isSubtitleWordStyle`). Applied as an inline style on each word's `<span>`, so it visually overrides both cue and project styling.

Known gap (tracked on the roadmap, not yet fixed): `resegmentCues()` (`src/lib/subtitles.ts`) preserves word-level styles when cues are regrouped by word limit, but drops cue-level `style_override` on the regrouped cues. That gap is specific to "Apply word limit"; the manual split/merge tools below take a different path and don't have it.

**Manual split/merge**: the editor (`src/components/subtitle-editor.tsx`) also lets a creator split one cue into two (pick a word boundary; timing, per-word styles, and `style_override` all carry over to both halves, with `translated_text` divided proportionally by word count) or merge a cue into the next one (concatenates text/`translated_text`/words, keeps the first cue's `style_override`). Both renumber `cue_index` for the whole array afterward, same as `resegmentCues()`. A bulk timestamp shift (+/- ms or sec, applied to every cue and word timing, clamped so no affected cue's `start_ms` goes below 0) lives alongside these in the cue pane's toolbar; each cue row has a checkbox, and when any are checked the shift applies only to that subset (clamped against their own earliest `start_ms`) instead of the whole track.

## Collaboration and sharing

**Access resolution**: `resolveProjectAccess()` (`src/lib/collaboration.ts`) is the single answer to "may this user touch this project, and as what". It returns `owner` when `videos.user_id` matches, otherwise falls back to a `project_members` lookup, and returns null when neither applies. `canEditProject()` gates snapshots and restores (owner + editor); `canManageSharing()` gates share links (owner only — an editor may change subtitles but not who can see them). Every collaboration route runs this before doing work, so adding a real invite flow later means writing `project_members` rows, not touching the routes.

**Version history**: `snapshotProject()` copies the project's *saved* state — it reads cues and style columns from the database rather than accepting them from the client, so a snapshot always reflects something that was really persisted. The editor's History panel saves pending changes before requesting one, closing the gap where a snapshot could capture stale state. Snapshots are pruned to the 20 newest per project (`MAX_VERSIONS_PER_PROJECT`).

Restoring (`POST /api/videos/[id]/versions/[versionId]/restore`) snapshots the current state as `Before restoring "…"` **before** overwriting anything, which is what makes restoring the wrong version recoverable in the UI instead of a database problem. Stored cues are re-validated with `isRestorableCue()` and rejected wholesale rather than partially applied, so an old snapshot written before a schema change fails loudly. Style columns are written back through an allowlist (`PROJECT_SETTINGS_COLUMNS`/`TRANSLATION_STYLE_COLUMNS`), so a tampered snapshot row can't set arbitrary columns like `user_id`.

**Share links**: `POST /api/videos/[id]/share` generates a 256-bit token and stores only its SHA-256 hash, so a database leak yields no working URLs and a lost link can only be replaced, never recovered. `expires_at` null means no expiry; revocation is a soft `revoked_at` so the owner keeps the view count. `/share/<token>` (`src/app/share/[token]/page.tsx`) is a `force-dynamic` server component calling `loadSharedProject()`, which re-checks revocation and expiry on every request and returns only what a viewer needs — no user id, blob name, or transcript column. The route is `noindex` and `robots.ts` disallows `/share/`.

**Shared rendering**: `CaptionOverlay` (`src/components/caption-overlay.tsx`) holds the caption markup and the `captionStyle`/`wordStyle` helpers, and `settingsFromVideoRow()`/`translationStyleFromVideoRow()` (`src/lib/subtitles.ts`) hold the column-to-style normalization. Both the editor and the share view go through them, so the styling cascade is implemented once and the two surfaces cannot drift.

## Error telemetry

`src/lib/error-log.ts`'s `logError()` writes a row to `error_logs` from the catch blocks in the upload, transcription, and subtitle-save routes. It's best-effort and self-contained: a logging failure is caught and `console.warn`'d, never allowed to mask or replace the original error response. No third-party APM is wired up — see `RUNBOOK.md` for how to query `error_logs` directly.

## Retry and recovery

`POST /api/jobs/process` accepts a video in `queued`, `failed`, or `processing`-but-stuck (no update in over 6 minutes, past the 5-minute `maxDuration`) state, and re-runs the same processing logic used for the initial attempt — there's no separate retry code path. The dashboard (`src/app/dashboard/page.tsx`) surfaces a Retry button for `failed` videos and a "Retry (stuck)" button for ones it detects as stuck (`isStuckProcessing`).

## Conventions

- Every API route starts with `const user = await getRequestUser(request); if (!user) return 401`. `getRequestUser` (`src/lib/api-auth.ts`) verifies the bearer token against Supabase Auth using the publishable key — it does not trust a client-supplied user ID.
- Ownership is re-checked per-request via `.eq("user_id", user.id)` on every query, not inferred from RLS (since the admin client bypasses RLS).
- Server-side validation helpers live in `src/lib/subtitles.ts` (`isSubtitleTrackStyle`, `isSubtitleWordStyle`, `hasValidWordTimings`) and are the single source of truth for what a valid cue/style looks like — both the save route and the editor should stay consistent with these, not duplicate the rules.
- Env var access is lazy (inside functions, not at module load), which is why `pnpm build` succeeds with no env vars set and why CI (`.github/workflows/ci.yml`) doesn't need secrets for lint/build.
