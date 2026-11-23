import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HealthCheck } from "./health-check";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HealthCheck", () => {
  it("renders the service version when the backend responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            service: "kindly-api",
            version: "0.1.0",
            environment: "test",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    render(<HealthCheck />);

    expect(screen.getByText(/checking the kindly service/i)).toBeInTheDocument();
    expect(await screen.findByText(/service online — kindly-api v0.1.0/i)).toBeInTheDocument();
  });

  it("renders an honest error when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    render(<HealthCheck />);

    expect(await screen.findByText(/service check failed/i)).toBeInTheDocument();
  });
});
