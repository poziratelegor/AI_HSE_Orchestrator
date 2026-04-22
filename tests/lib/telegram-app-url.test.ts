import { afterEach, describe, expect, it } from "vitest";
import { getTelegramCtaLinks } from "@/lib/telegram/app-url";

describe("getTelegramCtaLinks", () => {
  const envBackup = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = envBackup;
  });

  it("builds links from canonical NEXT_PUBLIC_APP_URL origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.studyflow.ai/some/path?x=1";

    const links = getTelegramCtaLinks();

    expect(links.signupUrl).toBe("https://app.studyflow.ai/signup");
    expect(links.hasCanonicalUrl).toBe(true);
  });

  it("falls back to localhost links when NEXT_PUBLIC_APP_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const links = getTelegramCtaLinks();

    expect(links.signupUrl).toBe("http://localhost:3000/signup");
    expect(links.hasCanonicalUrl).toBe(false);
  });
});
