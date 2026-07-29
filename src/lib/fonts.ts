export const FONT_SOURCES = ["system", "google", "upload"] as const;
export type FontSource = (typeof FONT_SOURCES)[number];

export type UserFontFormat = "woff2" | "woff" | "ttf" | "otf";

export type UserFont = {
  id: string;
  displayName: string;
  originalFileName: string;
  format: UserFontFormat;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  archivedAt?: string | null;
  url: string;
};

export type GoogleFont = {
  family: string;
  category: string;
  variants: string[];
};

export function isFontSource(value: unknown): value is FontSource {
  return typeof value === "string" && FONT_SOURCES.some((source) => source === value);
}

export function userFontCssFamily(id: string) {
  return `user-font-${id.replace(/[^a-zA-Z0-9-]/g, "")}`;
}

export function googleFontCssUrl(family: string, bold: boolean, italic: boolean, variants: string[] = []) {
  const styles = new Set<string>();
  const supports = (variant: string) => variants.length === 0 || variants.includes(variant);
  if (supports("regular")) styles.add("0,400");
  if (bold && (supports("700") || supports("bold"))) styles.add("0,700");
  if (italic && supports("italic")) styles.add("1,400");
  if (bold && italic && (supports("700italic") || supports("bolditalic"))) styles.add("1,700");
  if (!styles.size) styles.add("0,400");
  const axes = [...styles].sort().join(";");
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:ital,wght@${axes}&display=swap`;
}
