import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownDocument } from "./markdown-document";

describe("MarkdownDocument", () => {
  it("renders headings, lists and GFM tables", () => {
    render(
      <MarkdownDocument
        content={"# Terms\n\n- one\n- two\n\n| Plan | Fee |\n| --- | --- |\n| Base | $500 |"}
      />
    );
    expect(screen.getByRole("heading", { name: "Terms" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "$500" })).toBeInTheDocument();
  });

  it("drops images and never renders raw HTML", () => {
    const { container } = render(
      <MarkdownDocument
        content={'![pixel](https://example.com/p.png)\n\n<b data-testid="raw">bold</b>'}
      />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByTestId("raw")).toBeNull();
  });

  it("keeps an unsafe link's text but not its href", () => {
    render(
      <MarkdownDocument content={"[click](javascript:alert(1)) [docs](https://docs.example.com)"} />
    );
    expect(screen.queryByRole("link", { name: "click" })).toBeNull();
    expect(screen.getByText("click")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute(
      "href",
      "https://docs.example.com"
    );
  });

  it("drops headings one level and renders no image", () => {
    render(
      <MarkdownDocument content={"# Terms\n\n![Signature block](https://example.com/s.png)"} />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Terms" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("opens safe links in a new tab without an opener", () => {
    render(<MarkdownDocument content={"[docs](https://docs.example.com)"} />);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each(["JavaScript:alert(1)", "data:text/html,hi", "vbscript:msgbox(1)"])(
    "renders %s as plain text",
    (href) => {
      render(<MarkdownDocument content={`[bad](${href})`} />);
      expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
      expect(screen.getByText("bad")).toBeInTheDocument();
    }
  );

  it("never mounts a script tag from the source", () => {
    const { container } = render(<MarkdownDocument content={"<script>window.x=1</script>"} />);
    expect(container.querySelector("script")).toBeNull();
  });
});
