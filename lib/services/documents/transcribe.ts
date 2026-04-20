import { getOpenAIClient } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";

const WHISPER_MODEL = "whisper-1";

// Whisper supports up to 25 MB per request
const MAX_WHISPER_SIZE_BYTES = 25 * 1024 * 1024;

// Map MIME types to file extensions expected by Whisper
const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "mp4",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/x-m4a": "m4a"
};

/**
 * Transcribes an audio buffer using OpenAI Whisper API.
 * Supports Russian and English — Whisper auto-detects language.
 *
 * For files > 25 MB, splits into ~24 MB chunks (simple byte split —
 * works for most compressed audio formats).
 */
export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) {
    throw new Error(
      `Неподдерживаемый формат аудио: ${mimeType}. ` +
        `Поддерживаются: ${Object.keys(MIME_TO_EXT).join(", ")}`
    );
  }

  const openai = getOpenAIClient();

  if (buffer.byteLength <= MAX_WHISPER_SIZE_BYTES) {
    return transcribeChunk(openai, buffer, ext);
  }

  // Split into chunks for large files
  const parts: Buffer[] = [];
  for (let offset = 0; offset < buffer.byteLength; offset += MAX_WHISPER_SIZE_BYTES) {
    parts.push(buffer.subarray(offset, offset + MAX_WHISPER_SIZE_BYTES));
  }

  console.info(`[transcribe] Splitting ${buffer.byteLength} bytes into ${parts.length} chunks`);

  const transcripts = await Promise.all(parts.map((part) => transcribeChunk(openai, part, ext)));
  return transcripts.join(" ");
}

async function transcribeChunk(
  openai: ReturnType<typeof getOpenAIClient>,
  buffer: Buffer,
  ext: string
): Promise<string> {
  // OpenAI SDK accepts a File object or anything file-like with .name
  // We build a proper File from the buffer using the Web Streams File API
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: `audio/${ext}` });
  const file = new File([blob], `audio.${ext}`, { type: `audio/${ext}` });

  const response = await withRetry(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    openai.audio.transcriptions.create({
      model: WHISPER_MODEL,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      file: file as any,
      language: undefined, // auto-detect
      response_format: "text"
    })
  );

  return typeof response === "string" ? response : (response as { text: string }).text ?? "";
}
