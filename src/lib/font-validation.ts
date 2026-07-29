import { createHash } from "crypto";
import type { UserFontFormat } from "@/lib/fonts";

export const MAX_FONT_SIZE = 5 * 1024 * 1024;
export const MAX_USER_FONTS = 50;

const MIME_TYPES: Record<UserFontFormat, string[]> = {
  woff2: ["font/woff2", "application/font-woff2", "application/octet-stream"],
  woff: ["font/woff", "application/font-woff", "application/octet-stream"],
  ttf: ["font/ttf", "application/x-font-ttf", "application/x-font-truetype", "application/octet-stream"],
  otf: ["font/otf", "application/x-font-opentype", "application/vnd.ms-opentype", "application/octet-stream"],
};

export function detectFontFormat(bytes: Uint8Array): UserFontFormat | null {
  if (bytes.length < 4) return null;
  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (signature === "wOF2") return "woff2";
  if (signature === "wOFF") return "woff";
  if (signature === "OTTO") return "otf";
  if (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) return "ttf";
  return null;
}

export function validateFontMimeType(format: UserFontFormat, mimeType: string) {
  return MIME_TYPES[format].includes(mimeType.toLowerCase());
}

export function canonicalFontMimeType(format: UserFontFormat) {
  return `font/${format}`;
}

export function sanitizeFontName(value: string, fallback: string) {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100);
  return normalized || fallback.replace(/\.[^.]+$/, "").trim().slice(0, 100) || "Custom font";
}

export function sanitizeFileName(value: string) {
  return value.replace(/[\u0000-\u001f\u007f\\/]/g, "_").trim().slice(0, 255) || "font-file";
}

export function fontHash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
