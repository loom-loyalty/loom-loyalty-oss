import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock useThread before importing the component so the hook returns spies we
// can assert against. Each test resets the spies in beforeEach.
const processMessage = vi.fn();
const cancelMessage = vi.fn();
const switchToNewThread = vi.fn();
const threadState: { isRunning: boolean; threadError: Error | null } = {
  isRunning: false,
  threadError: null,
};

vi.mock("@openuidev/react-headless", () => {
  // useThread() returns the slice; useThread(selector) maps the slice.
  // Our store exposes the three actions and the two state fields the
  // composer reads (isRunning, threadError). Tests mutate threadState
  // to drive failure paths.
  const store = {
    processMessage: (...args: unknown[]) => processMessage(...args),
    cancelMessage: () => cancelMessage(),
    get isRunning() {
      return threadState.isRunning;
    },
    get threadError() {
      return threadState.threadError;
    },
  };
  const listStore = { switchToNewThread: () => switchToNewThread() };
  return {
    useThread: (selector?: (s: typeof store) => unknown) => (selector ? selector(store) : store),
    useThreadList: (selector?: (s: typeof listStore) => unknown) =>
      selector ? selector(listStore) : listStore,
  };
});

import { LoomComposer } from "../composer";
import { InitialMessageContext, type InitialMessageHandoff } from "../initial-message-sender";

const noopProps = {
  onSend: vi.fn(),
  onCancel: vi.fn(),
  isRunning: false,
  isLoadingMessages: false,
};

const makeFile = (
  name: string,
  contents: string,
  type = "application/octet-stream",
  size?: number
): File => {
  const file = new File([contents], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size });
  }
  return file;
};

