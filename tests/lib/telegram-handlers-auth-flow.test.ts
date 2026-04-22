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

  it("normalizes auth profile search with dashes, brackets and commas", () => {
    const tokens = __telegramHandlerTestables.getSafeProfileSearchTokens("Иванов-(Иван), ПМИ-221");
    expect(tokens).toEqual(["иванов", "иван", "пми", "221"]);
    expect(__telegramHandlerTestables.buildProfileOrFilter(tokens)).toBe(
      "full_name.ilike.%иванов%,group_name.ilike.%иванов%,full_name.ilike.%иван%,group_name.ilike.%иван%,full_name.ilike.%пми%,group_name.ilike.%пми%,full_name.ilike.%221%,group_name.ilike.%221%"
    );
  });
});
