import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("renders the primary trust and legal link groups", () => {
    render(<SiteFooter />);

    const explore = screen.getByRole("navigation", { name: /explore kindly/i });
    expect(within(explore).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(explore).getByRole("link", { name: "Discover" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(within(explore).getByRole("link", { name: "Share a wish" })).toHaveAttribute(
      "href",
      "/me#wish",
    );

    const trust = screen.getByRole("navigation", { name: /trust and support/i });
    expect(within(trust).getByRole("link", { name: "About Kindly" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(within(trust).getByRole("link", { name: "Safety centre" })).toHaveAttribute(
      "href",
      "/safety",
    );

    const legal = screen.getByRole("navigation", { name: /legal and accessibility/i });
    expect(within(legal).getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/legal#privacy",
    );
    expect(within(legal).getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/legal#terms",
    );
    expect(within(legal).getByRole("link", { name: "Accessibility" })).toHaveAttribute(
      "href",
      "/legal#accessibility",
    );
  });

  it("states the product boundaries without overclaiming", () => {
    render(<SiteFooter />);

    expect(screen.getByText(/not a charity, crowdfunding platform, wallet, escrow/i)).toBeVisible();
    expect(screen.getByText(/does not hold or verify money/i)).toBeVisible();
    expect(screen.getByText(/18\+ only/i)).toBeVisible();
    expect(screen.getByText(/working drafts and need legal review/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /read the draft declarations/i })).toHaveAttribute(
      "href",
      "/legal",
    );
  });
});
