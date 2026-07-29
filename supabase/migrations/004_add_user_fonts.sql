create table if not exists public.user_fonts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  original_file_name text not null check (char_length(original_file_name) between 1 and 255),
  blob_name text not null unique,
  format text not null check (format in ('woff2', 'woff', 'ttf', 'otf')),
  mime_type text not null,
  file_size integer not null check (file_size between 1 and 5242880),
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  rights_confirmed_at timestamptz not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

create index if not exists user_fonts_user_active_idx
  on public.user_fonts(user_id, created_at desc)
  where archived_at is null;

alter table public.user_fonts enable row level security;

drop policy if exists "Users can read their fonts" on public.user_fonts;
create policy "Users can read their fonts" on public.user_fonts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their fonts" on public.user_fonts;
create policy "Users can insert their fonts" on public.user_fonts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their fonts" on public.user_fonts;
create policy "Users can update their fonts" on public.user_fonts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.videos
  add column if not exists subtitle_font_source text not null default 'system',
  add column if not exists subtitle_user_font_id uuid references public.user_fonts(id) on delete set null,
  add column if not exists translation_font_source text not null default 'system',
  add column if not exists translation_user_font_id uuid references public.user_fonts(id) on delete set null;

alter table public.videos
  drop constraint if exists videos_subtitle_font_family_check,
  drop constraint if exists videos_translation_font_family_check,
  drop constraint if exists videos_subtitle_font_source_check,
  add constraint videos_subtitle_font_source_check check (subtitle_font_source in ('system', 'google', 'upload')),
  drop constraint if exists videos_translation_font_source_check,
  add constraint videos_translation_font_source_check check (translation_font_source in ('system', 'google', 'upload')),
  drop constraint if exists videos_subtitle_font_selection_check,
  add constraint videos_subtitle_font_selection_check check (
    char_length(subtitle_font_family) between 1 and 100
    and ((subtitle_font_source = 'system' and subtitle_font_family in (
      'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS',
      'Times New Roman', 'Georgia', 'Segoe UI', 'Calibri', 'Courier New'
    ) and subtitle_user_font_id is null)
    or (subtitle_font_source = 'google' and subtitle_user_font_id is null)
    or (subtitle_font_source = 'upload' and subtitle_user_font_id is not null))
  ),
  drop constraint if exists videos_translation_font_selection_check,
  add constraint videos_translation_font_selection_check check (
    char_length(translation_font_family) between 1 and 100
    and ((translation_font_source = 'system' and translation_font_family in (
      'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS',
      'Times New Roman', 'Georgia', 'Segoe UI', 'Calibri', 'Courier New'
    ) and translation_user_font_id is null)
    or (translation_font_source = 'google' and translation_user_font_id is null)
    or (translation_font_source = 'upload' and translation_user_font_id is not null))
  );

create index if not exists videos_subtitle_user_font_idx on public.videos(subtitle_user_font_id);
create index if not exists videos_translation_user_font_idx on public.videos(translation_user_font_id);

create or replace function public.reset_deleted_user_font_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.videos
  set subtitle_font_source = 'system', subtitle_font_family = 'Arial', subtitle_user_font_id = null
  where subtitle_user_font_id = old.id;
  update public.videos
  set translation_font_source = 'system', translation_font_family = 'Arial', translation_user_font_id = null
  where translation_user_font_id = old.id;
  return old;
end;
$$;

drop trigger if exists reset_user_font_references_before_delete on public.user_fonts;
create trigger reset_user_font_references_before_delete
before delete on public.user_fonts
for each row execute function public.reset_deleted_user_font_references();
