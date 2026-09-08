import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppFrame } from "@/components/layout/app-shell";
import { PwaRegister } from "@/components/system/pwa-register";
import { VersionGuard } from "@/components/system/version-guard";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: "Bonus Academy",
  description: "Courses, lessons and ebooks for Bonus Academy students.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable} ${arabic.variable}`}>
      <body>
        <Providers>
          <VersionGuard />
          <PwaRegister />
          <div id="ba-recaptcha" />
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
