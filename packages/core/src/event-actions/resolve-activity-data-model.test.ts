import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractDataModelCode, useActivityDataModel } from "./resolve-activity-data-model";

const sdkMock = vi.hoisted(() => ({
  useEventEngineManagementGetEventTypeConfigurationByType: vi.fn(),
  useDataModelManagementGetDataModelSchemaByCode: vi.fn(),
}));

vi.mock("@loom-loyalty/sdk", () => sdkMock);

type Config = Parameters<typeof extractDataModelCode>[0];

function asConfig(eventType: unknown): Config {
  return { eventType } as Config;
}

function mockChain(eventType: unknown, schema: unknown) {
  sdkMock.useEventEngineManagementGetEventTypeConfigurationByType.mockReturnValue({
    data: { data: { eventType } },
    isLoading: false,
  });
  sdkMock.useDataModelManagementGetDataModelSchemaByCode.mockReturnValue({
    data: schema === undefined ? undefined : { data: schema },
    isLoading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractDataModelCode", () => {
  it("reads a nested data model reference by code", () => {
    expect(extractDataModelCode(asConfig({ dataModel: { code: "HOTEL_STAY" } }))).toBe(
      "HOTEL_STAY"
    );
  });

  it("reads a nested data model reference by dataModelCode", () => {
    expect(extractDataModelCode(asConfig({ dataModel: { dataModelCode: "HOTEL_STAY" } }))).toBe(
      "HOTEL_STAY"
    );
  });

  it("reads a data model supplied as a plain string", () => {
    expect(extractDataModelCode(asConfig({ dataModel: "HOTEL_STAY" }))).toBe("HOTEL_STAY");
  });

  it("falls back to a flat code on the event type itself", () => {
    expect(extractDataModelCode(asConfig({ dataModelCode: "HOTEL_STAY" }))).toBe("HOTEL_STAY");
  });

  it("returns undefined without throwing when the linkage cannot be resolved", () => {
    expect(extractDataModelCode(undefined)).toBeUndefined();
    expect(extractDataModelCode(asConfig(undefined))).toBeUndefined();
    expect(extractDataModelCode(asConfig({}))).toBeUndefined();
    expect(extractDataModelCode(asConfig({ dataModel: {} }))).toBeUndefined();
    expect(extractDataModelCode(asConfig({ dataModel: 42 }))).toBeUndefined();
    expect(extractDataModelCode(asConfig({ dataModel: null }))).toBeUndefined();
  });
});

describe("useActivityDataModel", () => {
  it("returns the schema when the configuration carries a nested data model reference", () => {
    const schema = { type: "object", properties: { nights: { type: "integer" } } };
    mockChain({ dataModel: { code: "HOTEL_STAY" } }, schema);

    const { result } = renderHook(() => useActivityDataModel("hotel.stay"));

    expect(result.current.schema).toEqual(schema);
    expect(result.current.dataModelCode).toBe("HOTEL_STAY");
  });

  it("returns the schema when the configuration carries a flat data model code", () => {
    const schema = { type: "object" };
    mockChain({ dataModelCode: "HOTEL_STAY" }, schema);

    const { result } = renderHook(() => useActivityDataModel("hotel.stay"));

    expect(result.current.schema).toEqual(schema);
    expect(result.current.dataModelCode).toBe("HOTEL_STAY");
  });

  it("returns undefined, without throwing, when the linkage cannot be resolved", () => {
    mockChain({}, undefined);

    const { result } = renderHook(() => useActivityDataModel("hotel.stay"));

    expect(result.current.schema).toBeUndefined();
    expect(result.current.dataModelCode).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("does not fetch anything without an activity code", () => {
    mockChain({}, undefined);

    renderHook(() => useActivityDataModel(undefined));

    const [, , configOptions] =
      sdkMock.useEventEngineManagementGetEventTypeConfigurationByType.mock.calls[0] ?? [];
    expect(configOptions).toMatchObject({ query: { enabled: false } });

    const [, schemaOptions] =
      sdkMock.useDataModelManagementGetDataModelSchemaByCode.mock.calls[0] ?? [];
    expect(schemaOptions).toMatchObject({ query: { enabled: false } });
  });

  it("does not report loading from the schema query before a data model is known", () => {
    sdkMock.useEventEngineManagementGetEventTypeConfigurationByType.mockReturnValue({
      data: { data: { eventType: {} } },
      isLoading: false,
    });
    sdkMock.useDataModelManagementGetDataModelSchemaByCode.mockReturnValue({
      data: undefined,
      // A disabled query reports isLoading in TanStack Query v5; without the
      // dataModelCode guard this would strand the form in a loading state.
      isLoading: true,
    });

    const { result } = renderHook(() => useActivityDataModel("hotel.stay"));

    expect(result.current.isLoading).toBe(false);
  });
});
