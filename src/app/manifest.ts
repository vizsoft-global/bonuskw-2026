import type { MetadataRoute } from "next";

/**
 * Web app manifest. Served at /manifest.webmanifest (linked from layout).
 * `start_url` carries `source=pwa` so launches from the home screen can be
 * told apart from browser visits.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Bonus Academy",
    short_name: "Bonus",
    description: "Courses, lessons and ebooks for Bonus Academy students. دورات ودروس وكتب إلكترونية لطلاب بونص أكاديمي.",
    lang: "en",
    dir: "auto",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050505",
    theme_color: "#050505",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
