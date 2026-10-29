import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocalizedStringInput } from "./localized-string-input";

describe("[audit] LocalizedStringInput data-widget attrs", () => {
  it("renders data-widget='locale-tabbed-input' on the wrapper", () => {
    const { container } = render(<LocalizedStringInput />);
    expect(container.querySelector('[data-widget="locale-tabbed-input"]')).not.toBeNull();
  });

  it("emits data-required-locale='en' by default", () => {
    const { container } = render(<LocalizedStringInput />);
    const root = container.querySelector("[data-widget]");
    expect(root?.getAttribute("data-required-locale")).toBe("en");
  });

  it("reflects custom defaultLanguages[0] in data-required-locale", () => {
    const { container } = render(<LocalizedStringInput defaultLanguages={["es"]} />);
    const root = container.querySelector("[data-widget]");
    expect(root?.getAttribute("data-required-locale")).toBe("es");
  });

  it("omits data-required-locale entirely when defaultLanguages is []", () => {
    const { container } = render(<LocalizedStringInput defaultLanguages={[]} />);
    const root = container.querySelector("[data-widget]");
    expect(root?.hasAttribute("data-required-locale")).toBe(false);
  });
});

describe("[audit] LocalizedStringInput empty-strip + en-required behavior", () => {
  it("strips empty-string values from onChange callback", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hello", es: "" }} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Enter text");
    fireEvent.change(input, { target: { value: "updated" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0]?.[0];
    expect(arg).not.toHaveProperty("es");
    expect(arg).toEqual({ en: "updated" });
  });

  it("strips whitespace-only values from onChange callback", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Enter text");
    fireEvent.change(input, { target: { value: "   " } });
    const arg = onChange.mock.calls[0]?.[0];
    expect(arg).not.toHaveProperty("en");
    expect(arg).toEqual({});
  });

  it("does not invent empty values when caller passes value={{}}", () => {
    const { container } = render(<LocalizedStringInput value={{}} />);
    expect(container.querySelector('[data-widget="locale-tabbed-input"]')).not.toBeNull();
  });

  it("locks deletion of the default 'en' locale", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: /Remove/i })).toBeNull();
  });

  it("strips empty entries that arrive via existing value when re-emitting", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi", fr: "", de: "x" }} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Enter text");
    fireEvent.change(input, { target: { value: "hello" } });
    const arg = onChange.mock.calls[0]?.[0];
    expect(arg).toEqual({ en: "hello", de: "x" });
  });
});

describe("[audit] LocalizedStringInput add-language behavior", () => {
  function clickAddLanguageAndSubmit(langCode: string) {
    fireEvent.click(screen.getByRole("button", { name: /Add Language/i }));
    fireEvent.change(screen.getByPlaceholderText(/Lang code/i), { target: { value: langCode } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
  }

  it("does not emit a transient empty value to onChange when a language is added", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("es");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("makes the pending locale selectable in the language dropdown without emitting", () => {
    const onChange = vi.fn();
    const { container } = render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("es");

    expect(onChange).not.toHaveBeenCalled();
    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger?.textContent?.toLowerCase()).toContain("es");
  });

  it("emits only on first non-empty keystroke after adding a locale", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("es");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Enter text"), { target: { value: "hola" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual({ en: "hi", es: "hola" });
  });

  it("does not leak a phantom orphan locale into form submit", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("es");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("removing a pending locale drops it without emitting onChange", () => {
    const onChange = vi.fn();
    const { container } = render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("es");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Remove$/i }));

    expect(onChange).not.toHaveBeenCalled();
    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger?.textContent?.toLowerCase()).not.toContain("es");
  });
});

describe("[audit] LocalizedStringInput defaultLanguages=[] guard", () => {
  it("does not phantom-write 'en' when defaultLanguages=[] and no value", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput defaultLanguages={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Enter text");
    fireEvent.change(input, { target: { value: "anything" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the input when defaultLanguages=[] and no languages registered", () => {
    render(<LocalizedStringInput defaultLanguages={[]} />);
    expect(screen.getByPlaceholderText("Enter text")).toBeDisabled();
  });

  it("becomes typeable once user adds a language under defaultLanguages=[]", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput defaultLanguages={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Add Language/i }));
    fireEvent.change(screen.getByPlaceholderText(/Lang code/i), { target: { value: "es" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

    const input = screen.getByPlaceholderText("Enter text");
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: "hola" } });
    expect(onChange).toHaveBeenCalledWith({ es: "hola" });
  });
});

