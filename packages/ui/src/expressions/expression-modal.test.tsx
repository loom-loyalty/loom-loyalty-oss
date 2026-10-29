import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type * as ExpressionBuilderModule from "./expression-builder";
import type { DataModelLike } from "./expression-context";
import { ExpressionModal, useExpressionPathValidation } from "./expression-modal";
import type {
  Expression,
  ExpressionModalAiBridge,
  ExpressionModalAiStepApi,
  ExpressionModalProps,
} from "./types";

// Radix Select/Dialog rely on pointer-capture + scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

/**
 * `useExpressionAiStep` (the real hook `ExpressionModal` is designed to host,
 * KTD11) lives in `apps/hub` and can't be imported from this package (package
 * isolation — see `ExpressionModalAiBarProps.useAiStep`'s doc comment). This
 * fake reproduces just enough of its contract — draft-scoped `apply`, and a
 * response that only lands when the test explicitly resolves it — to exercise
 * the modal's own draft/epoch machinery, independent of the hub hook.
 */
function createAiStepController() {
  let pendingApply: ((expr: Expression | null) => void) | null = null;
  let setAnnouncementRef: ((text: string | null) => void) | null = null;
  const generate = vi.fn();
  const fix = vi.fn();

  function useAiStep(bridge: ExpressionModalAiBridge): ExpressionModalAiStepApi {
    // A real `useState` here (not a hardcoded value) — legitimate per KTD11,
    // since `useAiStep` is called unconditionally in the same position every
    // render. Lets a test simulate the real hub hook's behavior of setting
    // aiAnnouncement independently of the epoch-gated draft write, so the
    // modal's own suppression logic (not the epoch guard) is what's exercised.
    const [announcement, setAnnouncement] = useState<string | null>(null);
    // Assigning the closure ref is a side effect — must run in an effect, not
    // during render (react-hooks/purity). `setAnnouncement` is a stable
    // setState identity, so capturing it once is equivalent to every render.
    useEffect(() => {
      setAnnouncementRef = setAnnouncement;
    }, [setAnnouncement]);
    return {
      aiProposal: null,
      aiAnnouncement: announcement,
      aiDrafted: false,
      isLoading: false,
      fixLoading: false,
      error: null,
      fixError: null,
      generate: (prompt: string) => {
        generate(prompt);
        // Simulate an in-flight request: capture THIS render's applyToDraft so
        // a later `resolveWith` call exercises the same staleness path a real
        // async `generate().then(...)` would.
        pendingApply = bridge.applyToDraft;
      },
      fix: (prompt: string) => {
        fix(prompt);
        pendingApply = bridge.applyToDraft;
      },
      onBuilderChange: bridge.applyToDraft,
    };
  }

  return {
    useAiStep,
    generate,
    fix,
    /**
     * Simulate the AI response landing "now" — possibly after the modal
     * closed. `announcement`, when given, mimics the hub hook ALSO calling its
     * own `setAiAnnouncement` on response — independent of the draft-write
     * epoch guard — the exact gap the modal's own suppression must cover.
     */
    resolveWith: (expr: Expression | null, announcement?: string) => {
      const apply = pendingApply;
      pendingApply = null;
      apply?.(expr);
      if (announcement !== undefined) setAnnouncementRef?.(announcement);
    },
  };
}

interface HarnessProps {
  initialExpression?: Expression | null;
  rawInitialExpression?: unknown;
  onSaveSpy: (expr: Expression | null) => void;
  aiController: ReturnType<typeof createAiStepController>;
  isResolvingSchema?: boolean;
  disabled?: boolean;
  showActions?: boolean;
  extraProps?: Partial<ExpressionModalProps>;
}

/**
 * Wraps `ExpressionModal` with real `open`/`initialExpression` state so tests
 * can round-trip Save, reopen after Cancel, and observe that a saved value
 * really did (or didn't) reach the caller's store.
 */
