/**
 * Segment of parsed text — either plain text or a citation reference.
 */
export type CitationSegment =
  | { type: "text"; value: string }
  | { type: "citation"; value: number };

/**
 * Parses inline citations like [1], [2], [10] from RAG response text.
 * Returns segments suitable for rendering with React.
 *
 * Examples:
 *   parseCitations("См. [1] далее") →
 *     [{ type: "text", value: "См. " }, { type: "citation", value: 1 }, { type: "text", value: " далее" }]
 *
 *   parseCitations("[1][2]") →
 *     [{ type: "citation", value: 1 }, { type: "citation", value: 2 }]
 */
export function parseCitations(input: string): CitationSegment[] {
  if (!input) return [];

  const segments: CitationSegment[] = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: input.slice(lastIndex, match.index) });
    }
    segments.push({ type: "citation", value: Number(match[1]) });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({ type: "text", value: input.slice(lastIndex) });
  }

  return segments;
}
