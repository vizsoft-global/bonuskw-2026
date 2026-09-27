/** Sizes must exist in the Cloudflare Images dashboard under these names. */
export const IMAGE_VARIANTS = ["icon", "thumbnail", "card", "full"] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

export type ImageUse = "avatar" | "lesson" | "chapter" | "courseCard" | "courseHero";

const VARIANT: Record<ImageUse, ImageVariant> = {
  avatar: "icon",
  lesson: "thumbnail",
  chapter: "card",
  courseCard: "card",
  courseHero: "full",
};

const DELIVERY = "imagedelivery.net";

/** Swaps a Cloudflare delivery URL to the size that fits where it is shown. */
export function imageFor(use: ImageUse, value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.includes(DELIVERY)) return trimmed || "";
  const parts = trimmed.split("/");
  const last = parts[parts.length - 1];
  if ((IMAGE_VARIANTS as readonly string[]).includes(last)) {
    parts[parts.length - 1] = VARIANT[use];
    return parts.join("/");
  }
  return trimmed;
}
