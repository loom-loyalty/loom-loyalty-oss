import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  isOverLocalizedLimit,
  LocalizedStringInput,
  javaStrip,
  localizedTextLength,
} from "./localized-string-input";

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

  // Changed with the BCP 47 key decision (portal welcome copy brief, round 3):
  // added locales are stored as `fr-CA`, no longer `fr_CA`.
  it("normalizes mixed-case region tags to BCP 47 (fr_ca -> fr-CA)", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);

    clickAddLanguageAndSubmit("fr_ca");
    fireEvent.change(screen.getByPlaceholderText("Enter text"), { target: { value: "salut" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual({ en: "hi", "fr-CA": "salut" });
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

describe("javaStrip (mirrors Java String.strip())", () => {
  it("strips Java whitespace but keeps non-breaking spaces and U+FEFF", () => {
    expect(javaStrip("\t a b \u2003")).toBe("a b");
    expect(javaStrip("\u00a0x\u00a0")).toBe("\u00a0x\u00a0");
    expect(javaStrip("\ufeff")).toBe("\ufeff");
    expect(javaStrip(" \n ")).toBe("");
  });
});

describe("localizedTextLength (mirrors Java String.strip().length())", () => {
  it("counts plain ASCII", () => {
    expect(localizedTextLength("hello")).toBe(5);
  });

  it("strips ASCII whitespace and line breaks at both ends", () => {
    expect(localizedTextLength("  \t hello \n\r ")).toBe(5);
  });

  it("strips Unicode spaces Java treats as whitespace (U+2003, U+3000, U+2028)", () => {
    expect(localizedTextLength("\u2003\u3000hi\u2028")).toBe(2);
  });

  it("keeps a leading and trailing NBSP (Java isWhitespace is false for U+00A0)", () => {
    expect(localizedTextLength("\u00a0hi\u00a0")).toBe(4);
  });

  it("keeps U+2007, U+202F and U+FEFF at the edges", () => {
    expect(localizedTextLength("\u2007a\u202f")).toBe(3);
    expect(localizedTextLength("\ufeffa")).toBe(2);
  });

  it("counts an emoji outside the BMP as 2 UTF-16 units", () => {
    expect(localizedTextLength("\u{1F389}")).toBe(2);
    expect(localizedTextLength(" a\u{1F389} ")).toBe(3);
  });

  it("counts whitespace-only as 0", () => {
    expect(localizedTextLength(" \n\t ")).toBe(0);
  });

  it("keeps inner whitespace", () => {
    expect(localizedTextLength(" a  b ")).toBe(4);
  });
});

describe("isOverLocalizedLimit", () => {
  it("is false when every locale fits", () => {
    expect(isOverLocalizedLimit({ en: "abc", es: "abcd" }, 4)).toBe(false);
  });

  it("is true when any one locale is over", () => {
    expect(isOverLocalizedLimit({ en: "abc", es: "abcde" }, 4)).toBe(true);
  });

  it("counts after stripping, like the API", () => {
    expect(isOverLocalizedLimit({ en: "  abcd  " }, 4)).toBe(false);
  });

  it("tolerates null, undefined and non-string entries", () => {
    expect(isOverLocalizedLimit(undefined, 4)).toBe(false);
    expect(isOverLocalizedLimit(null, 4)).toBe(false);
    expect(isOverLocalizedLimit({ en: null as unknown as string }, 4)).toBe(false);
  });
});

describe("LocalizedStringInput maxLength", () => {
  it("shows no counter when maxLength is not set", () => {
    render(<LocalizedStringInput value={{ en: "hello" }} />);
    expect(screen.queryByText(/\/\s*\d+/)).toBeNull();
  });

  it("shows a counter for the active locale, counted like the API", () => {
    render(<LocalizedStringInput value={{ en: "  hello  ", es: "hola" }} maxLength={120} />);
    expect(screen.getByText("5 / 120")).toBeInTheDocument();
  });

  it("updates the counter as the parent value changes", () => {
    const { rerender } = render(<LocalizedStringInput value={{ en: "ab" }} maxLength={10} />);
    expect(screen.getByText("2 / 10")).toBeInTheDocument();
    rerender(<LocalizedStringInput value={{ en: "abc\u{1F389}" }} maxLength={10} />);
    expect(screen.getByText("5 / 10")).toBeInTheDocument();
  });

  it("links the counter to the input with aria-describedby, merged with the caller's", () => {
    render(
      <LocalizedStringInput value={{ en: "hi" }} maxLength={10} aria-describedby="field-error" />
    );
    const input = screen.getByPlaceholderText("Enter text");
    const ids = (input.getAttribute("aria-describedby") ?? "").split(/\s+/);
    expect(ids).toContain("field-error");
    const counter = screen.getByText("2 / 10");
    expect(ids).toContain(counter.id);
  });

  it("does not set aria-invalid while within the limit", () => {
    render(<LocalizedStringInput value={{ en: "abc" }} maxLength={3} />);
    expect(screen.getByPlaceholderText("Enter text").hasAttribute("aria-invalid")).toBe(false);
    expect(screen.queryByText(/over the/i)).toBeNull();
  });

  it("over the limit, shows an inline error linked to the input and sets aria-invalid", () => {
    render(<LocalizedStringInput value={{ en: "abcdef" }} maxLength={4} />);
    const input = screen.getByPlaceholderText("Enter text");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const error = screen.getByText(/2 characters over the 4-character limit/i);
    expect((input.getAttribute("aria-describedby") ?? "").split(/\s+/)).toContain(error.id);
    // Reached through aria-describedby, not a live region: a live region would re-announce on
    // every keystroke, and the form's own save-blocked alert already speaks once.
    expect(error.getAttribute("role")).toBeNull();
    expect(error.closest("[aria-live]")).toBeNull();
  });

  it("still emits an over-limit value; the form decides whether to block submit", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "ab" }} maxLength={3} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Enter text"), {
      target: { value: "abcdefgh" },
    });
    expect(onChange).toHaveBeenCalledWith({ en: "abcdefgh" });
  });

  it("names another locale that is over the limit when the active one fits", () => {
    render(<LocalizedStringInput value={{ en: "ok", es: "demasiado" }} maxLength={4} />);
    const input = screen.getByPlaceholderText("Enter text");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/Over the 4-character limit in ES/)).toBeInTheDocument();
  });

  it("does not set a native maxlength attribute (stripping would make it wrong)", () => {
    render(<LocalizedStringInput value={{ en: "a" }} maxLength={4} />);
    expect(screen.getByPlaceholderText("Enter text").hasAttribute("maxlength")).toBe(false);
  });
});

