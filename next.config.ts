import type { NextConfig } from "next";

const buildVersion =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.NEXT_DEPLOYMENT_ID ??
  String(Date.now());

const isProduction = process.env.NODE_ENV === "production";
const onVercel = Boolean(process.env.VERCEL || process.env.NEXT_DEPLOYMENT_ID);

const nextConfig: NextConfig = {
  ...(!onVercel && isProduction ? { deploymentId: buildVersion } : {}),
  allowedDevOrigins: ["127.0.2.2", "localhost"],
  env: {
    NEXT_PUBLIC_APP_VERSION: isProduction ? buildVersion : "dev",
    NEXT_PUBLIC_BUILD_TIME: String(Date.now()),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "lottie-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "imagedelivery.net" },
      { protocol: "https", hostname: "*.cloudflarestream.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/homePage", destination: "/", permanent: false },
      { source: "/home_new", destination: "/", permanent: false },
      { source: "/main", destination: "/", permanent: false },
      { source: "/eBookSStores", destination: "/store", permanent: false },
      { source: "/myzone", destination: "/my-space", permanent: false },
      { source: "/checkOutPage", destination: "/cart", permanent: false },
      { source: "/checkout", destination: "/cart", permanent: false },
      { source: "/searchPage", destination: "/search", permanent: false },
      { source: "/loginwithNumber", destination: "/login", permanent: false },
      { source: "/profile/notifications", destination: "/profile", permanent: false },
    ];
  },
};

export default nextConfig;