describe("[audit] LocalizedStringInput locale code validation", () => {
  function clickAddLanguageAndSubmit(langCode: string) {
    fireEvent.click(screen.getByRole("button", { name: /Add Language/i }));
    fireEvent.change(screen.getByPlaceholderText(/Lang code/i), { target: { value: langCode } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
  }

  it("rejects multi-letter codes that don't match BCP-47 short form (english)", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("english");

    expect(screen.getByPlaceholderText(/Lang code/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects single-character codes", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("e");

    expect(screen.getByPlaceholderText(/Lang code/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects codes with non-letter characters", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("!@");

    expect(screen.getByPlaceholderText(/Lang code/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts valid two-letter codes (es)", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("es");

    expect(screen.queryByPlaceholderText(/Lang code/i)).toBeNull();
  });

  it("accepts valid region-tagged codes (fr_CA)", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("fr_CA");

    expect(screen.queryByPlaceholderText(/Lang code/i)).toBeNull();
  });

  it("trims whitespace before validation", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("  es  ");

    expect(screen.queryByPlaceholderText(/Lang code/i)).toBeNull();
  });

  it("normalizes mixed-case region tags to BCP-47 short form", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("fr_ca");
    fireEvent.change(screen.getByPlaceholderText("Enter text"), { target: { value: "salut" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual({ en: "hi", fr_CA: "salut" });
  });
});

describe("[audit] LocalizedStringInput locale code inline error", () => {
  function openAddInput() {
    fireEvent.click(screen.getByRole("button", { name: /Add Language/i }));
  }

  function typeAndAdd(langCode: string) {
    fireEvent.change(screen.getByPlaceholderText(/Lang code/i), { target: { value: langCode } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
  }

  it("shows an inline error with role=alert when the locale code is invalid", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} />);

    openAddInput();
    typeAndAdd("english");

    const error = screen.getByRole("alert");
    expect(error).toBeInTheDocument();
    expect(error.textContent).toMatch(/locale|format|es|fr_CA/i);
  });

  it("wires aria-invalid + aria-describedby on the lang-code input when error is shown", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} />);

    openAddInput();
    typeAndAdd("english");

    const input = screen.getByPlaceholderText(/Lang code/i);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const error = screen.getByRole("alert");
    expect(error.id).toBe(describedBy);
  });

  it("clears the error when the user edits the locale code field", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} />);

    openAddInput();
    typeAndAdd("english");
    expect(screen.queryByRole("alert")).not.toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Lang code/i), { target: { value: "es" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the error when the Cancel button is clicked", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} />);

    openAddInput();
    typeAndAdd("english");
    expect(screen.queryByRole("alert")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    openAddInput();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the error when Escape is pressed in the lang-code input", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} />);

    openAddInput();
    typeAndAdd("english");
    expect(screen.queryByRole("alert")).not.toBeNull();

    fireEvent.keyDown(screen.getByPlaceholderText(/Lang code/i), { key: "Escape" });
    openAddInput();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not show an error for empty input (user hasn't typed yet)", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} />);

    openAddInput();
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("[audit] LocalizedStringInput ARIA forwarding", () => {
  it("forwards aria-invalid to the underlying input", () => {
    render(<LocalizedStringInput aria-invalid />);
    expect(screen.getByPlaceholderText("Enter text").getAttribute("aria-invalid")).toBe("true");
  });

  it("forwards aria-describedby to the underlying input", () => {
    render(<LocalizedStringInput aria-describedby="error-id" />);
    expect(screen.getByPlaceholderText("Enter text").getAttribute("aria-describedby")).toBe(
      "error-id"
    );
  });

  it("omits aria-invalid when not provided", () => {
    render(<LocalizedStringInput />);
    expect(screen.getByPlaceholderText("Enter text").hasAttribute("aria-invalid")).toBe(false);
  });
});

describe("[audit] LocalizedStringInput defensive runtime guards", () => {
  it("does not crash when value=null", () => {
    expect(() =>
      render(<LocalizedStringInput value={null as unknown as Record<string, string>} />)
    ).not.toThrow();
  });

  it("does not crash when value contains non-string entries", () => {
    const onChange = vi.fn();
    expect(() =>
      render(
        <LocalizedStringInput
          value={{ en: "hi", es: null as unknown as string } as Record<string, string>}
          onChange={onChange}
        />
      )
    ).not.toThrow();

    const input = screen.getByPlaceholderText("Enter text");
    expect(() => fireEvent.change(input, { target: { value: "world" } })).not.toThrow();
  });
});

describe("[audit] LocalizedStringInput typing-during-strip stability", () => {
  it("keeps a user-added locale selectable after the parent strips it on clear", () => {
    let lastValue: Record<string, string> = { en: "hi" };
    const onChange = vi.fn((next: Record<string, string>) => {
      lastValue = next;
    });
    const { rerender } = render(<LocalizedStringInput value={lastValue} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Add Language/i }));
    fireEvent.change(screen.getByPlaceholderText(/Lang code/i), { target: { value: "es" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

    fireEvent.change(screen.getByPlaceholderText("Enter text"), { target: { value: "x" } });
    rerender(<LocalizedStringInput value={lastValue} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Enter text"), { target: { value: "" } });
    rerender(<LocalizedStringInput value={lastValue} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Enter text"), { target: { value: "y" } });
    const calls = onChange.mock.calls;
    const lastCall = calls[calls.length - 1]?.[0];
    expect(lastCall).toEqual({ en: "hi", es: "y" });
  });

  it("seeds registered locales from initial value (Remove preserves the entry across parent rerenders)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LocalizedStringInput value={{ en: "hi", es: "h" }} onChange={onChange} />
    );

    const items = container.querySelectorAll('[role="combobox"]');
    expect(items.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Add Language/i }));
    fireEvent.change(screen.getByPlaceholderText(/Lang code/i), { target: { value: "es" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("[audit] LocalizedStringInput id forwarding", () => {
  it("forwards id prop to the underlying input element", () => {
    render(<LocalizedStringInput id="probe-locale-id" />);
    const input = screen.getByPlaceholderText("Enter text");
    expect(input.id).toBe("probe-locale-id");
  });

  it("omits id attribute when no id prop is passed", () => {
    render(<LocalizedStringInput />);
    const input = screen.getByPlaceholderText("Enter text");
    expect(input.id).toBe("");
  });

  it("forwards id when multiline=true (Textarea variant)", () => {
    render(<LocalizedStringInput id="probe-area-id" multiline />);
    const input = screen.getByPlaceholderText("Enter text");
    expect(input.id).toBe("probe-area-id");
  });
});