describe("LocalizedStringInput rows", () => {
  it("defaults the textarea to 4 rows", () => {
    render(<LocalizedStringInput multiline />);
    expect(screen.getByPlaceholderText("Enter text").getAttribute("rows")).toBe("4");
  });

  it("uses the rows prop for the textarea", () => {
    render(<LocalizedStringInput multiline rows={10} />);
    expect(screen.getByPlaceholderText("Enter text").getAttribute("rows")).toBe("10");
  });

  it("ignores rows on a single-line input", () => {
    render(<LocalizedStringInput rows={10} />);
    expect(screen.getByPlaceholderText("Enter text").hasAttribute("rows")).toBe(false);
  });
});

describe("LocalizedStringInput BCP 47 locale keys", () => {
  function addLanguage(langCode: string) {
    fireEvent.click(screen.getByRole("button", { name: /Add Language/i }));
    fireEvent.change(screen.getByPlaceholderText(/Lang code/i), { target: { value: langCode } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
  }

  it("stores a typed es_MX as es-MX", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);
    addLanguage("es_MX");
    fireEvent.change(screen.getByPlaceholderText("Enter text"), { target: { value: "hola" } });
    expect(onChange).toHaveBeenCalledWith({ en: "hi", "es-MX": "hola" });
  });

  it("stores a typed es-mx as es-MX", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi" }} onChange={onChange} />);
    addLanguage("es-mx");
    fireEvent.change(screen.getByPlaceholderText("Enter text"), { target: { value: "hola" } });
    expect(onChange).toHaveBeenCalledWith({ en: "hi", "es-MX": "hola" });
  });

  it("still displays and edits an existing underscore key (fr_CA)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LocalizedStringInput
        value={{ en: "hi", fr_CA: "salut" }}
        onChange={onChange}
        defaultLanguages={["fr_CA"]}
      />
    );
    const input = screen.getByPlaceholderText("Enter text");
    expect(input).toHaveValue("salut");
    expect(container.querySelector('[role="combobox"]')?.textContent).toMatch(/fr_CA/i);
    fireEvent.change(input, { target: { value: "bonjour" } });
    expect(onChange).toHaveBeenCalledWith({ en: "hi", fr_CA: "bonjour" });
  });

  it("selects the existing underscore key instead of adding a duplicate fr-CA", () => {
    const onChange = vi.fn();
    render(<LocalizedStringInput value={{ en: "hi", fr_CA: "salut" }} onChange={onChange} />);
    addLanguage("fr-CA");
    const input = screen.getByPlaceholderText("Enter text");
    expect(input).toHaveValue("salut");
    fireEvent.change(input, { target: { value: "bonjour" } });
    expect(onChange).toHaveBeenCalledWith({ en: "hi", fr_CA: "bonjour" });
  });

  it("rejects a malformed code with the inline error", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} />);
    addLanguage("es_MX_extra");
    expect(screen.getByRole("alert").textContent).toMatch(/es-MX/);
  });
});

