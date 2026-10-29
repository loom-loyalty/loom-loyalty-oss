import { RESOURCE_CODE_PATTERN } from "@loom-loyalty/conventions";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodeInput, formatTransforms, useCodeInput, validateCode } from "./code-input";

describe("[audit] CodeInput data-widget attrs", () => {
  it("renders data-widget='code-input' on the wrapper", () => {
    const { container } = render(<CodeInput sourceValue="" value="" onChange={() => {}} />);
    expect(container.querySelector('[data-widget="code-input"]')).not.toBeNull();
  });

  it("emits data-format reflecting the format prop", () => {
    const { container } = render(
      <CodeInput sourceValue="" value="" onChange={() => {}} format="upper-snake-case" />
    );
    const wrapper = container.querySelector("[data-widget]");
    expect(wrapper?.getAttribute("data-format")).toBe("upper-snake-case");
  });

  it("defaults data-format to kebab-case", () => {
    const { container } = render(<CodeInput sourceValue="" value="" onChange={() => {}} />);
    const wrapper = container.querySelector("[data-widget]");
    expect(wrapper?.getAttribute("data-format")).toBe("kebab-case");
  });

  it("reports data-format='custom' when caller passes a custom transform", () => {
    const { container } = render(
      <CodeInput
        sourceValue=""
        value=""
        onChange={() => {}}
        format="upper-snake-case"
        transform={(s) => s}
      />
    );
    const wrapper = container.querySelector("[data-widget]");
    expect(wrapper?.getAttribute("data-format")).toBe("custom");
  });
});

// ---------------------------------------------------------------------------
// formatTransforms["kebab-case"] — recurrence guard for the resource-code
// convention. This is the default format, used by every entity CodeInput
// generates a resource-code-validated code for (Badge, Tier, Program,
// ProgramCurrency, MetadataGroup, ...). Untested before this: the previous
// implementation stripped leading/trailing hyphens BEFORE truncating to 50
// characters, so a source value whose 50th character landed on a hyphen
// could still produce a trailing-hyphen code the API's resource-code
// pattern rejects.
// ---------------------------------------------------------------------------
describe("[audit] formatTransforms kebab-case stays resource-code compliant", () => {
  const kebabCase = formatTransforms["kebab-case"];

  it("produces the expected code for a normal name", () => {
    expect(kebabCase("My Loyalty Program")).toBe("my-loyalty-program");
  });

  it("never returns a trailing hyphen even when truncation would land on one", () => {
    // 49 letters + a space lands the 50th character (index 49) on the
    // hyphen the space becomes, which the old implementation returned as-is.
    const value = `${"a".repeat(49)} b`;
    const code = kebabCase(value);
    expect(code.endsWith("-")).toBe(false);
    expect(RESOURCE_CODE_PATTERN.test(code)).toBe(true);
  });

  it("returns an empty string, not a placeholder, for an all-invalid source value", () => {
    expect(kebabCase("!!!")).toBe("");
  });

  it("produces exactly an empty string for values with no valid characters at all", () => {
    for (const value of ["", "   ", "---", "!!!", "..."]) {
      expect(kebabCase(value), value).toBe("");
    }
  });

  it("produces a pattern-valid code for a range of adversarial values with real content", () => {
    // No "or empty" escape hatch here: each of these has at least one
    // alphanumeric character, so a code must come out, and it must be valid.
    const values = [
      "Gold Tier!!",
      "50% Off",
      "a".repeat(100),
      "Café Münster",
      "a".repeat(49) + " b",
    ];
    for (const value of values) {
      expect(RESOURCE_CODE_PATTERN.test(kebabCase(value)), value).toBe(true);
    }
  });
});

describe("validateCode", () => {
  it("returns null for every value when the pattern is 'none'", () => {
    for (const value of ["GOLD_TIER", "customer.created", "!!!", "fine"]) {
      expect(validateCode(value, "none")).toBeNull();
    }
  });

  it("treats an empty value as a required-field concern, not a pattern violation", () => {
    expect(validateCode("", "resource")).toBeNull();
    expect(validateCode("", "event-type")).toBeNull();
  });

  it("rejects an UPPER_SNAKE resource code with the API's own message", () => {
    const error = validateCode("GOLD_TIER", "resource");
    expect(error).toContain("lowercase letters/numbers in single-hyphen-separated segments");
  });

  it("accepts a compliant resource code", () => {
    expect(validateCode("gold-tier", "resource")).toBeNull();
  });

  it("holds event-type codes to the other pattern, not the resource one", () => {
    // A dot is fine for an event type and fatal for a resource code.
    expect(validateCode("customer.created", "event-type")).toBeNull();
    expect(validateCode("customer.created", "resource")).not.toBeNull();
    // A leading digit is the reverse.
    expect(validateCode("3-points", "resource")).toBeNull();
    expect(validateCode("3-points", "event-type")).not.toBeNull();
  });
});

