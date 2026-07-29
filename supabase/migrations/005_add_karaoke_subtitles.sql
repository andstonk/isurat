alter table public.videos
  add column if not exists karaoke_enabled boolean not null default false,
  add column if not exists karaoke_color text not null default '#A78BFA';

alter table public.videos
  drop constraint if exists videos_karaoke_color_check,
  add constraint videos_karaoke_color_check check (karaoke_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.subtitle_cues
  add column if not exists words jsonb;

alter table public.subtitle_cues
  drop constraint if exists subtitle_cues_words_check,
  add constraint subtitle_cues_words_check check (words is null or jsonb_typeof(words) = 'array');
