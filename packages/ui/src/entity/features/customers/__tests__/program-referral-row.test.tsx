import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProgramReferralRow } from "../program-referral-row";
import type { CustomerProgram } from "../types";

const REFERRER_ID = "cust_aaaabbbbccccddddeeeeffff00001111";

/** The value next to a term in the row, e.g. valueOf("Referrals"). */
function valueOf(term: string): HTMLElement {
  const dt = within(screen.getByLabelText("Referrals for Coffee Club")).getByText(term);
  return dt.nextElementSibling as HTMLElement;
}

const base: CustomerProgram = {
  customerProgramId: "cpr_1",
  programId: "prg_1",
  programCode: "coffee",
  programName: "Coffee Club",
  registrationDate: "2026-10-01",
  status: "ACTIVE",
};

describe("ProgramReferralRow", () => {
  it("shows the code with a copy button, the referrer link and the count", async () => {
    const onViewCustomer = vi.fn();
    render(
      <ProgramReferralRow
        program={{
          ...base,
          referralCode: "K7QX-9PM2",
          referralCount: 3,
          referredByCustomerId: REFERRER_ID,
          referredByCustomerProgramId: "cpr_9",
        }}
        onViewCustomer={onViewCustomer}
      />
    );
    const row = screen.getByLabelText("Referrals for Coffee Club");
    expect(within(row).getByText("K7QX-9PM2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy referral code for Coffee Club" })
    ).toBeInTheDocument();
    expect(valueOf("Referrals")).toHaveTextContent("3");

    await userEvent.click(screen.getByRole("button", { name: `View customer ${REFERRER_ID}` }));
    expect(onViewCustomer).toHaveBeenCalledWith(REFERRER_ID);
  });

  it("hides the Referred by row when nobody referred the customer and shows a zero count", () => {
    render(<ProgramReferralRow program={{ ...base, referralCode: "K7QX-9PM2" }} />);
    expect(screen.queryByText("Referred by")).not.toBeInTheDocument();
    expect(valueOf("Referrals")).toHaveTextContent("0");
  });

  it("does not offer to generate when the membership already has a code", () => {
    render(
      <ProgramReferralRow
        program={{ ...base, referralCode: "K7QX-9PM2", referralCount: 0 }}
        onGenerateReferralCode={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /^generate/i })).not.toBeInTheDocument();
    expect(valueOf("Referrals")).toHaveTextContent("0");
  });

  it("shows the referrer as plain text when there is no way to open them", () => {
    render(
      <ProgramReferralRow
        program={{ ...base, referralCode: "K7QX-9PM2", referredByCustomerId: REFERRER_ID }}
      />
    );
    expect(valueOf("Referred by")).toHaveTextContent("cust_aaa…");
    expect(screen.queryByRole("button", { name: /^view customer/i })).not.toBeInTheDocument();
  });

  it("re-enables the button when generating fails", async () => {
    const onGenerate = vi.fn(() => Promise.reject(new Error("boom")));
    render(<ProgramReferralRow program={base} onGenerateReferralCode={onGenerate} />);

    const button = screen.getByRole("button", { name: "Generate referral code for Coffee Club" });
    await userEvent.click(button);
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent("Generate referral code");
  });

  it("offers to generate a code when the membership has none", async () => {
    let resolve!: () => void;
    const onGenerate = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<ProgramReferralRow program={base} onGenerateReferralCode={onGenerate} />);

    const button = screen.getByRole("button", { name: "Generate referral code for Coffee Club" });
    await userEvent.click(button);
    expect(onGenerate).toHaveBeenCalledWith(base);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Generating…");

    await act(async () => resolve());
    expect(button).not.toBeDisabled();
  });

  it("says None yet when there is no code and no way to generate one", () => {
    render(<ProgramReferralRow program={base} />);
    expect(screen.getByText("None yet")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
