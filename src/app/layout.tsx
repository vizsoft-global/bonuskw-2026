import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppFrame } from "@/components/layout/app-shell";
import { PwaRegister } from "@/components/system/pwa-register";
import { ThemeColorSync } from "@/components/system/theme-color-sync";
import { MaintenanceGuard } from "@/components/system/maintenance-guard";
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
  applicationName: "Bonus Academy",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS reads this tag (not the manifest) for the home-screen icon.
    apple: "/icons/apple-touch-icon.png",
  },
  // Home-screen launches open full screen with a translucent status bar.
  appleWebApp: {
    capable: true,
    title: "Bonus Academy",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  // Next emits the standard `mobile-web-app-capable`; older iOS only reads the Apple one.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  // Fallbacks before ThemeColorSync runs; must match `--app-top`.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
    { color: "#050505" },
  ],
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / home indicator; safe-area insets handle spacing.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable} ${arabic.variable}`}>
      <body>
        <Providers>
          <VersionGuard />
          <ThemeColorSync />
          <PwaRegister />
          <div id="ba-recaptcha" />
          <MaintenanceGuard>
            <AppFrame>{children}</AppFrame>
          </MaintenanceGuard>
        </Providers>
      </body>
    </html>
  );
}
