import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetSupabaseUserFromRequest = vi.fn();
const mockGetSupabaseRouteClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseUserFromRequest: mockGetSupabaseUserFromRequest,
  getSupabaseRouteClient: mockGetSupabaseRouteClient,
}));

describe("GET /api/analytics/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns normalized response shape", async () => {
    mockGetSupabaseUserFromRequest.mockResolvedValue({ user: { id: "user-1" } });

    const limitSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: "evt-1",
          event_name: "orchestrate_success",
          created_at: "2026-04-20T12:00:00.000Z",
          meta: { queryPreview: "Собери план к экзамену" },
        },
      ],
      error: null,
    });

    mockGetSupabaseRouteClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              order: () => ({
                limit: limitSpy,
              }),
            }),
          }),
        }),
      }),
    });

    const { GET } = await import("@/app/api/analytics/history/route");
    const response = await GET(new Request("http://localhost/api/analytics/history"));
    const body = (await response.json()) as {
      ok: boolean;
      items: Array<{ id: string; text: string; status: string; createdAt: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toEqual([
      {
        id: "evt-1",
        text: "Собери план к экзамену",
        status: "Готово",
        createdAt: "2026-04-20T12:00:00.000Z",
      },
    ]);
  });

  it("caps limit to max value", async () => {
    mockGetSupabaseUserFromRequest.mockResolvedValue({ user: { id: "user-2" } });

    const limitSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    mockGetSupabaseRouteClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              order: () => ({
                limit: limitSpy,
              }),
            }),
          }),
        }),
      }),
    });

    const { GET } = await import("@/app/api/analytics/history/route");
    await GET(new Request("http://localhost/api/analytics/history?limit=999"));

    expect(limitSpy).toHaveBeenCalledWith(20);
  });
});
