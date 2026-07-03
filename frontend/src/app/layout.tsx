import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import ScanLines from "@/components/core/ScanLines";
import NoiseOverlay from "@/components/core/NoiseOverlay";
import SmoothScroll from "@/components/core/SmoothScroll";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Video Heist System",
    template: "%s | Video Heist System",
  },
  description:
    "A cinematic hacker-style video downloader for YouTube, Instagram, and X with real-time logs, data extraction visuals, and animated mission flow.",
  icons: {
    icon: "/favicon.ico",
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceMono.variable}`}>
        <div className="app-shell">
          <SmoothScroll />
          <ScanLines />
          <NoiseOverlay />
          <div className="relative z-10 min-h-screen">{children}</div>
        </div>
      </body>
    </html>
  );
}
