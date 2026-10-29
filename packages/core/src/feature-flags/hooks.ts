import {
  useBooleanFlagDetails,
  useBooleanFlagValue,
  useOpenFeatureClientStatus,
} from "@openfeature/react-sdk";

/**
 * Reads a boolean flag. Returns `defaultValue` until the first evaluation resolves,
 * and whenever the flag is unknown or the server can't be reached.
 *
 * Core holds no flag keys; apps pass their own key union as `K`.
 */
export function useFeatureFlag<K extends string = string>(key: K, defaultValue: boolean): boolean {
  return useBooleanFlagValue(key, defaultValue);
}

/** Like {@link useFeatureFlag}, with the evaluation reason and metadata. */
export function useFeatureFlagDetails<K extends string = string>(key: K, defaultValue: boolean) {
  return useBooleanFlagDetails(key, defaultValue);
}

/** The provider's status: NOT_READY until the first evaluation, then READY, STALE or ERROR. */
export const useFeatureFlagStatus = useOpenFeatureClientStatus;
