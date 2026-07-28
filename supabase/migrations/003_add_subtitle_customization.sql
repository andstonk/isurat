alter table public.videos
  add column if not exists subtitle_font_family text not null default 'Arial',
  add column if not exists subtitle_text_color text not null default '#FFFFFF',
  add column if not exists subtitle_font_size integer not null default 23,
  add column if not exists subtitle_bold boolean not null default true,
  add column if not exists subtitle_italic boolean not null default false,
  add column if not exists subtitle_underline boolean not null default false,
  add column if not exists subtitle_strikethrough boolean not null default false,
  add column if not exists subtitle_backdrop_color text not null default '#000000',
  add column if not exists subtitle_backdrop_opacity integer not null default 82,
  add column if not exists words_per_cue integer not null default 8;

alter table public.videos
  drop constraint if exists videos_subtitle_font_family_check,
  add constraint videos_subtitle_font_family_check check (subtitle_font_family in (
    'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS',
    'Times New Roman', 'Georgia', 'Segoe UI', 'Calibri', 'Courier New'
  )),
  drop constraint if exists videos_subtitle_text_color_check,
  add constraint videos_subtitle_text_color_check check (subtitle_text_color ~ '^#[0-9A-Fa-f]{6}$'),
  drop constraint if exists videos_subtitle_font_size_check,
  add constraint videos_subtitle_font_size_check check (subtitle_font_size between 12 and 64),
  drop constraint if exists videos_subtitle_backdrop_color_check,
  add constraint videos_subtitle_backdrop_color_check check (subtitle_backdrop_color ~ '^#[0-9A-Fa-f]{6}$'),
  drop constraint if exists videos_subtitle_backdrop_opacity_check,
  add constraint videos_subtitle_backdrop_opacity_check check (subtitle_backdrop_opacity between 0 and 100),
  drop constraint if exists videos_words_per_cue_check,
  add constraint videos_words_per_cue_check check (words_per_cue between 2 and 16);
