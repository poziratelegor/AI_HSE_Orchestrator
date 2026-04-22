import { describe, expect, it, vi } from "vitest";
import {
  findTelegramUserByEmailAndFullName,
  normalizeTelegramAuthEmail,
  normalizeTelegramAuthFullName,
  TELEGRAM_AUTH_GENERIC_FAILURE_MESSAGE,
  TELEGRAM_AUTH_SUPPORT_MESSAGE,
} from "@/lib/telegram/auth";

function buildSupabaseMock(rows: Array<{ id: string; email: string | null; full_name: string | null }>) {
  return {
    from: () => ({
      select: () => ({
        ilike: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    }),
  };
}

describe("telegram auth normalization", () => {
  it("normalizes email with trim + lowercase", () => {
    expect(normalizeTelegramAuthEmail("  USER@HSE.RU ")).toBe("user@hse.ru");
  });

  it("normalizes full name with compact spaces and ё/е unification", () => {
    expect(normalizeTelegramAuthFullName("  Пётр   ПЕТРОВ  ")).toBe("петр петров");
  });
});

describe("findTelegramUserByEmailAndFullName", () => {
  it("finds a single matching profile by normalized email and full_name", async () => {
    const result = await findTelegramUserByEmailAndFullName(" USER@HSE.RU ", "Пётр   Петров", {
      supabase: buildSupabaseMock([
        { id: "u-1", email: "user@hse.ru", full_name: "Петр Петров" },
      ]),
    });

    expect(result).toEqual({ ok: true, userId: "u-1" });
  });

  it("returns generic message when full_name does not match", async () => {
    const result = await findTelegramUserByEmailAndFullName("user@hse.ru", "Иван Иванов", {
      supabase: buildSupabaseMock([
        { id: "u-1", email: "user@hse.ru", full_name: "Петр Петров" },
      ]),
    });

    expect(result).toEqual({
      ok: false,
      reason: "not_found_or_mismatch",
      message: TELEGRAM_AUTH_GENERIC_FAILURE_MESSAGE,
    });
  });

  it("returns support message and duplicate_email reason for duplicate email", async () => {
    const result = await findTelegramUserByEmailAndFullName("user@hse.ru", "Петр Петров", {
      supabase: buildSupabaseMock([
        { id: "u-1", email: "user@hse.ru", full_name: "Петр Петров" },
        { id: "u-2", email: "USER@HSE.RU", full_name: "Петр Петров" },
      ]),
    });

    expect(result).toEqual({
      ok: false,
      reason: "duplicate_email",
      message: TELEGRAM_AUTH_SUPPORT_MESSAGE,
    });
  });

  it("returns generic message when email not found", async () => {
    const result = await findTelegramUserByEmailAndFullName("user@hse.ru", "Петр Петров", {
      supabase: buildSupabaseMock([]),
    });

    expect(result).toEqual({
      ok: false,
      reason: "not_found_or_mismatch",
      message: TELEGRAM_AUTH_GENERIC_FAILURE_MESSAGE,
    });
  });
});
