export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export const SHORT_VERSION =
  APP_VERSION === "dev" ? "dev" : APP_VERSION.slice(0, 7);
