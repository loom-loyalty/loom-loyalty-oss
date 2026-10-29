/**
 * Program Referral Row
 *
 * The referral line under a program membership on the Customer 360: the
 * membership's referral code (with a copy button), who referred this
 * customer, and how many customers enrolled with the code.
 */

"use client";

import { Gift } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "../../../primitives/button";
import { CopyButton } from "../../../primitives/copy-button";
import { EntityLinkButton } from "./entity-link-button";
import type { CustomerProgram } from "./types";

export interface ProgramReferralRowProps {
  program: CustomerProgram;
  /** Generates the membership's code. The button is hidden when omitted. */
  onGenerateReferralCode?: (program: CustomerProgram) => Promise<void> | void;
  /** Opens the referring customer's Customer 360. Plain text when omitted. */
  onViewCustomer?: (customerId: string) => void;
}

export function ProgramReferralRow({
  program,
  onGenerateReferralCode,
  onViewCustomer,
}: ProgramReferralRowProps): ReactNode {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!onGenerateReferralCode) return;
    setGenerating(true);
    try {
      await onGenerateReferralCode(program);
    } catch {
      // The caller reports its own errors; this only resets the button.
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section aria-label={`Referrals for ${program.programName}`}>
      <dl className="border-border text-muted-foreground mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-xs">
        <div className="flex items-center gap-2">
          <Gift className="text-primary h-3.5 w-3.5" aria-hidden="true" />
          <dt>Referral code</dt>
          <dd className="flex items-center gap-1">
            {program.referralCode ? (
              <>
                <span className="text-foreground font-mono">{program.referralCode}</span>
                <CopyButton
                  value={program.referralCode}
                  label={`Copy referral code for ${program.programName}`}
                />
              </>
            ) : onGenerateReferralCode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
                aria-label={`Generate referral code for ${program.programName}`}
              >
                {generating ? "Generating…" : "Generate referral code"}
              </Button>
            ) : (
              <span>None yet</span>
            )}
          </dd>
        </div>
        {program.referredByCustomerId && (
          <div className="flex items-center gap-2">
            <dt>Referred by</dt>
            <dd>
              <EntityLinkButton
                id={program.referredByCustomerId}
                entityLabel="customer"
                onClick={onViewCustomer}
              />
            </dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <dt>Referrals</dt>
          <dd className="text-foreground font-mono font-medium tabular-nums">
            {program.referralCount ?? 0}
          </dd>
        </div>
      </dl>
    </section>
  );
}
