"use client";

import { useMemo, useState } from "react";
import { SUBTITLE_FONTS, type SubtitleTrackStyle } from "@/lib/subtitles";
import type { GoogleFont, UserFont } from "@/lib/fonts";

export function FontPicker({ name, style, googleFonts, userFonts, googleUnavailable, onChange, onManageFonts }: {
  name: string;
  style: SubtitleTrackStyle;
  googleFonts: GoogleFont[];
  userFonts: UserFont[];
  googleUnavailable: boolean;
  onChange: (patch: Pick<SubtitleTrackStyle, "font_family" | "font_source" | "user_font_id">) => void;
  onManageFonts: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGoogle = useMemo(() => googleFonts.filter((font) => !normalizedQuery || font.family.toLowerCase().includes(normalizedQuery)).slice(0, 250), [googleFonts, normalizedQuery]);
  const filteredUploads = useMemo(() => userFonts.filter((font) => !normalizedQuery || font.displayName.toLowerCase().includes(normalizedQuery)), [userFonts, normalizedQuery]);
  const selectedValue = style.font_source === "upload" ? `upload:${style.user_font_id}` : `${style.font_source}:${style.font_family}`;

  function select(value: string) {
    const separator = value.indexOf(":");
    const source = value.slice(0, separator);
    const identifier = value.slice(separator + 1);
    if (source === "upload") {
      const font = userFonts.find((item) => item.id === identifier);
      if (font) onChange({ font_source: "upload", font_family: font.displayName, user_font_id: font.id });
    } else if (source === "google") {
      onChange({ font_source: "google", font_family: identifier, user_font_id: null });
    } else {
      onChange({ font_source: "system", font_family: identifier, user_font_id: null });
    }
  }

  return <div className="font-picker control-field">
    <div className="font-picker-heading"><span>Font</span><button type="button" onClick={onManageFonts}>Manage fonts</button></div>
    <input aria-label={`Search fonts for ${name}`} type="search" placeholder="Search font library" value={query} onChange={(event) => setQuery(event.target.value)} />
    <select aria-label={`${name} subtitle font`} value={selectedValue} onChange={(event) => select(event.target.value)}>
      {style.font_source !== "upload" && ![...SUBTITLE_FONTS.map((font) => `system:${font}`), ...filteredGoogle.map((font) => `google:${font.family}`)].includes(selectedValue) && <option value={selectedValue}>{style.font_family} (selected)</option>}
      <optgroup label="System fonts">
        {SUBTITLE_FONTS.filter((font) => !normalizedQuery || font.toLowerCase().includes(normalizedQuery)).map((font) => <option key={font} value={`system:${font}`} style={{ fontFamily: font }}>{font}</option>)}
      </optgroup>
      {filteredGoogle.length > 0 && <optgroup label="Google Fonts">
        {filteredGoogle.map((font) => <option key={font.family} value={`google:${font.family}`}>{font.family}</option>)}
      </optgroup>}
      {filteredUploads.length > 0 && <optgroup label="My Fonts">
        {filteredUploads.map((font) => <option key={font.id} value={`upload:${font.id}`}>{font.displayName}</option>)}
      </optgroup>}
      {!userFonts.some((font) => font.id === style.user_font_id) && style.font_source === "upload" && <option value={selectedValue}>{style.font_family} (saved font)</option>}
    </select>
    {googleUnavailable && <small>Google Fonts is unavailable; system and uploaded fonts still work.</small>}
    {normalizedQuery && filteredGoogle.length === 250 && <small>Showing the first 250 Google Font matches. Refine your search.</small>}
  </div>;
}
