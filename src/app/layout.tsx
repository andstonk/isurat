import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://subframe.app"),
  title: "Subframe — Professional AI Subtitles for Video Editors",
  description:
    "Generate, edit, review, and deliver professional video subtitles in minutes. Built for freelance video editors.",
  keywords: [
    "AI subtitles",
    "video captions",
    "SRT export",
    "subtitle generator",
    "video editors",
  ],
  openGraph: {
    title: "Subframe — Professional AI Subtitles in Minutes",
    description: "The subtitle workflow built for freelance video editors.",
    type: "website",
    siteName: "Subframe",
  },
  twitter: {
    card: "summary_large_image",
    title: "Subframe — Professional AI Subtitles in Minutes",
    description: "The subtitle workflow built for freelance video editors.",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
