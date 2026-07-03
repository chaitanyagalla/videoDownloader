import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import SmoothScroll from "@/components/core/SmoothScroll";

export const metadata: Metadata = {
  title: {
    default: "VideoSave",
    template: "%s | VideoSave",
  },
  description:
    "A focused video saving desk for capturing links, tracking downloads, and revisiting saved sources.",
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
      <body>
        <div className="app-shell">
          <SmoothScroll />
          <div className="relative z-10 min-h-screen">{children}</div>
        </div>
      </body>
    </html>
  );
}
