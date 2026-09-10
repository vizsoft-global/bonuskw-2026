import "server-only";
import { createHmac } from "crypto";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Signed links for the Cloudflare R2 files gateway the admin panel uploads to.
 * Credentials are shared through Firestore `serverConfig/cloudflare` (Admin SDK
 * only), with environment variables as a fallback. Token format matches the
 * Worker: `<unix exp>.<hex hmac(METHOD\nkey\nexp)>`.
 */
let cache: { at: number; url: string; secret: string } | null = null;

async function config() {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  let url = process.env.CF_FILES_URL?.trim() || "";
  let secret = process.env.CF_FILES_SECRET?.trim() || "";
  try {
    const snap = await getAdminDb().collection("serverConfig").doc("cloudflare").get();
    const pairs = (snap.data()?.pairs ?? {}) as Record<string, unknown>;
    if (typeof pairs.CF_FILES_URL === "string" && pairs.CF_FILES_URL.trim()) url = pairs.CF_FILES_URL.trim();
    if (typeof pairs.CF_FILES_SECRET === "string" && pairs.CF_FILES_SECRET.trim()) secret = pairs.CF_FILES_SECRET.trim();
  } catch {
    /* fall back to env */
  }
  cache = { at: Date.now(), url: url.replace(/\/+$/, ""), secret };
  return cache;
}

export async function signedGatewayUrl(key: string, ttlSec = 10 * 60) {
  const cfg = await config();
  if (!cfg.url || !cfg.secret) throw new Error("Files gateway is not configured");
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac("sha256", cfg.secret).update(`GET\n${key}\n${exp}`).digest("hex");
  const encoded = key.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${cfg.url}/${encoded}?token=${exp}.${sig}`;
}
