alter table public.videos
  add column if not exists subtitle_glow_enabled boolean not null default false,
  add column if not exists subtitle_glow_color text not null default '#A78BFA',
  add column if not exists subtitle_glow_blur integer not null default 8,
  add column if not exists subtitle_glow_intensity integer not null default 50,
  add column if not exists translation_glow_enabled boolean not null default false,
  add column if not exists translation_glow_color text not null default '#A78BFA',
  add column if not exists translation_glow_blur integer not null default 8,
  add column if not exists translation_glow_intensity integer not null default 50;

alter table public.videos
  drop constraint if exists videos_subtitle_glow_color_check,
  drop constraint if exists videos_subtitle_glow_blur_check,
  drop constraint if exists videos_subtitle_glow_intensity_check,
  drop constraint if exists videos_translation_glow_color_check,
  drop constraint if exists videos_translation_glow_blur_check,
  drop constraint if exists videos_translation_glow_intensity_check,
  add constraint videos_subtitle_glow_color_check check (subtitle_glow_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint videos_subtitle_glow_blur_check check (subtitle_glow_blur between 0 and 40),
  add constraint videos_subtitle_glow_intensity_check check (subtitle_glow_intensity between 0 and 100),
  add constraint videos_translation_glow_color_check check (translation_glow_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint videos_translation_glow_blur_check check (translation_glow_blur between 0 and 40),
  add constraint videos_translation_glow_intensity_check check (translation_glow_intensity between 0 and 100);

alter table public.subtitle_cues
  add column if not exists style_override jsonb;

alter table public.subtitle_cues
  drop constraint if exists subtitle_cues_style_override_check,
  add constraint subtitle_cues_style_override_check check (style_override is null or jsonb_typeof(style_override) = 'object');
