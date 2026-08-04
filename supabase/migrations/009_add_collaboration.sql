-- Phase 3: collaboration and project workflows.
-- Manual subtitle snapshots, read-only share links, and role flags for future extension.
--
-- Numbered 009, not 008: 008_add_subscriptions.sql belongs to the billing work parked in a
-- git stash. Skipping the number keeps that file applicable as-is if billing is ever unparked.
--
-- Forward: creates project_versions (manual subtitle snapshots), share_links (read-only public
--          links, storing only a SHA-256 hash of each token), and project_members (owner/editor/
--          viewer role flags, unused until an invite flow exists). All three have RLS enabled
--          with no public policies — service-role only, matching every other table here.
-- Rollback: drop table if exists public.project_versions;
--           drop table if exists public.share_links;
--           drop table if exists public.project_members;

-- A point-in-time copy of a project's subtitle state. `cues` holds the full cue array
-- (text, timing, words, per-cue style overrides) so a restore needs no other table.
create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  label text not null check (char_length(label) between 1 and 120),
  -- Denormalized so the history list can render without reading the jsonb payload.
  cue_count integer not null check (cue_count >= 0),
  cues jsonb not null,
  settings jsonb,
  translation_style jsonb,
  constraint project_versions_cues_check check (jsonb_typeof(cues) = 'array'),
  constraint project_versions_settings_check check (settings is null or jsonb_typeof(settings) = 'object'),
  constraint project_versions_translation_style_check check (translation_style is null or jsonb_typeof(translation_style) = 'object')
);

create index if not exists project_versions_video_idx on public.project_versions(video_id, created_at desc);

-- Read-only public links. The raw token is never stored — only its SHA-256 hash — so a
-- database leak cannot be replayed as a working share URL. `expires_at` null means no expiry.
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0)
);

create index if not exists share_links_video_idx on public.share_links(video_id, created_at desc);
create index if not exists share_links_token_idx on public.share_links(token_hash);

-- Role flags. Nothing grants membership yet (there is no invite flow); the owner is still
-- videos.user_id. This exists so a later phase can add editors/viewers without a migration
-- on the hot path, and so the API can already resolve a caller's role in one place.
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (video_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members(user_id);

alter table public.project_versions enable row level security;
alter table public.share_links enable row level security;
alter table public.project_members enable row level security;

-- Deliberately no policies: every read and write goes through the service-role admin client,
-- which re-checks ownership per request. Matches the pattern used by every other table here.