function Harness({
  initialExpression = null,
  rawInitialExpression,
  onSaveSpy,
  aiController,
  isResolvingSchema,
  disabled,
  showActions,
  extraProps,
}: HarnessProps): ReactNode {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState<Expression | null>(initialExpression);

  const props: ExpressionModalProps = {
    open,
    onOpenChange: setOpen,
    initialExpression: saved,
    rawInitialExpression,
    onSave: (expr) => {
      setSaved(expr);
      onSaveSpy(expr);
    },
    mode: "event",
    isResolvingSchema,
    disabled,
    showActions,
    aiBar: {
      surface: "event",
      labels: { built: "Built", updated: "Updated" },
      useAiStep: aiController.useAiStep,
    },
    header: {
      eyebrow: "EVENT RULE",
      entity: "Order placed",
      heading: "When should this rule apply?",
      subtitle: "This rule only runs when these conditions are met.",
    },
    ...extraProps,
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <ExpressionModal {...props} />
    </>
  );
}

describe("ExpressionModal — happy path round-trip", () => {
  it("renders the eyebrow, entity, heading, and subtitle with the heading as the dialog name", () => {
    const controller = createAiStepController();
    render(<Harness onSaveSpy={vi.fn()} aiController={controller} />);

    expect(screen.getByText("EVENT RULE")).toBeInTheDocument();
    expect(screen.getByText("Order placed")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "When should this rule apply?" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("This rule only runs when these conditions are met.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "When should this rule apply?" })
    ).toBeInTheDocument();
  });

  it("edits an existing expression, updates the preview live, and saves the result", async () => {
    const user = userEvent.setup();
    const onSaveSpy = vi.fn();
    const controller = createAiStepController();
    const initial: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    render(<Harness initialExpression={initial} onSaveSpy={onSaveSpy} aiController={controller} />);

    expect(screen.getByText(/Total is more than 100/)).toBeInTheDocument();

    const valueInput = screen.getByLabelText("Value");
    await user.clear(valueInput);
    await user.type(valueInput, "200");

    expect(await screen.findByText(/Total is more than 200/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save condition" }));

    expect(onSaveSpy).toHaveBeenCalledWith({
      greaterThan: { path: "$.eventData.order.total", value: 200, extractValueFromPath: false },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ExpressionModal — null start and validation gating", () => {
  it("starts blank and disables Save until a valid root exists", async () => {
    const user = userEvent.setup();
    const controller = createAiStepController();
    render(<Harness initialExpression={null} onSaveSpy={vi.fn()} aiController={controller} />);

    expect(screen.getByRole("button", { name: "Save condition" })).toBeDisabled();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Always True" }));

    expect(screen.getByRole("button", { name: "Save condition" })).toBeEnabled();
  });

  it("disables Save while the draft has a validation error", async () => {
    const user = userEvent.setup();
    const controller = createAiStepController();
    const initial: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    render(<Harness initialExpression={initial} onSaveSpy={vi.fn()} aiController={controller} />);

    // The Harness has no fetchDataModel/dataModelCode configured, so the
    // committed path never resolves and the pill shows the neutral
    // placeholder rather than a friendly breadcrumb (property-picker.test.tsx
    // covers the resolved case).
    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));
    const pathInput = screen.getByLabelText("Edit path manually");
    await user.clear(pathInput);
    await user.type(pathInput, "bad");

    await screen.findAllByText("Path must start with $.");
    expect(screen.getAllByText("Path must start with $.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save condition" })).toBeDisabled();
  });

  it("disables Save until a notification action has its required dispatch codes", () => {
    const controller = createAiStepController();
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Harness
          initialExpression={{
            true: { actions: [{ sendNotification: { channelCode: "", templateCode: "" } }] },
          }}
          onSaveSpy={vi.fn()}
          aiController={controller}
          showActions
        />
      </QueryClientProvider>
    );

    expect(screen.getByText("Send Notification needs a channel code.")).toBeInTheDocument();
    expect(screen.getByText("Send Notification needs a template code.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save condition" })).toBeDisabled();
  });
});

describe("ExpressionModal — cancel and dismiss discard the draft", () => {
  it("Cancel discards edits; onSave is never called; reopening shows the last saved value", async () => {
    const user = userEvent.setup();
    const onSaveSpy = vi.fn();
    const controller = createAiStepController();
    const initial: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    render(<Harness initialExpression={initial} onSaveSpy={onSaveSpy} aiController={controller} />);

    const valueInput = screen.getByLabelText("Value");
    await user.clear(valueInput);
    await user.type(valueInput, "999");
    expect(await screen.findByText(/Total is more than 999/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSaveSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect(await screen.findByText(/Total is more than 100/)).toBeInTheDocument();
  });

  it("Escape dismiss also discards edits without calling onSave", async () => {
    const user = userEvent.setup();
    const onSaveSpy = vi.fn();
    const controller = createAiStepController();
    const initial: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    render(<Harness initialExpression={initial} onSaveSpy={onSaveSpy} aiController={controller} />);

    const valueInput = screen.getByLabelText("Value");
    await user.clear(valueInput);
    await user.type(valueInput, "777");

    await user.keyboard("{Escape}");

    expect(onSaveSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect(await screen.findByText(/Total is more than 100/)).toBeInTheDocument();
  });
});

describe("ExpressionModal — draft-scoped AI (KTD11)", () => {
  it("Generate writes only the local draft; Cancel discards it and onSave is never called", async () => {
    const user = userEvent.setup();
    const onSaveSpy = vi.fn();
    const controller = createAiStepController();
    render(<Harness initialExpression={null} onSaveSpy={onSaveSpy} aiController={controller} />);

    await user.type(screen.getByLabelText(/describe when this rule fires/i), "always true");
    await user.click(screen.getByRole("button", { name: "Generate" }));
    expect(controller.generate).toHaveBeenCalledWith("always true");

    act(() => controller.resolveWith({ true: {} }));
    expect(await screen.findByText(/Always applies/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSaveSpy).not.toHaveBeenCalled();
  });

  it("drops a Generate response that resolves after the modal has closed", async () => {
    const user = userEvent.setup();
    const onSaveSpy = vi.fn();
    const controller = createAiStepController();
    render(<Harness initialExpression={null} onSaveSpy={onSaveSpy} aiController={controller} />);

    await user.type(screen.getByLabelText(/describe when this rule fires/i), "anything");
    await user.click(screen.getByRole("button", { name: "Generate" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // The AI response lands AFTER close — it must reach neither the draft nor
    // the caller's store.
    controller.resolveWith({ true: {} });
    expect(onSaveSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect(screen.getByRole("button", { name: "Save condition" })).toBeDisabled();
  });

  it("suppresses a stale AI announcement/proposal from a discarded session on reopen (adversarial review finding)", async () => {
    const user = userEvent.setup();
    const onSaveSpy = vi.fn();
    const controller = createAiStepController();
    render(<Harness initialExpression={null} onSaveSpy={onSaveSpy} aiController={controller} />);

    await user.type(screen.getByLabelText(/describe when this rule fires/i), "anything");
    await user.click(screen.getByRole("button", { name: "Generate" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // The response lands AFTER close, setting BOTH the draft (already covered
    // by the epoch guard above) AND the announcement (the hub hook's own
    // state, which the epoch guard alone does NOT gate).
    act(() => controller.resolveWith(null, "Expression generated — review and save."));

    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect(screen.queryByText("Expression generated — review and save.")).not.toBeInTheDocument();
  });

  it("suppresses a stale announcement from a cancelled-then-reopened session until a fresh Generate runs", async () => {
    const user = userEvent.setup();
    const onSaveSpy = vi.fn();
    const controller = createAiStepController();
    render(<Harness initialExpression={null} onSaveSpy={onSaveSpy} aiController={controller} />);

    // Generate resolves WHILE still open — announcement legitimately shows.
    await user.type(screen.getByLabelText(/describe when this rule fires/i), "anything");
    await user.click(screen.getByRole("button", { name: "Generate" }));
    act(() => controller.resolveWith({ true: {} }, "Expression generated — review and save."));
    expect(await screen.findByText("Expression generated — review and save.")).toBeInTheDocument();

    // Cancel discards the session; reopening must not show the old announcement.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect(screen.queryByText("Expression generated — review and save.")).not.toBeInTheDocument();

    // A NEW Generate in the fresh session un-suppresses the display again.
    await user.type(screen.getByLabelText(/describe when this rule fires/i), "anything else");
    await user.click(screen.getByRole("button", { name: "Generate" }));
    act(() => controller.resolveWith({ true: {} }, "Updated in the new session."));
    expect(await screen.findByText("Updated in the new session.")).toBeInTheDocument();
  });
});

describe("ExpressionModal — loading state (fix #16)", () => {
  it("shows Skeleton placeholders and blocks the builder while schema is resolving", () => {
    const controller = createAiStepController();
    render(
      <Harness
        initialExpression={null}
        onSaveSpy={vi.fn()}
        aiController={controller}
        isResolvingSchema
      />
    );

    expect(screen.getByRole("status", { name: /loading condition fields/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/preparing field suggestions/i)).toBeInTheDocument();
  });
});

// -- Save-gate aggregation (fix #11) --
//
// U3 (the property picker) doesn't exist yet — the plan calls for wiring the
// aggregation POINT now, not a full picker. `ExpressionBuilder` is swapped for
// a probe that calls the exported `useExpressionPathValidation()` hook, the
// same way a real picker field will report an unresolved path once it exists.
const pathProbe = { active: false };

vi.mock("./expression-builder.js", async (importOriginal) => {
  const actual = await importOriginal<typeof ExpressionBuilderModule>();
  function ProbeOrReal(props: Parameters<typeof actual.ExpressionBuilder>[0]): ReactNode {
    if (pathProbe.active) return <PathErrorProbe />;
    return <actual.ExpressionBuilder {...props} />;
  }
  return { ...actual, ExpressionBuilder: ProbeOrReal };
});

function PathErrorProbe(): ReactNode {
  const { reportPathError } = useExpressionPathValidation();
  return (
    <div>
      <button type="button" onClick={() => reportPathError("probe", true)}>
        Report unresolved path
      </button>
      <button type="button" onClick={() => reportPathError("probe", false)}>
        Clear unresolved path
      </button>
    </div>
  );
}

describe("ExpressionModal — save-gate aggregation (fix #11)", () => {
  afterEach(() => {
    pathProbe.active = false;
  });

  it("disables Save on a reported unresolved path error and re-enables when cleared", async () => {
    pathProbe.active = true;
    const user = userEvent.setup();
    const controller = createAiStepController();
    render(
      <Harness initialExpression={{ true: {} }} onSaveSpy={vi.fn()} aiController={controller} />
    );

    // Valid tree, no unresolved path reported yet — Save starts enabled (a
    // schema-unavailable/not-yet-reported state must never block Save).
    expect(screen.getByRole("button", { name: "Save condition" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Report unresolved path" }));
    expect(screen.getByRole("button", { name: "Save condition" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Clear unresolved path" }));
    expect(screen.getByRole("button", { name: "Save condition" })).toBeEnabled();
  });
});

describe("ExpressionModal — starter templates (#1033)", () => {
  const templates = [
    {
      id: "lapsed",
      label: "Lapsed customers",
      description: "Customers the lifecycle funnel marks as lapsed.",
      expression: { funnelStage: { stage: "LAPSE" } } as Expression,
    },
  ];

  it("offers templates on an empty draft and loads the picked one without saving", async () => {
    const user = userEvent.setup();
    const onSaveSpy = vi.fn();
    const controller = createAiStepController();
    render(
      <Harness
        onSaveSpy={onSaveSpy}
        aiController={controller}
        extraProps={{ mode: "customer", templates }}
      />
    );

    await user.click(screen.getByRole("button", { name: /Lapsed customers/ }));

    expect(screen.queryByRole("button", { name: /Lapsed customers/ })).not.toBeInTheDocument();
    expect(onSaveSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save condition" }));
    expect(onSaveSpy).toHaveBeenCalledWith({ funnelStage: { stage: "LAPSE" } });
  });

  it("hides templates once the draft has a condition", () => {
    const controller = createAiStepController();
    render(
      <Harness
        initialExpression={{ funnelStage: { stage: "LOYALTY" } } as Expression}
        onSaveSpy={vi.fn()}
        aiController={controller}
        extraProps={{ mode: "customer", templates }}
      />
    );

    expect(screen.queryByText("Start from a template")).not.toBeInTheDocument();
  });
});

describe("ExpressionModal — per-condition aside slot (#1033)", () => {
  it("renders the caller's aside beside every leaf condition with that leaf's tree", () => {
    const controller = createAiStepController();
    const renderConditionAside = vi.fn((condition: Expression) => (
      <span data-testid="aside">{Object.keys(condition)[0]}</span>
    ));
    render(
      <Harness
        initialExpression={
          {
            and: {
              children: [
                {
                  greaterThan: {
                    path: "$.eventData.order.total",
                    value: 100,
                    extractValueFromPath: false,
                  },
                },
                { funnelStage: { stage: "LAPSE" } },
              ],
            },
          } as Expression
        }
        onSaveSpy={vi.fn()}
        aiController={controller}
        extraProps={{ mode: "customer", renderConditionAside }}
      />
    );

    expect(screen.getAllByTestId("aside").map((n) => n.textContent)).toEqual([
      "greaterThan",
      "funnelStage",
    ]);
  });
});

describe("ExpressionModal — feed mode without an AI bar", () => {
  it("edits and saves a file-row condition with no AI step and asks for the caller's row model", async () => {
    const user = userEvent.setup();
    const onSaveSpy = vi.fn();
    // The same shape the Hub's feed row model has: a root whose `row` element is the file's columns.
    const models: Record<string, DataModelLike> = {
      "feed-row": {
        elements: [
          {
            inputAttribute: "row",
            outputAttribute: "row",
            name: "File columns",
            typeReference: "feed-row-columns",
          },
        ],
      },
      "feed-row-columns": {
        elements: [
          {
            inputAttribute: "amount",
            outputAttribute: "amount",
            name: "amount",
            typeReference: "NUMBER",
          },
        ],
      },
    };
    const fetchDataModel = vi.fn(async (code: string) => {
      const model = models[code];
      if (!model) throw new Error(`No model ${code}`);
      return model;
    });
    const initial: Expression = {
      greaterThan: { path: "$.row.amount", value: 100, extractValueFromPath: false },
    };
    render(
      <Harness
        initialExpression={initial}
        onSaveSpy={onSaveSpy}
        aiController={createAiStepController()}
        extraProps={{
          mode: "feed",
          aiBar: undefined,
          dataModelCode: "feed-row",
          fetchDataModel,
        }}
      />
    );

    expect(screen.queryByRole("button", { name: "Generate" })).not.toBeInTheDocument();
    expect(fetchDataModel).toHaveBeenCalledWith("feed-row");

    const valueInput = screen.getByLabelText("Value");
    await user.clear(valueInput);
    await user.type(valueInput, "250");
    await user.click(screen.getByRole("button", { name: "Save condition" }));

    expect(onSaveSpy).toHaveBeenCalledWith({
      greaterThan: { path: "$.row.amount", value: 250, extractValueFromPath: false },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
