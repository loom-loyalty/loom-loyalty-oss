/**
 * Changing which operator surfaces expose an activity.
 *
 * The update endpoint REPLACES the surface set rather than merging into it, so
 * sending one surface withdraws every other. Every caller therefore has to send
 * the full intended set, a rule that is easy to get wrong once and wrong
 * everywhere, which is why it lives here rather than in each admin surface.
 */

import {
  useEventEngineManagementCreateEventTypeAction,
  useEventEngineManagementDeleteEventTypeAction,
  useEventEngineManagementUpdateEventTypeAction,
  type EventActionSurface,
  type EventTypeAction,
} from "@loom-loyalty/sdk";
import { useCallback } from "react";

/** The full intended surface set after adding `surface`. */
export function surfacesWith(
  current: readonly string[] | undefined,
  surface: EventActionSurface
): EventActionSurface[] {
  const next = new Set<string>(current ?? []);
  next.add(surface);
  return [...next] as EventActionSurface[];
}

/** The full intended surface set after removing `surface`. */
export function surfacesWithout(
  current: readonly string[] | undefined,
  surface: EventActionSurface
): EventActionSurface[] {
  return (current ?? []).filter((entry) => entry !== surface) as EventActionSurface[];
}

export interface UseRegistrySurfacesResult {
  /**
   * Expose `activityCode` on `surface`. Updates the existing registration when
   * one is supplied, creates one otherwise.
   */
  addSurface: (args: {
    activityCode: string;
    surface: EventActionSurface;
    registration?: EventTypeAction;
  }) => Promise<void>;
  /**
   * Withdraw `surface` from a registration, sending the remaining surfaces.
   *
   * When it was the only surface the registration is deleted, because an empty
   * surface set is a registration that exposes the activity nowhere: a row with
   * no purpose rather than a meaningful state.
   */
  removeSurface: (args: {
    registration: EventTypeAction;
    surface: EventActionSurface;
  }) => Promise<void>;
  /** Remove a registration entirely. */
  deleteRegistration: (registration: EventTypeAction) => Promise<void>;
  isPending: boolean;
}

/** Mutations for curating which surfaces expose which activities. */
export function useRegistrySurfaces(onChanged?: () => void): UseRegistrySurfacesResult {
  const createMutation = useEventEngineManagementCreateEventTypeAction();
  const updateMutation = useEventEngineManagementUpdateEventTypeAction();
  const deleteMutation = useEventEngineManagementDeleteEventTypeAction();

  const addSurface = useCallback(
    async ({
      activityCode,
      surface,
      registration,
    }: {
      activityCode: string;
      surface: EventActionSurface;
      registration?: EventTypeAction;
    }) => {
      if (registration) {
        // Full intended set. Sending only `surface` would withdraw the others.
        await updateMutation.mutateAsync({
          id: registration.eventTypeActionId,
          data: {
            eventTypeCode: registration.eventTypeCode,
            surfaces: surfacesWith(registration.surfaces, surface),
          },
        });
      } else {
        await createMutation.mutateAsync({
          data: { eventTypeCode: activityCode, surfaces: [surface] },
        });
      }
      onChanged?.();
    },
    [createMutation, updateMutation, onChanged]
  );

  const removeSurface = useCallback(
    async ({
      registration,
      surface,
    }: {
      registration: EventTypeAction;
      surface: EventActionSurface;
    }) => {
      const remaining = surfacesWithout(registration.surfaces, surface);
      if (remaining.length === 0) {
        await deleteMutation.mutateAsync({ id: registration.eventTypeActionId });
      } else {
        await updateMutation.mutateAsync({
          id: registration.eventTypeActionId,
          data: { eventTypeCode: registration.eventTypeCode, surfaces: remaining },
        });
      }
      onChanged?.();
    },
    [updateMutation, deleteMutation, onChanged]
  );

  const deleteRegistration = useCallback(
    async (registration: EventTypeAction) => {
      await deleteMutation.mutateAsync({ id: registration.eventTypeActionId });
      onChanged?.();
    },
    [deleteMutation, onChanged]
  );

  return {
    addSurface,
    removeSurface,
    deleteRegistration,
    isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
