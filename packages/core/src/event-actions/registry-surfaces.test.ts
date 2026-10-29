import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { surfacesWith, surfacesWithout, useRegistrySurfaces } from "./registry-surfaces";

const sdkMock = vi.hoisted(() => ({
  useEventEngineManagementCreateEventTypeAction: vi.fn(),
  useEventEngineManagementUpdateEventTypeAction: vi.fn(),
  useEventEngineManagementDeleteEventTypeAction: vi.fn(),
}));

vi.mock("@loom-loyalty/sdk", () => sdkMock);

const createAsync = vi.fn();
const updateAsync = vi.fn();
const deleteAsync = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  sdkMock.useEventEngineManagementCreateEventTypeAction.mockReturnValue({
    mutateAsync: createAsync,
    isPending: false,
  });
  sdkMock.useEventEngineManagementUpdateEventTypeAction.mockReturnValue({
    mutateAsync: updateAsync,
    isPending: false,
  });
  sdkMock.useEventEngineManagementDeleteEventTypeAction.mockReturnValue({
    mutateAsync: deleteAsync,
    isPending: false,
  });
});

describe("surface set arithmetic", () => {
  it("adds a surface to the existing set", () => {
    expect(surfacesWith(["DEVELOPER"], "CUSTOMER_CARE")).toEqual(["DEVELOPER", "CUSTOMER_CARE"]);
  });

  it("does not duplicate a surface already present", () => {
    expect(surfacesWith(["CUSTOMER_CARE"], "CUSTOMER_CARE")).toEqual(["CUSTOMER_CARE"]);
  });

  it("treats an absent set as empty", () => {
    expect(surfacesWith(undefined, "CUSTOMER_CARE")).toEqual(["CUSTOMER_CARE"]);
    expect(surfacesWithout(undefined, "CUSTOMER_CARE")).toEqual([]);
  });

  it("removes a surface and keeps the rest", () => {
    expect(surfacesWithout(["DEVELOPER", "CUSTOMER_CARE"], "CUSTOMER_CARE")).toEqual(["DEVELOPER"]);
  });
});

describe("useRegistrySurfaces", () => {
  const registration = {
    eventTypeActionId: "eta_1",
    eventTypeCode: "hotel.stay",
    surfaces: ["DEVELOPER" as const],
  };

  it("adding a surface sends the FULL intended set", async () => {
    // The endpoint replaces rather than merges, so sending only the new surface
    // would withdraw the developer surface as a side effect.
    const onChanged = vi.fn();
    const { result } = renderHook(() => useRegistrySurfaces(onChanged));

    await result.current.addSurface({
      activityCode: "hotel.stay",
      surface: "CUSTOMER_CARE",
      registration,
    });

    expect(updateAsync).toHaveBeenCalledWith({
      id: "eta_1",
      data: { eventTypeCode: "hotel.stay", surfaces: ["DEVELOPER", "CUSTOMER_CARE"] },
    });
    expect(createAsync).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("creates a registration when the activity has none yet", async () => {
    const { result } = renderHook(() => useRegistrySurfaces());

    await result.current.addSurface({ activityCode: "hotel.stay", surface: "CUSTOMER_CARE" });

    expect(createAsync).toHaveBeenCalledWith({
      data: { eventTypeCode: "hotel.stay", surfaces: ["CUSTOMER_CARE"] },
    });
    expect(updateAsync).not.toHaveBeenCalled();
  });

  it("removing a surface sends the remaining surfaces, not an empty payload", async () => {
    const { result } = renderHook(() => useRegistrySurfaces());

    await result.current.removeSurface({
      registration: { ...registration, surfaces: ["DEVELOPER", "CUSTOMER_CARE"] },
      surface: "CUSTOMER_CARE",
    });

    expect(updateAsync).toHaveBeenCalledWith({
      id: "eta_1",
      data: { eventTypeCode: "hotel.stay", surfaces: ["DEVELOPER"] },
    });
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it("deletes the registration when the removed surface was its only one", async () => {
    // An empty surface set exposes the activity nowhere: a row with no purpose
    // rather than a meaningful state.
    const { result } = renderHook(() => useRegistrySurfaces());

    await result.current.removeSurface({
      registration: { ...registration, surfaces: ["CUSTOMER_CARE"] },
      surface: "CUSTOMER_CARE",
    });

    expect(deleteAsync).toHaveBeenCalledWith({ id: "eta_1" });
    expect(updateAsync).not.toHaveBeenCalled();
  });

  it("deletes a registration outright when asked", async () => {
    const { result } = renderHook(() => useRegistrySurfaces());

    await result.current.deleteRegistration(registration);

    expect(deleteAsync).toHaveBeenCalledWith({ id: "eta_1" });
  });

  it("never sends an activity code different from the registration's own", async () => {
    // The activity code is fixed at creation; an update may only change surfaces.
    const { result } = renderHook(() => useRegistrySurfaces());

    await result.current.addSurface({
      activityCode: "something.else",
      surface: "CUSTOMER_CARE",
      registration,
    });

    const [call] = updateAsync.mock.calls[0] as [{ data: { eventTypeCode: string } }];
    expect(call.data.eventTypeCode).toBe("hotel.stay");
  });

  it("reports pending while any mutation is in flight", () => {
    sdkMock.useEventEngineManagementUpdateEventTypeAction.mockReturnValue({
      mutateAsync: updateAsync,
      isPending: true,
    });

    const { result } = renderHook(() => useRegistrySurfaces());
    expect(result.current.isPending).toBe(true);
  });
});
