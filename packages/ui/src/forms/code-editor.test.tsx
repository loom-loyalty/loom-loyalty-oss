// Smoke coverage for the CodeEditor primitive. CodeMirror's editing internals
// need real layout that jsdom can't drive (typing, doc rendering), so this only
// asserts the component mounts and exposes an accessible editing region. The
// seed/inject/edit behavior is verified via the Storybook story and the
// transformation editor's integration test.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CodeEditor } from "./code-editor";

describe("CodeEditor", () => {
  it("mounts with an accessible editing region", () => {
    render(<CodeEditor ariaLabel="Transformation handler code" />);

    const region = screen.getByLabelText("Transformation handler code");
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("contenteditable", "true");
  });

  it("renders a read-only region (not contenteditable)", () => {
    render(<CodeEditor initialValue="const x = 1;" readOnly ariaLabel="Snippet" />);

    const region = screen.getByLabelText("Snippet");
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("contenteditable", "false");
  });
});
