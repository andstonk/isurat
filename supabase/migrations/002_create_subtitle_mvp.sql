create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  blob_name text not null unique,
  blob_url text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  status text not null default 'uploading' check (status in ('uploading', 'queued', 'processing', 'ready', 'failed')),
  error_message text,
  transcript text,
  language text,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subtitle_cues (
  id bigint generated always as identity primary key,
  video_id uuid not null references public.videos(id) on delete cascade,
  cue_index integer not null check (cue_index >= 0),
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > start_ms),
  text text not null check (char_length(text) between 1 and 2000),
  unique (video_id, cue_index)
);

create index if not exists videos_user_created_idx on public.videos(user_id, created_at desc);
create index if not exists subtitle_cues_video_idx on public.subtitle_cues(video_id, cue_index);

alter table public.videos enable row level security;
alter table public.subtitle_cues enable row level security;

create policy "Users can read their videos" on public.videos for select using (auth.uid() = user_id);
create policy "Users can update their videos" on public.videos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their videos" on public.videos for delete using (auth.uid() = user_id);
create policy "Users can read their subtitle cues" on public.subtitle_cues for select using (
  exists (select 1 from public.videos where videos.id = subtitle_cues.video_id and videos.user_id = auth.uid())
);
create policy "Users can update their subtitle cues" on public.subtitle_cues for update using (
  exists (select 1 from public.videos where videos.id = subtitle_cues.video_id and videos.user_id = auth.uid())
);