beforeEach(() => {
  processMessage.mockReset();
  cancelMessage.mockReset();
  threadState.isRunning = false;
  threadState.threadError = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("LoomComposer", () => {
  it("renders the text input, attach button, and send button", () => {
    render(<LoomComposer {...noopProps} />);
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /attach a program template/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("submits a plain text message as a string when no file is attached", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    await user.type(screen.getByLabelText("Message"), "hello world");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(processMessage).toHaveBeenCalledTimes(1);
    expect(processMessage).toHaveBeenCalledWith({ role: "user", content: "hello world" });
  });

  it("shows an attachment chip with the filename after a valid .md file is selected", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    const file = makeFile("template.md", "# program template", "text/markdown");
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByTestId("attachment-chip")).toHaveTextContent("template.md");
  });

  it("rejects unsupported file types with an inline error and no chip", async () => {
    render(<LoomComposer {...noopProps} />);

    const file = makeFile("notes.pdf", "%PDF-1.4", "application/pdf");
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    // user-event's upload respects the accept attribute and would filter the
    // .pdf out before our handler runs. fireEvent.change bypasses that filter,
    // letting us exercise the in-component validation path directly.
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByTestId("composer-error")).toHaveTextContent(/only \.md and \.xlsx/i);
    expect(screen.queryByTestId("attachment-chip")).not.toBeInTheDocument();
  });

  it("rejects files exceeding the 5 MB cap", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    const oversize = makeFile(
      "huge.xlsx",
      "x",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      6 * 1024 * 1024
    );
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    await user.upload(input, oversize);

    expect(await screen.findByTestId("composer-error")).toHaveTextContent(/too large/i);
    expect(screen.queryByTestId("attachment-chip")).not.toBeInTheDocument();
  });

  it("clears the chip when the remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    const file = makeFile("template.md", "# x", "text/markdown");
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    await user.upload(input, file);

    await user.click(await screen.findByRole("button", { name: /remove attachment/i }));

    expect(screen.queryByTestId("attachment-chip")).not.toBeInTheDocument();
  });

  it("submits content as InputContent[] with text + binary when both are present", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    const file = makeFile("template.md", "# program template", "text/markdown");
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    await user.upload(input, file);
    await screen.findByTestId("attachment-chip");

    await user.type(screen.getByLabelText("Message"), "please apply this");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(processMessage).toHaveBeenCalledTimes(1));
    const [msg] = processMessage.mock.calls[0]!;
    expect(msg).toMatchObject({ role: "user" });
    const content = msg.content as Array<{ type: string; [k: string]: unknown }>;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]).toMatchObject({ type: "text", text: "please apply this" });
    expect(content[1]).toMatchObject({
      type: "binary",
      mimeType: "text/markdown",
      filename: "template.md",
    });
    const binary = content[1] as unknown as { data: string };
    expect(typeof binary.data).toBe("string");
    expect(binary.data.length).toBeGreaterThan(0);
  });

  it("submits binary-only content when there is no text", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    const file = makeFile("template.md", "# x", "text/markdown");
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    await user.upload(input, file);
    await screen.findByTestId("attachment-chip");

    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(processMessage).toHaveBeenCalledTimes(1));
    const [msg] = processMessage.mock.calls[0]!;
    const content = msg.content as Array<{ type: string }>;
    expect(Array.isArray(content)).toBe(true);
    expect(content).toHaveLength(1);
    expect(content[0]!.type).toBe("binary");
  });

  it("does not submit when text is empty and no file is attached", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(processMessage).not.toHaveBeenCalled();
  });

  it("disables the send button when both text and attachment are empty", () => {
    render(<LoomComposer {...noopProps} />);
    const send = screen.getByRole("button", { name: /send/i });
    expect(send).toBeDisabled();
  });

  it("enables the send button when text is present", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    await user.type(screen.getByLabelText("Message"), "hello");
    expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
  });

  it("surfaces threadError as an inline alert and restores the input", async () => {
    const user = userEvent.setup();
    // processMessage simulates the store: it does NOT reject. Instead, the
    // store catches its own throws and writes them to threadError. We make
    // it complete normally and then drive threadError ourselves.
    let setStoreError: (e: Error) => void = () => {};
    processMessage.mockImplementation(async () => {
      // Capture a function tests can call to flip threadError post-submit.
      setStoreError = (e) => {
        threadState.threadError = e;
      };
    });

    const { rerender } = render(<LoomComposer {...noopProps} />);
    await user.type(screen.getByLabelText("Message"), "hello world");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(processMessage).toHaveBeenCalled());

    // Simulate the store updating threadError after the call resolved.
    setStoreError(new Error("Network outage"));
    rerender(<LoomComposer {...noopProps} />);

    expect(await screen.findByTestId("composer-error")).toHaveTextContent(/network outage/i);
    // Input is restored so the user can retry without retyping.
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("hello world");
  });

  it("clears the stale error banner when the user retries after a failure", async () => {
    // Regression: when shownError was derived from the store's threadError
    // directly (which never resets), the failed-banner stayed visible
    // through the entire retry round trip. With a local shownError that
    // submit clears, the banner disappears the moment the user resubmits.
    const user = userEvent.setup();
    let setStoreError: (e: Error) => void = () => {};
    processMessage.mockImplementation(async () => {
      setStoreError = (e) => {
        threadState.threadError = e;
      };
    });

    const { rerender } = render(<LoomComposer {...noopProps} />);
    await user.type(screen.getByLabelText("Message"), "first try");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(processMessage).toHaveBeenCalledTimes(1));
    setStoreError(new Error("Server failed"));
    rerender(<LoomComposer {...noopProps} />);
    expect(await screen.findByTestId("composer-error")).toHaveTextContent(/server failed/i);

    // Retry — submit clears the banner synchronously.
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(screen.queryByTestId("composer-error")).not.toBeInTheDocument();
  });

  it("restores the attachment when threadError fires after a binary submit", async () => {
    const user = userEvent.setup();
    let setStoreError: (e: Error) => void = () => {};
    processMessage.mockImplementation(async () => {
      setStoreError = (e) => {
        threadState.threadError = e;
      };
    });

    const { rerender } = render(<LoomComposer {...noopProps} />);
    const file = makeFile("template.md", "# x", "text/markdown");
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    await user.upload(input, file);
    await screen.findByTestId("attachment-chip");

    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(processMessage).toHaveBeenCalled());

    setStoreError(new Error("Parse failed"));
    rerender(<LoomComposer {...noopProps} />);

    expect(await screen.findByTestId("composer-error")).toHaveTextContent(/parse failed/i);
    expect(screen.queryByTestId("attachment-chip")).toHaveTextContent("template.md");
  });

  it("enables the send button when an attachment is present", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    const file = makeFile("template.md", "# x", "text/markdown");
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    await user.upload(input, file);
    await screen.findByTestId("attachment-chip");

    expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
  });

  it("clears the input and attachment after a successful submit", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    const file = makeFile("template.md", "# x", "text/markdown");
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    await user.upload(input, file);
    await screen.findByTestId("attachment-chip");

    await user.type(screen.getByLabelText("Message"), "go");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(processMessage).toHaveBeenCalled());

    expect(screen.queryByTestId("attachment-chip")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");
  });

  it("submits via Enter (without shift) without using the send button", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    await user.type(textarea, "hello{Enter}");

    expect(processMessage).toHaveBeenCalledWith({ role: "user", content: "hello" });
  });

  it("does not submit and inserts a newline on shift+Enter", async () => {
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    await user.type(textarea, "line1{Shift>}{Enter}{/Shift}line2");

    expect(processMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe("line1\nline2");
  });

  it("switches the send button to a stop button while running and calls cancelMessage on click", async () => {
    threadState.isRunning = true;
    const user = userEvent.setup();
    render(<LoomComposer {...noopProps} />);

    await user.click(screen.getByRole("button", { name: /stop/i }));
    expect(cancelMessage).toHaveBeenCalledTimes(1);
    expect(processMessage).not.toHaveBeenCalled();
  });

  it("blocks submit during the post-cancel cooldown and re-enables after the timer fires", async () => {
    // Real timers — fake timers + RTL leaves the act/render queue parked and
    // never surfaces the post-cooldown re-render. The cooldown is 750ms so
    // the real wait is bounded.
    threadState.isRunning = true;
    const { rerender } = render(<LoomComposer {...noopProps} />);

    // Click Stop — cancelMessage fires + cooldown starts.
    fireEvent.click(screen.getByTestId("composer-send-button"));
    expect(cancelMessage).toHaveBeenCalledTimes(1);

    // Mirror the store's optimistic isRunning=false flip + queue rerender.
    threadState.isRunning = false;
    rerender(<LoomComposer {...noopProps} />);

    // Type a follow-up; submit is blocked because of cooldown even though
    // the button now shows Send.
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "follow-up" } });
    const sendButton = screen.getByTestId("composer-send-button");
    expect(sendButton).toBeDisabled();

    // Pressing Enter is also a no-op while cooling down.
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(processMessage).not.toHaveBeenCalled();

    // Wait past the cooldown — button + Enter both work again.
    await waitFor(() => expect(sendButton).not.toBeDisabled(), { timeout: 1500 });

    fireEvent.click(sendButton);
    expect(processMessage).toHaveBeenCalledTimes(1);
    expect(processMessage).toHaveBeenCalledWith({ role: "user", content: "follow-up" });
  });
});

