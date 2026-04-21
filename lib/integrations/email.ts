import { Resend } from "resend";
import { createLogger } from "@/lib/logger";

const logger = createLogger("email");

let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export interface SendEmailOptions {
  /** Recipient email */
  to: string | string[];
  /** Email subject */
  subject: string;
  /** HTML body */
  html: string;
  /** Plain text fallback */
  text?: string;
  /** Sender email (default: noreply@studyflow.ai) */
  from?: string;
  /** Reply-to address */
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Resend.
 *
 * Returns { ok: true, id } on success, { ok: false, error } on failure.
 * Never throws — safe to call fire-and-forget.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    subject,
    html,
    text,
    from = "StudyFlow AI <noreply@studyflow.ai>",
    replyTo,
  } = options;

  try {
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      replyTo,
    });

    if (error) {
      logger.error("Failed to send email", new Error(error.message), {
        to: Array.isArray(to) ? to.join(", ") : to,
        subject,
      });
      return { ok: false, error: error.message };
    }

    logger.info("Email sent", {
      id: data?.id,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
    });

    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    logger.error("Email send exception", err, { to, subject });
    return { ok: false, error: message };
  }
}

/**
 * Send a generated letter as an email attachment or inline content.
 *
 * Designed to work with letter_generator workflow output.
 */
export async function sendGeneratedLetter(options: {
  to: string;
  letterSubject: string;
  letterBody: string;
  studentName?: string;
}): Promise<SendEmailResult> {
  const { to, letterSubject, letterBody, studentName } = options;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; color: white; padding: 1rem 1.5rem; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 1.1rem;">📧 StudyFlow AI — Сгенерированное письмо</h2>
      </div>
      <div style="padding: 1.5rem; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        ${studentName ? `<p style="color: #6b7280; font-size: 0.875rem;">Отправлено от: ${studentName}</p>` : ""}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0;" />
        <div style="white-space: pre-wrap; line-height: 1.6;">${letterBody}</div>
      </div>
      <p style="color: #9ca3af; font-size: 0.75rem; text-align: center; margin-top: 1rem;">
        Сгенерировано StudyFlow AI • ${new Date().toLocaleDateString("ru-RU")}
      </p>
    </div>
  `.trim();

  return sendEmail({
    to,
    subject: letterSubject,
    html,
    text: letterBody,
  });
}
