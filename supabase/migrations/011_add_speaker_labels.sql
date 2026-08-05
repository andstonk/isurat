-- Phase 4: optional speaker labels and accessibility markers — the *rendering* half only.
--
-- Nothing here detects who is speaking. `subtitle_cues.speaker` is set by hand in the editor
-- today; the diarization workstream (see ROADMAP.md) is what will eventually fill it
-- automatically, and it can do so without another migration.
--
-- Accessibility markers ([door slams], (laughter), ♪ lyrics ♪) deliberately get no column: they
-- live inside `subtitle_cues.text` where every existing tool — import, export, search/replace,
-- split/merge — already carries them. They are recognized at render time by pattern, so an SRT
-- imported from elsewhere gets marker styling with no migration of its data.
--
-- Forward: adds videos.speaker_labels_enabled / speaker_label_style / speaker_label_color /
--          sound_markers_enabled / sound_marker_color (project-level render settings) and
--          subtitle_cues.speaker (per-cue label, null when unattributed).
-- Rollback: alter table public.videos
--             drop column if exists speaker_labels_enabled,
--             drop column if exists speaker_label_style,
--             drop column if exists speaker_label_color,
--             drop column if exists sound_markers_enabled,
--             drop column if exists sound_marker_color;
--           alter table public.subtitle_cues drop column if exists speaker;

alter table public.videos
  add column if not exists speaker_labels_enabled boolean not null default false,
  add column if not exists speaker_label_style text not null default 'colon',
  add column if not exists speaker_label_color text not null default '#FFD479',
  add column if not exists sound_markers_enabled boolean not null default true,
  add column if not exists sound_marker_color text not null default '#9CE0C4';

alter table public.videos
  drop constraint if exists videos_speaker_label_style_check,
  drop constraint if exists videos_speaker_label_color_check,
  drop constraint if exists videos_sound_marker_color_check,
  add constraint videos_speaker_label_style_check check (speaker_label_style in ('colon', 'chevron', 'brackets')),
  add constraint videos_speaker_label_color_check check (speaker_label_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint videos_sound_marker_color_check check (sound_marker_color ~ '^#[0-9A-Fa-f]{6}$');

-- Null means "no speaker attributed", which is every cue that exists before this migration and
-- every cue produced by transcription until diarization lands. Empty strings are rejected so
-- "attributed to nobody" has exactly one representation.
alter table public.subtitle_cues
  add column if not exists speaker text;

alter table public.subtitle_cues
  drop constraint if exists subtitle_cues_speaker_check,
  add constraint subtitle_cues_speaker_check check (speaker is null or char_length(btrim(speaker)) between 1 and 60);