describe("LoomComposer initial message handoff", () => {
  const handoff = (message: string): InitialMessageHandoff => {
    let claimed = false;
    return {
      message,
      claim: () => {
        if (claimed) return false;
        claimed = true;
        return true;
      },
    };
  };

  beforeEach(() => {
    processMessage.mockReset();
    switchToNewThread.mockReset();
  });

  it("sends a handed-off message in a new thread without a click", () => {
    render(
      <InitialMessageContext.Provider value={handoff("Draft a rule or flow: double points")}>
        <LoomComposer {...noopProps} />
      </InitialMessageContext.Provider>
    );

    expect(switchToNewThread).toHaveBeenCalledTimes(1);
    expect(processMessage).toHaveBeenCalledTimes(1);
    expect(processMessage).toHaveBeenCalledWith({
      role: "user",
      content: "Draft a rule or flow: double points",
    });
  });

  it("sends a handoff only once across remounts", () => {
    const value = handoff("Set up a new loyalty program");
    const { unmount } = render(
      <InitialMessageContext.Provider value={value}>
        <LoomComposer {...noopProps} />
      </InitialMessageContext.Provider>
    );
    unmount();
    render(
      <InitialMessageContext.Provider value={value}>
        <LoomComposer {...noopProps} />
      </InitialMessageContext.Provider>
    );

    expect(processMessage).toHaveBeenCalledTimes(1);
  });

  it("sends nothing without a handoff", () => {
    render(<LoomComposer {...noopProps} />);
    expect(processMessage).not.toHaveBeenCalled();
    expect(switchToNewThread).not.toHaveBeenCalled();
  });
});
