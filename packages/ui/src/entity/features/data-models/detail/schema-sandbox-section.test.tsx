import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as SchemaUtils from "../schema-utils.js";
import { validateJsonAgainstSchema } from "../schema-utils.js";
import { SchemaSandboxSection } from "./schema-sandbox-section";

// Mock the validator so we can drive each result branch deterministically
// without paying the real `ajv.compile` cost on every test.
vi.mock("../schema-utils.js", async () => {
  const actual = await vi.importActual<typeof SchemaUtils>("../schema-utils.js");
  return {
    ...actual,
    validateJsonAgainstSchema: vi.fn(),
  };
});

const mockedValidate = validateJsonAgainstSchema as ReturnType<typeof vi.fn>;

const SCHEMA = { type: "object", properties: { email: { type: "string" } } };

describe("SchemaSandboxSection", () => {
  beforeEach(() => {
    mockedValidate.mockReset();
  });

  function expand() {
    fireEvent.click(screen.getByRole("button", { name: /try a sample payload/i }));
  }

  it("renders collapsed by default with expand affordance", () => {
    render(<SchemaSandboxSection schema={SCHEMA} />);
    const toggle = screen.getByRole("button", { name: /try a sample payload/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("expands and shows the textarea when toggled", () => {
    render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hide sandbox/i })).toBeInTheDocument();
  });

  it("enforces a 1MB maxLength on the sandbox textarea to prevent main-thread freeze", () => {
    render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(1_000_000);
  });

  it("disables Validate until input is non-empty", () => {
    render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    const validateBtn = screen.getByRole("button", { name: /^validate$/i });
    expect(validateBtn).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: '{"email": "a"}' } });
    expect(validateBtn).not.toBeDisabled();
  });

  it("renders parseError branch when JSON is malformed", async () => {
    mockedValidate.mockResolvedValue({
      valid: false,
      errors: [],
      parseError: "Unexpected token } in JSON at position 5",
    });
    render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "{bad json" } });
    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/invalid json/i);
    expect(alert).toHaveTextContent("Unexpected token } in JSON at position 5");
  });

  it("renders success branch when validation passes", async () => {
    mockedValidate.mockResolvedValue({ valid: true, errors: [] });
    render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: '{"email": "a"}' } });
    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));

    const success = await screen.findByText(/all fields match the schema/i);
    expect(success).toBeInTheDocument();
  });

  it("renders per-field errors when validation reports failures", async () => {
    mockedValidate.mockResolvedValue({
      valid: false,
      errors: [
        { path: "/email", message: "must be string", keyword: "type" },
        { path: "/age", message: "must be integer", keyword: "type" },
      ],
    });
    render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: '{"email": 1, "age": "x"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));

    expect(await screen.findByText(/2 validation errors/i)).toBeInTheDocument();
    expect(screen.getByText("/email")).toBeInTheDocument();
    expect(screen.getByText("must be string")).toBeInTheDocument();
    expect(screen.getByText("/age")).toBeInTheDocument();
    expect(screen.getByText("must be integer")).toBeInTheDocument();
  });

  it("pluralizes validation errors correctly for a single error", async () => {
    mockedValidate.mockResolvedValue({
      valid: false,
      errors: [{ path: "/email", message: "required", keyword: "required" }],
    });
    render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));

    expect(await screen.findByText(/1 validation error\b/i)).toBeInTheDocument();
  });

  it("shows the Clear button after a validation result and resets state on click", async () => {
    mockedValidate.mockResolvedValue({ valid: true, errors: [] });
    render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"email": "a"}' } });
    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));

    await screen.findByText(/all fields match the schema/i);
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));

    expect(textarea.value).toBe("");
    expect(screen.queryByText(/all fields match the schema/i)).not.toBeInTheDocument();
  });

  it("shows Validating… state while the promise is pending", async () => {
    let resolveFn: (v: { valid: boolean; errors: never[] }) => void = () => {};
    mockedValidate.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      })
    );

    render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: '{"email": "a"}' } });
    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));

    const pendingBtn = await screen.findByRole("button", { name: /validating/i });
    expect(pendingBtn).toBeDisabled();

    await act(async () => {
      resolveFn({ valid: true, errors: [] });
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /validating/i })).not.toBeInTheDocument();
    });
  });

  it("does not update state after unmount (mountedRef guard)", async () => {
    let resolveFn: (v: { valid: boolean; errors: never[] }) => void = () => {};
    mockedValidate.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      })
    );

    const { unmount } = render(<SchemaSandboxSection schema={SCHEMA} />);
    expand();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: '{"email": "a"}' } });
    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));

    // Unmount before the validation promise resolves
    unmount();

    // Resolving after unmount must NOT throw "cannot set state on unmounted component".
    // React 18 logs the warning to console.error; assert there is no such call.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      resolveFn({ valid: true, errors: [] });
      // Let the microtask queue drain
      await Promise.resolve();
    });
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("unmounted component"),
      expect.anything()
    );
    errorSpy.mockRestore();
  });
});
