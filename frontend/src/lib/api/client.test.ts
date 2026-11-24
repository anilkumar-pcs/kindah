import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "./client";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth/token-store";

afterEach(() => {
  vi.unstubAllGlobals();
  clearAccessToken();
  document.cookie = "kindly_csrf=; Max-Age=0; path=/";
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

  it("attaches the in-memory access token", async () => {
    setAccessToken("access-token-1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/v1/me");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-token-1");
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    setAccessToken("expired-token");
    document.cookie = "kindly_csrf=test-csrf; path=/";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "SESSION_EXPIRED" }), {
          status: 401,
          headers: { "Content-Type": "application/problem+json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "new-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "user-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<{ id: string }>("/api/v1/me");

    expect(result.id).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:8000/api/v1/auth/refresh");
    const refreshInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const refreshHeaders = new Headers(refreshInit.headers);
    expect(refreshHeaders.get("X-CSRF-Token")).toBe("test-csrf");
    const retryInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const retryHeaders = new Headers(retryInit.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer new-token");
    expect(getAccessToken()).toBe("new-token");
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
