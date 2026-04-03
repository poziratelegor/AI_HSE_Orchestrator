const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 150;

/**
 * Splits text into overlapping chunks on sentence boundaries.
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP
): string[] {
  if (!text || !text.trim()) return [];

  // Normalise whitespace but preserve paragraph breaks
  const normalised = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  // Split into sentences (keep delimiter attached)
  const sentencePattern = /(?<=[.!?])\s+(?=[А-ЯA-Z\d"])/g;
  const sentences: string[] = [];
  let last = 0;
  for (const match of normalised.matchAll(sentencePattern)) {
    sentences.push(normalised.slice(last, match.index).trim());
    last = match.index! + match[0].length;
  }
  sentences.push(normalised.slice(last).trim());
  const nonEmpty = sentences.filter(Boolean);

  if (nonEmpty.length === 0) return [];

  const chunks: string[] = [];
  let current = "";
  let overlapBuffer = "";

  for (const sentence of nonEmpty) {
    if ((current + " " + sentence).trim().length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      // Build overlap from end of current chunk
      const words = current.split(" ");
      let ov = "";
      for (let i = words.length - 1; i >= 0; i--) {
        const candidate = words[i] + " " + ov;
        if (candidate.length > overlap) break;
        ov = candidate;
      }
      overlapBuffer = ov.trim();
      current = overlapBuffer ? overlapBuffer + " " + sentence : sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks;
}
