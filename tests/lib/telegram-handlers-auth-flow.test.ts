import { describe, expect, it } from "vitest";
import { __telegramHandlerTestables } from "@/lib/telegram/handlers";

describe("telegram auth-flow callbacks", () => {
  it("parses auth callback payloads", () => {
    expect(__telegramHandlerTestables.parseCallbackPayload("auth:start")).toBe("auth:start");
    expect(__telegramHandlerTestables.parseCallbackPayload("auth:cancel")).toBe("auth:cancel");
    expect(__telegramHandlerTestables.parseCallbackPayload("auth:confirm:user-1")).toBe("auth:confirm:user-1");
  });

  it("rejects unknown payloads", () => {
    expect(__telegramHandlerTestables.parseCallbackPayload("auth:unknown")).toBeNull();
    expect(__telegramHandlerTestables.parseCallbackPayload(123)).toBeNull();
  });
});
