/**
 * Splits the admin-written terms into readable blocks.
 *
 * A blank line separates blocks, which is how the panel's editors write them. A
 * short first line that reads as a label rather than a sentence becomes that
 * block's heading, and any remaining single lines become their own paragraphs —
 * so text pasted with one clause per line still reads properly instead of
 * arriving as a wall.
 */
export function termsBlocks(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      const lines = chunk
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) return [];
      const [first, ...rest] = lines;
      // A heading is short and is not itself a sentence.
      const isHeading =
        rest.length > 0 && first.length <= 60 && !/[.!?;:,]$/.test(first);
      if (isHeading) return [{ title: first, body: rest.join("\n\n") }];
      return lines.map((line) => ({ title: "", body: line }));
    });
}
