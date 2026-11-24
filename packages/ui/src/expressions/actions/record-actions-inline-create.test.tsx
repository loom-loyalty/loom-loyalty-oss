// Pickers brief S2: issue coupon (offer), issue badge and issue tier offer
// "+ New …" through useInlineRecordPicker, and select the created record with
// its code before the list refetches (I4).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen } from "@testing-library/react";
import type { ComponentType, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedField {
  createOptions?: Array<{ key: string }>;
  onCreateOption?: (key: string) => void;
}

const captured = vi.hoisted(() => ({
  field: null as CapturedField | null,
  pickerOptions: null as null | {
    kind: string;
    onSelect: (id: string, record?: { code?: string }) => void;
  },
}));

vi.mock("../../forms/offer-field/index.js", () => ({
  OfferField: (p: CapturedField) => {
    captured.field = p;
    return null;
  },
}));
vi.mock("../../forms/offer-field/use-offer-field.js", () => ({
  useOfferField: () => ({ offers: [], findOffer: () => undefined }),
}));
vi.mock("../../forms/badge-field/index.js", () => ({
  BadgeField: (p: CapturedField) => {
    captured.field = p;
    return null;
  },
}));
vi.mock("../../forms/badge-field/use-badge-field.js", () => ({
  useBadgeField: () => ({ badges: [], findBadge: () => undefined }),
}));
vi.mock("../../forms/tier-field/index.js", () => ({
  TierField: (p: CapturedField) => {
    captured.field = p;
    return null;
  },
}));
vi.mock("../inline-create/use-inline-record-picker.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useInlineRecordPicker: (options: NonNullable<typeof captured.pickerOptions>) => {
      captured.pickerOptions = options;
      return {
        pickerProps: {
          createOptions: [{ key: options.kind, label: `New ${options.kind}` }],
          onCreateOption: vi.fn(),
          suggested: false,
        },
        createSheet: <div data-testid="inline-create-sheet" />,
      };
    },
  };
});

import { IssueBadgeActionComponent } from "./issue-badge-action";
import { IssueCouponActionComponent } from "./issue-coupon-action";
import { IssueTierActionComponent } from "./issue-tier-action";

type Case = [
  string,
  ComponentType<{ value: object; onChange: (v: object) => void }>,
  string,
  object,
  object,
];

const cases: Case[] = [
  [
    "issue coupon",
    IssueCouponActionComponent as never,
    "offer",
    { couponOfferId: undefined },
    { couponOfferId: "o-new", couponOfferCode: "free-wash" },
  ],
  [
    "issue badge",
    IssueBadgeActionComponent as never,
    "badge",
    {},
    { badgeId: "o-new", badgeCode: "free-wash" },
  ],
  ["issue tier", IssueTierActionComponent as never, "tier", {}, { tierCode: "free-wash" }],
];

const render = (node: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}
    >
      {node}
    </QueryClientProvider>
  );

beforeEach(() => {
  captured.field = null;
  captured.pickerOptions = null;
});

describe.each(cases)("%s action (S2)", (_name, Component, kind, initial, expected) => {
  it("passes '+ New …' to the picker and renders the create sheet", () => {
    render(<Component value={initial} onChange={vi.fn()} />);
    expect(captured.pickerOptions?.kind).toBe(kind);
    expect(captured.field?.createOptions).toEqual([expect.objectContaining({ key: kind })]);
    expect(typeof captured.field?.onCreateOption).toBe("function");
    expect(screen.getByTestId("inline-create-sheet")).toBeTruthy();
  });

  it("selects a just-created record with its code, before the list refetches", () => {
    const onChange = vi.fn();
    render(<Component value={initial} onChange={onChange} />);
    captured.pickerOptions!.onSelect("o-new", { code: "free-wash" });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining(expected));
  });
});