describe("LocalizedStringInput preview", () => {
  const preview = (text: string) => <strong data-testid="rendered">{text.toUpperCase()}</strong>;

  it("shows no Write/Preview toggle without a preview prop", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} />);
    expect(screen.queryByRole("button", { name: /^Preview$/ })).toBeNull();
  });

  it("starts in Write mode with aria-pressed reflecting the mode", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} preview={preview} />);
    expect(screen.getByRole("button", { name: /^Write$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Preview$/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
    expect(screen.queryByTestId("rendered")).toBeNull();
  });

  it("renders preview(activeText) for the active locale when Preview is pressed", () => {
    const spy = vi.fn(preview);
    render(<LocalizedStringInput value={{ en: "hi", es: "hola" }} preview={spy} multiline />);
    fireEvent.click(screen.getByRole("button", { name: /^Preview$/ }));
    expect(screen.getByRole("button", { name: /^Preview$/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("rendered")).toHaveTextContent("HI");
    expect(spy).toHaveBeenCalledWith("hi");
    expect(screen.queryByPlaceholderText("Enter text")).toBeNull();
  });

  it("returns to Write mode and keeps the text", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} preview={preview} />);
    fireEvent.click(screen.getByRole("button", { name: /^Preview$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Write$/ }));
    expect(screen.getByPlaceholderText("Enter text")).toHaveValue("hi");
    expect(screen.queryByTestId("rendered")).toBeNull();
  });

  it("toggles are native buttons (keyboard-operable) at least 44px tall", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} preview={preview} />);
    for (const name of [/^Write$/, /^Preview$/]) {
      const button = screen.getByRole("button", { name });
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      expect(button.className).toMatch(/min-h-11/);
      expect(button.className).toMatch(/min-w-11/);
    }
  });

  it("labels the preview region", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} preview={preview} />);
    fireEvent.click(screen.getByRole("button", { name: /^Preview$/ }));
    expect(screen.getByRole("region", { name: /preview/i })).toContainElement(
      screen.getByTestId("rendered")
    );
  });

  it("keeps the counter visible in Preview mode", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} preview={preview} maxLength={10} />);
    fireEvent.click(screen.getByRole("button", { name: /^Preview$/ }));
    expect(screen.getByText("2 / 10")).toBeInTheDocument();
  });

  it("names its editor-mode toggle, preview and language select after the field's label", () => {
    render(
      <>
        <label htmlFor="terms">Program terms</label>
        <LocalizedStringInput
          id="terms"
          label="Program terms"
          value={{ en: "**Hi**" }}
          preview={(text) => <span>{text}</span>}
        />
      </>
    );

    expect(screen.getByRole("group", { name: "Program terms editor mode" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Program terms language" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    const region = screen.getByRole("region", { name: "Program terms preview" });
    // The input is unmounted in preview, so the label's htmlFor resolves to the preview instead.
    expect(region.id).toBe("terms");
  });

  it("names the language select 'Language' when no label is given", () => {
    render(<LocalizedStringInput value={{ en: "hi" }} />);
    expect(screen.getByRole("combobox", { name: "Language" })).toBeInTheDocument();
  });
});
