# Subframe

A functional MVP for an AI subtitle SaaS. Users can authenticate, upload MP4 videos to Azure Blob Storage, create Soniox transcription jobs, edit timestamped subtitles, customize fonts and backdrops, control the maximum words per cue, preview captions, and export SRT, VTT, or TXT files.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS 4
- Supabase Auth and PostgreSQL
- Azure Blob Storage for private MP4 uploads
- Soniox asynchronous transcription with token timestamps
- Vercel-ready deployment

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the Supabase table

Create a Supabase project, open its SQL editor, then paste and run the SQL contents of these files in order (do not run the file path text itself):

```text
supabase/migrations/001_create_waitlist.sql
supabase/migrations/002_create_subtitle_mvp.sql
supabase/migrations/003_add_subtitle_customization.sql
```

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
SONIOX_TRANSCRIPTION_MODEL=stt-async-v4
# Optional; change this for your Soniox project region.
SONIOX_API_BASE_URL=https://api.soniox.com/v1
```

Find Supabase values in project settings under API. Use the browser-safe `sb_publishable_...` key for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; legacy projects may instead use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Create the Soniox API key in the Soniox Console. The Supabase service role key, Azure connection string, and Soniox API key must remain server-only. Configure the Azure container CORS policy to allow browser `PUT` requests from the application origin and expose `ETag` and `x-ms-*` headers.

### 4. Configure authentication providers

In Supabase, open **Authentication → URL Configuration** and set the site URL to `http://localhost:3000` for local development. Add `http://localhost:3000/auth/callback` to the allowed redirect URLs. Add the equivalent callback URL for every deployed environment.

For Google sign-in, enable Google under **Authentication → Providers**, create OAuth web credentials in Google Cloud, and add the Supabase callback URL shown in the provider settings as an authorized redirect URI. For GitHub sign-in, create a GitHub OAuth App, use that same Supabase callback URL as its authorization callback URL, then enable GitHub in Supabase with the app credentials. Provider client secrets belong in Supabase, not in this app's environment variables.

Email/password registration also requires the Email provider to be enabled. When email confirmation is enabled, configure a working SMTP provider and ensure the confirmation template redirects to the application's `/auth/callback` URL.

The MVP limits MP4 uploads to 25 MB and waits for Soniox's asynchronous transcription inside the processing request. For production-scale videos, submit jobs from an Azure Function or queue worker and use a Soniox webhook to update PostgreSQL when processing completes.

### 5. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`. Submit a test email and confirm it appears in the Supabase `waitlist` table.

## Validation

```bash
npm run lint
npm run build
```

## Deploy to Vercel

1. Push this project to a Git repository.
2. Import the repository into Vercel as a Next.js project.
3. Add all Supabase, Azure, and Soniox variables listed above under Project Settings → Environment Variables for Production, Preview, and Development as appropriate.
4. Deploy. Vercel detects the framework and runs `npm run build` automatically.
5. Update the canonical site URL in the metadata, sitemap, and robots configuration if the production domain is not `https://subframe.app`.

## Waitlist data

The API normalizes email addresses, validates input, handles duplicate signups, and writes with a server-only Supabase service role key. The `email` column has a case-insensitive unique index.

## Project commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development with Turbopack |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
