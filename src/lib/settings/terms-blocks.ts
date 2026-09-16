/**
 * Splits the admin-written terms into titled blocks. A first line shorter than
 * 80 characters is treated as a heading for the paragraph under it, which is how
 * the panel's editors write them (see Settings > General).
 */
export function termsBlocks(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((chunk) => {
      const nl = chunk.indexOf("\n");
      if (nl > 0 && nl < 80) return { title: chunk.slice(0, nl).trim(), body: chunk.slice(nl + 1).trim() };
      return { title: "", body: chunk };
    });
}
