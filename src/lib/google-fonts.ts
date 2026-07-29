import type { GoogleFont } from "@/lib/fonts";

type GoogleWebfontResponse = {
  items?: Array<{ family?: string; category?: string; variants?: string[] }>;
};

let cache: { expiresAt: number; fonts: GoogleFont[] } | undefined;

export async function getGoogleFonts() {
  if (cache && cache.expiresAt > Date.now()) return cache.fonts;
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) throw new Error("Google Fonts is not configured.");

  const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${encodeURIComponent(apiKey)}`, {
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error(`Google Fonts returned ${response.status}.`);
  const payload = await response.json() as GoogleWebfontResponse;
  const fonts = (payload.items ?? []).flatMap((item) => {
    const family = item.family?.trim();
    if (!family || family.length > 100) return [];
    return [{
      family,
      category: item.category?.trim() || "sans-serif",
      variants: (item.variants ?? []).filter((variant) => typeof variant === "string").slice(0, 30),
    }];
  });
  cache = { fonts, expiresAt: Date.now() + 86_400_000 };
  return fonts;
}

export async function isGoogleFontFamily(family: string) {
  return (await getGoogleFonts()).some((font) => font.family === family);
}