const ERROR_SLOT = '[data-slot="code-input-error"]';

describe("CodeInput validation rendering", () => {
  it("renders nothing and stays valid when no pattern is opted into", () => {
    const { container } = render(
      <CodeInput sourceValue="" value="GOLD_TIER" onChange={() => {}} />
    );
    expect(container.querySelector(ERROR_SLOT)).toBeNull();
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("marks the input invalid and links the message when the value violates the pattern", () => {
    const { container } = render(
      <CodeInput sourceValue="" value="GOLD_TIER" onChange={() => {}} pattern="resource" />
    );

    const message = container.querySelector(ERROR_SLOT);
    expect(message?.textContent).toContain("single-hyphen-separated segments");

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    // The message must be the thing the input points at, or a screen reader
    // never reaches it.
    expect(input.getAttribute("aria-describedby")).toBe(message?.getAttribute("id"));
  });

  it("keeps a caller's own aria-describedby alongside the error message", () => {
    // Several sheets describe a code field with a hint paragraph. The props
    // spread must not clobber the error association, nor the hint.
    const { container } = render(
      <CodeInput
        sourceValue=""
        value="GOLD_TIER"
        onChange={() => {}}
        pattern="resource"
        aria-describedby="tier-code-hint"
      />
    );

    const errorId = container.querySelector(ERROR_SLOT)?.getAttribute("id");
    const describedBy = screen.getByRole("textbox").getAttribute("aria-describedby");
    expect(describedBy).toContain("tier-code-hint");
    expect(describedBy).toContain(errorId);
  });

  it("leaves a caller's aria-describedby untouched when there is no error", () => {
    render(
      <CodeInput
        sourceValue=""
        value="gold-tier"
        onChange={() => {}}
        pattern="resource"
        aria-describedby="tier-code-hint"
      />
    );
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe("tier-code-hint");
  });

  // Regression, pre-existing and worse than the lockout it was found next to.
  // This component keeps its own `isManuallyEdited`, separate from
  // `useCodeInput`'s, so the auto-generate effect used to fire even for a locked,
  // disabled field and overwrite the persisted code with one derived from the
  // name. Sheet fixtures hid it by using codes that matched their names.
  it("never rewrites the value of a disabled field from sourceValue", () => {
    const onChange = vi.fn();
    render(
      <CodeInput
        sourceValue="Spend 100"
        value="FINISH_ONBOARDING"
        onChange={onChange}
        pattern="resource"
        disabled
      />
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("FINISH_ONBOARDING");
  });

  // Regression: an editable sheet opened on a saved record (the Hub event-rule
  // edit sheet) renamed "onboarding-set-up-data" to "onboarding-shape-your-data"
  // because this effect treated the persisted code as not yet chosen.
  it("keeps a saved code that differs from the one derived from sourceValue", () => {
    const onChange = vi.fn();
    render(
      <CodeInput
        sourceValue="Onboarding Shape your data"
        value="onboarding-set-up-data"
        onChange={onChange}
        pattern="resource"
      />
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("onboarding-set-up-data");
  });

  it("keeps a saved code that arrives after mount", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CodeInput sourceValue="" value="" onChange={onChange} pattern="resource" />
    );
    rerender(
      <CodeInput
        sourceValue="Onboarding Shape your data"
        value="onboarding-set-up-data"
        onChange={onChange}
        pattern="resource"
      />
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("onboarding-set-up-data");
  });

  it("derives again from sourceValue after Reset on a saved code", () => {
    const onChange = vi.fn();
    render(
      <CodeInput
        sourceValue="Onboarding Shape your data"
        value="onboarding-set-up-data"
        onChange={onChange}
        showReset
      />
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "custom-code" } });
    onChange.mockClear();
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("onboarding-shape-your-data");
  });

  it("keeps tracking sourceValue while the value still matches it", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CodeInput sourceValue="Spend 100" value="spend-100" onChange={onChange} />
    );
    rerender(<CodeInput sourceValue="Spend 200" value="spend-100" onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith("spend-200");
  });

  it("still auto-generates when the field is enabled", () => {
    const onChange = vi.fn();
    render(<CodeInput sourceValue="Spend 100" value="" onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith("spend-100");
  });

  it("shows no error on a disabled field, even for a non-compliant value", () => {
    // Same reasoning as useCodeInput's `locked` exemption: a value the user
    // cannot reach is not something to complain about.
    const { container } = render(
      <CodeInput sourceValue="" value="GOLD_TIER" onChange={() => {}} pattern="resource" disabled />
    );
    expect(container.querySelector(ERROR_SLOT)).toBeNull();
  });

  it("does not use role='alert' — that altitude belongs to form-level errors", () => {
    // Consuming sheets assert on queryByRole("alert") for their own submit
    // errors; a field-level message must not show up in that query.
    render(<CodeInput sourceValue="" value="GOLD_TIER" onChange={() => {}} pattern="resource" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the error once the value complies", () => {
    const { container, rerender } = render(
      <CodeInput sourceValue="" value="GOLD_TIER" onChange={() => {}} pattern="resource" />
    );
    expect(container.querySelector(ERROR_SLOT)).not.toBeNull();

    rerender(<CodeInput sourceValue="" value="gold-tier" onChange={() => {}} pattern="resource" />);
    expect(container.querySelector(ERROR_SLOT)).toBeNull();
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("lets an explicitly-passed error win over the computed one", () => {
    // A caller pairing this with useCodeInput passes the hook's verdict; passing
    // an explicit null must suppress, not fall through to recomputation.
    const { container } = render(
      <CodeInput
        sourceValue=""
        value="GOLD_TIER"
        onChange={() => {}}
        pattern="resource"
        error={null}
      />
    );
    expect(container.querySelector(ERROR_SLOT)).toBeNull();
  });
});

describe("useCodeInput error reporting", () => {
  it("reports no error by default, whatever the value", () => {
    const { result } = renderHook(() => useCodeInput("Gold Tier", { initialValue: "GOLD_TIER" }));
    expect(result.current.error).toBeNull();
  });

  it("reports the API message once a pattern is opted into", () => {
    const { result } = renderHook(() =>
      useCodeInput("Gold Tier", { initialValue: "GOLD_TIER", pattern: "resource" })
    );
    expect(result.current.error).not.toBeNull();
  });

  // Regression, and the important one. `locked` is edit mode: the value is
  // pinned to the persisted code and the field renders disabled. Reporting an
  // error there disabled Save over a value the user could not change, so a
  // legacy record became uneditable in every respect — name, description, all of
  // it. Pre-convention codes are widespread in real tenant data, so this would
  // have bitten immediately.
  it("reports no error for a locked legacy value, however non-compliant", () => {
    for (const legacy of ["GOLD_TIER", "FINISH_ONBOARDING", "LOYALTY-63e2cfae", "POINTS"]) {
      const { result } = renderHook(() =>
        useCodeInput("Gold Tier", { initialValue: legacy, locked: true, pattern: "resource" })
      );
      expect(result.current.value, "locked value must be preserved verbatim").toBe(legacy);
      expect(result.current.error, `locked legacy code ${legacy}`).toBeNull();
    }
  });

  it("still reports the error for the same value when NOT locked", () => {
    // The exemption is about reachability, not about the code being acceptable.
    const { result } = renderHook(() =>
      useCodeInput("Gold Tier", { initialValue: "GOLD_TIER", pattern: "resource" })
    );
    expect(result.current.error).not.toBeNull();
  });

  it("never errors on its own auto-generated value", () => {
    // The generator and the validator share one definition, so this is a
    // property of the pair rather than a coincidence of one input.
    for (const name of ["Gold Tier", "Gold — Tier!", "  spaced  out  ", "MY_TIER", "3 Points"]) {
      const { result } = renderHook(() => useCodeInput(name, { pattern: "resource" }));
      expect(result.current.error, `auto-generated code for ${name}`).toBeNull();
    }
  });

  it("never errors on its own auto-generated event-type value", () => {
    for (const name of ["Purchase Completed", "My App.Purchase", "2024 Summer", "!!!"]) {
      const { result } = renderHook(() =>
        useCodeInput(name, { pattern: "event-type", format: "dot-case" })
      );
      expect(result.current.error, `auto-generated code for ${name}`).toBeNull();
    }
  });
});

// kebab-case has its own suite above ("stays resource-code compliant"). These
// cover the two formats that suite does not.
describe("formatTransforms", () => {
  it("dot-case preserves namespacing", () => {
    expect(formatTransforms["dot-case"]("My App.Purchase Completed")).toBe(
      "my-app.purchase-completed"
    );
    expect(formatTransforms["dot-case"]("!!!")).toBe("");
  });

  it("leaves upper-snake-case alone — its only remaining consumers are exempt", () => {
    expect(formatTransforms["upper-snake-case"]("My Loyalty Program")).toBe("MY_LOYALTY_PROGRAM");
  });
});
