/**
 * Build stamps inlined at compile time. An already-open tab keeps the values it
 * was built with, which is what lets the client notice a newer deployment.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
export const BUILD_TIME = Number(process.env.NEXT_PUBLIC_BUILD_TIME ?? 0);
export const SHORT_VERSION = APP_VERSION === "dev" ? "dev" : APP_VERSION.slice(0, 7);
