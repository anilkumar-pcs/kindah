import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("returns JSON on success and sends credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ service: "kindly-api" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<{ service: string }>("/api/v1/meta");

    expect(result.service).toBe("kindly-api");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/meta",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("maps problem+json errors to ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "https://kindly.local/problems/wish-unavailable",
            title: "Wish unavailable",
            status: 409,
            code: "WISH_UNAVAILABLE",
            detail: "This wish is no longer available.",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );

    await expect(apiFetch("/api/v1/gifts")).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      code: "WISH_UNAVAILABLE",
      message: "This wish is no longer available.",
    });
  });

  it("maps network failures to a safe ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(apiFetch("/api/v1/meta")).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch("/api/v1/meta")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });

  it("handles 204 responses without parsing a body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiFetch("/api/v1/meta")).resolves.toBeUndefined();
  });
});
