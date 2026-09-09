/** Coarse file type used for icons and labels on course attachments. */
export type ResourceKind = "pdf" | "image" | "audio" | "video" | "file";

export function resourceKind(input: { contentType?: string | null; name?: string | null; url?: string | null }): ResourceKind {
  const type = (input.contentType ?? "").toLowerCase();
  const name = `${input.name ?? ""} ${input.url ?? ""}`.toLowerCase();
  if (type.includes("pdf") || /\.pdf(\?|$)/.test(name)) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(name)) return "image";
  if (type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)(\?|$)/.test(name)) return "audio";
  if (type.startsWith("video/") || /\.(mp4|mov|webm|m4v)(\?|$)/.test(name)) return "video";
  return "file";
}

export function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
