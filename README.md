# Subframe

A functional MVP for an AI subtitle SaaS. Users can authenticate, upload MP4/MOV videos (including HEVC from phones, auto-transcoded to H.264 for playback) to Azure Blob Storage, create Soniox transcription and translation jobs, edit timestamped original and translated subtitles, style each subtitle track independently with system, Google, or private uploaded fonts, enable word-timed karaoke highlighting, control the maximum words per cue, preview captions, and export SRT, VTT, or TXT files.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS 4
- Supabase Auth and PostgreSQL
- Azure Blob Storage for private MP4 uploads
- Soniox asynchronous transcription, language detection, and one-way translation
- Vercel-ready deployment

## Local setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create the Supabase table

Create a Supabase project, open its SQL editor, then paste and run the SQL contents of these files in order (do not run the file path text itself):

```text
supabase/migrations/001_create_waitlist.sql
supabase/migrations/002_create_subtitle_mvp.sql
supabase/migrations/003_add_subtitle_customization.sql
supabase/migrations/004_add_user_fonts.sql
supabase/migrations/005_add_karaoke_subtitles.sql
supabase/migrations/006_add_advanced_subtitle_styles.sql
supabase/migrations/007_add_error_logs.sql
supabase/migrations/009_add_collaboration.sql
supabase/migrations/010_raise_upload_ceiling.sql
```

See `MIGRATIONS.md` for the validation checklist to follow whenever a new migration is added.

The migration enables Row Level Security and creates no public policies. Browser clients cannot read or write the table; submissions are handled only by the server API route.

### 3. Configure environment variables

Copy `.env.example` to `.env.local`, then provide:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER=videos
SONIOX_API_KEY=your-soniox-api-key
SONIOX_TRANSCRIPTION_MODEL=stt-async-v5
GOOGLE_FONTS_API_KEY=your-google-fonts-developer-api-key
# Optional; change this for your Soniox project region.
SONIOX_API_BASE_URL=https://api.soniox.com/v1
```

Find Supabase values in project settings under API. Use the browser-safe `sb_publishable_...` key for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; legacy projects may instead use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Create the Soniox API key in the Soniox Console. Enable the Web Fonts Developer API in Google Cloud and create an API key for `GOOGLE_FONTS_API_KEY`. The Supabase service role key, Azure connection string, Soniox API key, and Google Fonts key must remain server-only. Configure the Azure container CORS policy to allow browser `PUT` and `GET` requests from the application origin and expose `ETag` and `x-ms-*` headers. Font previews require Azure `GET` CORS access in every local, preview, and production environment.

### Custom fonts

Each user can keep up to 50 active private fonts. WOFF2, WOFF, TTF, and OTF files up to 5 MB are accepted after server-side signature and MIME validation. Uploaders must confirm they have the right or license to use each font. Archiving removes a font from new selections while preserving it for saved projects that already reference it.

Google and uploaded font choices affect the editor preview and saved project settings. SRT, VTT, and TXT are text-only formats, so those downloads intentionally do not contain styling or font files.

Karaoke highlighting uses Soniox word-level timestamps for newly processed videos. Existing or manually edited cues fall back to evenly distributed word timing within each cue. The effect is saved with the project and shown in the editor preview; text-only subtitle exports do not preserve the highlight color.

Advanced styling supports customizable text glow, full appearance overrides for individual subtitle cues, and bold, italic, underline, or color emphasis for individual words. These visual effects are saved with the project and shown in the editor preview, but text-only SRT, VTT, and TXT exports do not preserve them.

### Version history and sharing

The editor's **History** panel saves named snapshots of a project's subtitles and restores them later. Restoring snapshots the current state first, so restoring the wrong version can itself be undone. Each project keeps its 20 most recent snapshots.

The **Share** panel creates read-only links (`/share/<token>`) that show the video, styled captions, and cue list to anyone with the URL — no account needed, and no way to edit or export. Links can expire after 7 or 30 days or stay open until revoked, and only the project owner can create or revoke them. The link is displayed once when created: only a hash of the token is stored, so a lost link must be revoked and replaced rather than looked up.

### 4. Configure authentication providers

In Supabase, open **Authentication → URL Configuration** and set the site URL to `http://localhost:3000` for local development. Add `http://localhost:3000/auth/callback` to the allowed redirect URLs. Add the equivalent callback URL for every deployed environment.

For Google sign-in, enable Google under **Authentication → Providers**, create OAuth web credentials in Google Cloud, and add the Supabase callback URL shown in the provider settings as an authorized redirect URI. For GitHub sign-in, create a GitHub OAuth App, use that same Supabase callback URL as its authorization callback URL, then enable GitHub in Supabase with the app credentials. Provider client secrets belong in Supabase, not in this app's environment variables.

Email/password registration also requires the Email provider to be enabled. When email confirmation is enabled, configure a working SMTP provider and ensure the confirmation template redirects to the application's `/auth/callback` URL.

The MVP limits video uploads (MP4/MOV/M4V) to 25 MB by default, re-encodes them to H.264/AAC MP4 via ffmpeg before playback and transcription, and waits for Soniox's asynchronous transcription inside the processing request.

Specific accounts can be granted a larger limit by listing their email addresses in `LARGE_UPLOAD_EMAILS` (comma-separated); `LARGE_UPLOAD_LIMIT_MB` sets what they get, defaulting to and capped at 100 MB. The cap is not arbitrary — processing loads the whole video into memory, writes it to Vercel's 512 MB `/tmp`, transcodes it, and reads it back, all inside a 5-minute function timeout that also covers transcription. Going meaningfully above 100 MB means moving processing off the request first (streaming transcode, queue worker, Soniox webhook); see `src/lib/upload-limits.ts`. A translation target can be selected before upload; the editor then supports original-only, translated-only, or double subtitles. For production-scale videos, submit jobs from an Azure Function or queue worker and use a Soniox webhook to update PostgreSQL when processing completes.

### 5. Run locally

```bash
pnpm dev
```

Open `http://localhost:3000`. Submit a test email and confirm it appears in the Supabase `waitlist` table.

## Validation

```bash
pnpm lint
pnpm build
```

`.github/workflows/ci.yml` runs both commands automatically on every push to `main` and on every pull request.

## Deploy to Vercel

1. Push this project to a Git repository.
2. Import the repository into Vercel as a Next.js project.
3. Add all Supabase, Azure, and Soniox variables listed above under Project Settings → Environment Variables for Production, Preview, and Development as appropriate.
4. Deploy. Vercel detects the framework and pnpm lockfile, then runs `pnpm build` automatically.
5. Update the canonical site URL in the metadata, sitemap, and robots configuration if the production domain is not `https://subframe.app`.

## Waitlist data

The API normalizes email addresses, validates input, handles duplicate signups, and writes with a server-only Supabase service role key. The `email` column has a case-insensitive unique index.

## Operations

Failures in the upload, transcription, and subtitle-save flows are written to the `error_logs` table (server-only, no public RLS policy) for later diagnosis. Videos stuck in `failed` — or stuck in `processing` for more than 6 minutes, past the 5-minute processing timeout — get a Retry button on the dashboard. See `RUNBOOK.md` for how to diagnose and recover a stuck or failed job, and `MIGRATIONS.md` for the checklist to follow when adding a new database migration.

For a current-state architecture reference (data model, request flows, styling cascade, conventions), see `DESIGN.md`. For what's planned next, see `ROADMAP.md`.

## Project commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start local development with Turbopack |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
