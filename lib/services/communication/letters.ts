import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { buildLetterPrompt } from "@/lib/ai/prompts";
import { loadStudentContext } from "@/lib/ai/student-context";
import type { WorkflowContext } from "@/lib/orchestrator/executor";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_SUBJECT_LENGTH = 180;
const DEFAULT_SUBJECT = "Официальное обращение";

function normalizeSubject(subject: unknown, fallbackText: string): string {
  const fromModel = typeof subject === "string" ? subject.trim() : "";
  if (fromModel) return fromModel.slice(0, MAX_SUBJECT_LENGTH);

  const fromPrompt = fallbackText.trim().replace(/\s+/g, " ").slice(0, MAX_SUBJECT_LENGTH);
  return fromPrompt || DEFAULT_SUBJECT;
}

type LetterResult = {
  ok: true;
  workflow: string;
  summary: string;
  letterId: string | null;
  data: { subject: string; body: string };
} | {
  ok: false;
  workflow: string;
  error: string;
  message: string;
};

async function saveLetterDraft(params: {
  userId: string;
  subject: string;
  body: string;
  sourcePrompt: string;
}): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();
    const payload = {
      user_id: params.userId,
      subject: params.subject.slice(0, MAX_SUBJECT_LENGTH),
      body: params.body,
      source_prompt: params.sourcePrompt,
      status: "draft"
    };

    const { data, error } = await supabase.from("letters").insert(payload).select("id").single();

    if (error) {
      console.error("[letters] insert failed:", error);
      return null;
    }

    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.error("[letters] insert failed:", err);
    return null;
  }
}

export async function runLetterGenerator(text: string, ctx?: WorkflowContext): Promise<LetterResult> {
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  // Load student context for personalized signature (cached)
  const studentCtx = ctx?.userId ? await loadStudentContext(ctx.userId) : null;
  const systemPrompt = buildLetterPrompt(studentCtx);

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create(
        {
          model: DEFAULT_MODEL,
          temperature: 0.3,
          max_tokens: 1200,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Напиши официальное письмо на основе следующего запроса студента:\n\n${text}`
            }
          ]
        },
        { signal: controller.signal }
      )
    );

    clearTimeout(timeout);

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    // Strip accidental markdown code fences if model adds them
    const clean = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(clean) as { subject?: string; body?: string };
      const subject = normalizeSubject(parsed.subject, text);
      const body = parsed.body ?? clean;
      const letterId =
        ctx?.userId
          ? await saveLetterDraft({
              userId: ctx.userId,
              subject,
              body,
              sourcePrompt: text
            })
          : null;

      return {
        ok: true,
        workflow: "letter_generator",
        summary: subject,
        letterId,
        data: {
          subject,
          body
        }
      };
    } catch {
      // JSON parse failed — use raw text as body, still a usable result
      const subject = normalizeSubject("", text);
      const letterId =
        ctx?.userId
          ? await saveLetterDraft({
              userId: ctx.userId,
              subject,
              body: raw,
              sourcePrompt: text
            })
          : null;

      return {
        ok: true,
        workflow: "letter_generator",
        summary: subject,
        letterId,
        data: {
          subject,
          body: raw
        }
      };
    }
  } catch (err: unknown) {
    clearTimeout(timeout);

    const isAbort =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));

    return {
      ok: false,
      workflow: "letter_generator",
      error: isAbort ? "timeout" : "openai_error",
      message: isAbort
        ? "Запрос к OpenAI превысил таймаут 30 секунд."
        : err instanceof Error
        ? err.message
        : "Неизвестная ошибка OpenAI."
    };
  }
}
