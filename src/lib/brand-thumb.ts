import type { CSSProperties } from "react";

/**
 * Default artwork for courses, chapters and lessons that have no thumbnail of
 * their own: a soft two-tone gradient with the brand mark on top. The colour is
 * picked from a fixed palette by hashing an id, so every course gets its own
 * hue, every chapter inside a course gets a different one, and all lessons in a
 * chapter share their chapter's colour.
 *
 * Keep this file identical in the student and admin apps.
 */
export type ThumbTone = { from: string; to: string; glow: string };

export const THUMB_PALETTE: ThumbTone[] = [
  { from: "#1f5eff", to: "#4d84ff", glow: "#9dbcff" }, // blue
  { from: "#ef5a3d", to: "#f4836b", glow: "#ffc3b3" }, // coral
  { from: "#6f86b6", to: "#9dafd2", glow: "#dfe6f4" }, // steel
  { from: "#0e9c79", to: "#31bf9a", glow: "#a4ead6" }, // teal
  { from: "#6a3df5", to: "#8d6cff", glow: "#cbbdff" }, // violet
  { from: "#e0891a", to: "#f0a94a", glow: "#ffd9a1" }, // amber
  { from: "#d43a7a", to: "#e6669b", glow: "#ffbfd9" }, // pink
  { from: "#2b8fd6", to: "#5bafe8", glow: "#b6e0ff" }, // sky
  { from: "#4f5d75", to: "#7a889f", glow: "#c9d1de" }, // slate
  { from: "#b5432a", to: "#d16a52", glow: "#f5b8a6" }, // rust
];

/** Stable small hash so the same id always maps to the same colour. */
export function toneIndex(seed: string | undefined | null) {
  const text = seed || "bonus";
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash) % THUMB_PALETTE.length;
}

export function thumbTone(seed: string | undefined | null): ThumbTone {
  return THUMB_PALETTE[toneIndex(seed)];
}

/** Inline background for a brand thumbnail keyed by `seed`. */
export function brandThumbStyle(seed: string | undefined | null): CSSProperties {
  const tone = thumbTone(seed);
  return {
    backgroundColor: tone.from,
    backgroundImage: [
      `radial-gradient(90% 80% at 18% 12%, ${tone.glow}cc 0%, ${tone.glow}00 62%)`,
      `radial-gradient(70% 70% at 88% 92%, ${tone.to} 0%, ${tone.to}00 70%)`,
      `linear-gradient(135deg, ${tone.from} 0%, ${tone.to} 100%)`,
    ].join(", "),
  };
}
