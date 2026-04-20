const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP_SENTENCES = 2;
const MIN_CHUNK_SIZE = 100;

// Matches markdown / plain-text headings:
//   ## Heading, ### Heading, **Heading**, ЗАГЛАВНЫЕ СЛОВА
const HEADING_RE =
  /^(#{1,6}\s.+|[*_]{2}.{3,80}[*_]{2}|[А-ЯA-Z][А-ЯA-Z\s\d:–\-]{4,60}[А-ЯA-Z\d])$/;

// Sentence-end boundary: dot/!? followed by whitespace and next sentence start
const SENTENCE_END_RE = /(?<=[.!?…»])\s+(?=[А-ЯA-ZЁ\d"«])/g;

/** Split text into sentences, preserving trailing punctuation. */
function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let last = 0;
  for (const m of text.matchAll(SENTENCE_END_RE)) {
    parts.push(text.slice(last, m.index).trim());
    last = (m.index ?? 0) + m[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

/** Detect whether a line looks like a section heading. */
function isHeading(line: string): boolean {
  return HEADING_RE.test(line.trim());
}

/**
 * Split raw text into semantic paragraphs.
 * A paragraph boundary is either:
 *   - a blank line (double newline), or
 *   - a line that looks like a heading
 */
function splitParagraphs(text: string): string[] {
  const lines = text.split("\n");
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();

    if (line === "") {
      // Blank line → flush current paragraph
      if (current.length > 0) {
        paragraphs.push(current.join(" ").trim());
        current = [];
      }
    } else if (isHeading(line)) {
      // Heading → flush previous paragraph, then heading becomes its own paragraph
      if (current.length > 0) {
        paragraphs.push(current.join(" ").trim());
      }
      paragraphs.push(line);
      current = [];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) paragraphs.push(current.join(" ").trim());

  return paragraphs.filter(Boolean);
}

/**
 * Splits text into overlapping chunks that respect paragraph and sentence
 * boundaries.
 *
 * Algorithm:
 *   1. Split into paragraphs (blank lines / headings).
 *   2. Accumulate paragraphs until `chunkSize` is reached, then flush.
 *   3. Overlap = last N sentences of the flushed chunk prepended to the next.
 *   4. Tiny trailing chunks (< MIN_CHUNK_SIZE) are merged into the previous one.
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlapSentences = DEFAULT_OVERLAP_SENTENCES
): string[] {
  if (!text || !text.trim()) return [];

  const normalised = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  const paragraphs = splitParagraphs(normalised);

  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = "";
  let overlapPrefix = "";

  const flush = () => {
    const candidate = current.trim();
    if (!candidate) return;

    // Build overlap: take last `overlapSentences` sentences from current chunk
    const sentences = splitSentences(candidate);
    const overlapSents = sentences.slice(-overlapSentences);
    overlapPrefix = overlapSents.join(" ").trim();

    chunks.push(candidate);
    current = "";
  };

  for (const para of paragraphs) {
    const candidate = current ? current + "\n\n" + para : para;

    if (candidate.length > chunkSize && current.length > 0) {
      // Current paragraph would overflow → flush first
      flush();
      current = overlapPrefix ? overlapPrefix + "\n\n" + para : para;
    } else {
      current = candidate;
    }

    // If a single paragraph is itself oversized, split it by sentences
    if (current.length > chunkSize * 1.5) {
      const sentences = splitSentences(current);
      let buf = overlapPrefix;
      for (const s of sentences) {
        const next = buf ? buf + " " + s : s;
        if (next.length > chunkSize && buf.length > 0) {
          chunks.push(buf.trim());
          const bufSentences = splitSentences(buf);
          overlapPrefix = bufSentences.slice(-overlapSentences).join(" ").trim();
          buf = overlapPrefix ? overlapPrefix + " " + s : s;
        } else {
          buf = next;
        }
      }
      current = buf;
      overlapPrefix = "";
    }
  }

  // Flush remainder
  if (current.trim()) {
    chunks.push(current.trim());
  }

  // Merge tiny trailing chunks into the previous one
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length < MIN_CHUNK_SIZE && result.length > 0) {
      result[result.length - 1] += "\n\n" + chunk;
    } else {
      result.push(chunk);
    }
  }

  return result;
}
