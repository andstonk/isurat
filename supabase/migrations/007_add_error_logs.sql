create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route text not null,
  user_id uuid references auth.users(id) on delete set null,
  video_id uuid references public.videos(id) on delete cascade,
  message text not null,
  stack text,
  metadata jsonb,
  constraint error_logs_metadata_check check (metadata is null or jsonb_typeof(metadata) = 'object')
);

create index if not exists error_logs_created_idx on public.error_logs(created_at desc);
create index if not exists error_logs_video_idx on public.error_logs(video_id, created_at desc);

alter table public.error_logs enable row level security;
