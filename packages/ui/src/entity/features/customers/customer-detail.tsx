/**
 * Customer Detail Sheet Content
 *
 * Displays Customer fields with polymorphic identity support (individual vs corporate).
 * Includes contact info, programs, and a "View Full Profile" action for the Customer 360.
 * Supports extended fields from data model extensions.
 */

import { formatDateTime } from "@loom-loyalty/core";
import { Edit, Eye, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge } from "../../../data-display/status-badge.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { type CustomerPreviewProps, getSDKCustomerName } from "./types.js";

/**
 * Customer detail content for Sheet display.
 *
 * Lightweight detail view with polymorphic identity handling.
 * Use the "View Full Profile" action to navigate to the Customer 360 view.
 */
export function CustomerPreview({
  customer,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  onViewFull,
  schema,
  extendedFields = [],
}: CustomerPreviewProps): ReactNode {
  const c = customer as Record<string, unknown>;
  const identity = c.identity as
    | {
        firstName?: string;
        middleName?: string;
        lastName?: string;
        birthDate?: string;
        genderCode?: string;
      }
    | undefined;
  const corpIdentity = c.corporateIdentity as
    | { companyName?: string; companyCode?: string }
    | undefined;
  const status = c.status as { name?: string; code?: string } | undefined;
  const emailAddresses = c.emailAddresses as
    | Array<{
        emailAddress?: string;
        primary?: boolean;
        type?: { name?: string };
      }>
    | undefined;
  const phoneNumbers = c.phoneNumbers as
    | Array<{
        number?: string;
        formattedNumber?: string;
        primary?: boolean;
      }>
    | undefined;
  const programs = c.programs as
    | Array<{
        programCode?: string;
        customerProgramStatus?: { name?: string };
        referralCode?: string;
      }>
    | undefined;

  const displayName = getSDKCustomerName(customer);
  const isIndividual = !!identity?.firstName;
  const primaryEmail = emailAddresses?.find((e) => e.primary) ?? emailAddresses?.[0];
  const primaryPhone = phoneNumbers?.find((p) => p.primary) ?? phoneNumbers?.[0];

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section aria-label="Basic Information" className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <dl className="space-y-3">
          <div>
            <dt className="text-muted-foreground text-sm">Name</dt>
            <dd className="text-foreground font-medium">{displayName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Type</dt>
            <dd className="mt-1">
              <Badge variant="secondary" className="font-normal">
                {isIndividual ? "Individual" : "Corporate"}
              </Badge>
            </dd>
          </div>
          {corpIdentity?.companyCode && (
            <div>
              <dt className="text-muted-foreground text-sm">Company Code</dt>
              <dd className="text-foreground font-mono text-sm">{corpIdentity.companyCode}</dd>
            </div>
          )}
          {(c.externalId as string | undefined) && (
            <div>
              <dt className="text-muted-foreground text-sm">External ID</dt>
              <dd className="text-foreground font-mono text-sm">{c.externalId as string}</dd>
            </div>
          )}
          {status && (
            <div>
              <dt className="text-muted-foreground text-sm">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={status.name ?? status.code ?? "Unknown"} />
              </dd>
            </div>
          )}
          {(c.enrollmentDateTime as string | undefined) && (
            <div>
              <dt className="text-muted-foreground text-sm">Enrolled</dt>
              <dd className="text-foreground text-sm">
                <time dateTime={c.enrollmentDateTime as string}>
                  {formatDateTime(c.enrollmentDateTime as string) ?? "\u2014"}
                </time>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Contact Information */}
      {(primaryEmail || primaryPhone) && (
        <section aria-label="Contact Information" className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Contact</h3>
          <dl className="space-y-3">
            {primaryEmail && (
              <div>
                <dt className="text-muted-foreground text-sm">
                  Email
                  {primaryEmail.primary && (
                    <Badge variant="outline" className="ml-2 text-xs font-normal">
                      Primary
                    </Badge>
                  )}
                </dt>
                <dd className="text-foreground text-sm">{primaryEmail.emailAddress ?? "\u2014"}</dd>
              </div>
            )}
            {primaryPhone && (
              <div>
                <dt className="text-muted-foreground text-sm">
                  Phone
                  {primaryPhone.primary && (
                    <Badge variant="outline" className="ml-2 text-xs font-normal">
                      Primary
                    </Badge>
                  )}
                </dt>
                <dd className="text-foreground text-sm">
                  {primaryPhone.formattedNumber ?? primaryPhone.number ?? "\u2014"}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Programs */}
      <section aria-label="Programs" className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Programs</h3>
        {programs && programs.length > 0 ? (
          <ul className="space-y-2">
            {programs.map((program, index) => (
              <li
                key={program.programCode ?? index}
                className="border-border flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-foreground font-mono text-sm font-medium">
                    {program.programCode}
                  </span>
                  {program.referralCode && (
                    <span className="text-muted-foreground text-xs">
                      Referral code <span className="font-mono">{program.referralCode}</span>
                    </span>
                  )}
                </div>
                {program.customerProgramStatus?.name && (
                  <StatusBadge status={program.customerProgramStatus.name} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No programs</p>
        )}
      </section>

      {/* Timestamps */}
      <section aria-label="Timestamps" className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <dl className="space-y-3">
          <div>
            <dt className="text-muted-foreground text-sm">Created</dt>
            <dd className="text-foreground text-sm">
              {(c.createdDateTime as string | undefined) ? (
                <time dateTime={c.createdDateTime as string}>
                  {formatDateTime(c.createdDateTime as string) ?? "\u2014"}
                </time>
              ) : (
                "\u2014"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Last Modified</dt>
            <dd className="text-foreground text-sm">
              {(c.modifiedDateTime as string | undefined) ? (
                <time dateTime={c.modifiedDateTime as string}>
                  {formatDateTime(c.modifiedDateTime as string) ?? "\u2014"}
                </time>
              ) : (
                "\u2014"
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Extended Fields */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={customer}
          mode="view"
          title="Additional Information"
          defaultCollapsed={false}
        />
      )}

      {/* Action Buttons */}
      {(onViewFull || canEdit || canDelete) && (
        <div className="border-border flex flex-col gap-2 border-t pt-4">
          {onViewFull && (
            <Button variant="outline" className="w-full" onClick={onViewFull}>
              <Eye className="mr-2 h-4 w-4" />
              View Full Profile
            </Button>
          )}
          <div className="flex gap-2">
            {canDelete && onDelete && (
              <Button variant="outline" className="flex-1" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            {canEdit && onEdit && (
              <Button variant="primary-gradient" className="flex-1" onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export type { CustomerPreviewProps };
