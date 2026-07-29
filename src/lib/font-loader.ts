import { googleFontCssUrl, userFontCssFamily, type GoogleFont, type UserFont } from "@/lib/fonts";
import type { SubtitleTrackStyle } from "@/lib/subtitles";

const loadedUploads = new Map<string, string>();

export async function loadUploadedFont(font: UserFont) {
  if (typeof document === "undefined") return;
  const cachedUrl = loadedUploads.get(font.id);
  if (cachedUrl === font.url && document.fonts.check(`16px "${userFontCssFamily(font.id)}"`)) return;
  const family = userFontCssFamily(font.id);
  const formatHint = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" }[font.format];
  const face = new FontFace(family, `url(${JSON.stringify(font.url)}) format("${formatHint}")`, { display: "swap" });
  await face.load();
  document.fonts.add(face);
  loadedUploads.set(font.id, font.url);
}

export async function loadGoogleFont(style: SubtitleTrackStyle, font?: GoogleFont) {
  if (typeof document === "undefined" || style.font_source !== "google") return;
  const id = `google-font-${btoa(unescape(encodeURIComponent(style.font_family))).replace(/[^a-zA-Z0-9]/g, "")}`;
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = googleFontCssUrl(style.font_family, style.bold, style.italic, font?.variants);
    document.head.appendChild(link);
  } else {
    const href = googleFontCssUrl(style.font_family, style.bold, style.italic, font?.variants);
    if (link.href !== href) link.href = href;
  }
  await document.fonts.load(`${style.italic ? "italic " : ""}${style.bold ? "700" : "400"} 16px "${style.font_family}"`);
}

export function resolvedFontFamily(style: SubtitleTrackStyle) {
  if (style.font_source === "upload" && style.user_font_id) return `"${userFontCssFamily(style.user_font_id)}", Arial, sans-serif`;
  return `"${style.font_family.replace(/["\\]/g, "")}", Arial, sans-serif`;
}
