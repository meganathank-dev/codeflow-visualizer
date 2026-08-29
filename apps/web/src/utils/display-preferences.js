export const DISPLAY_MODES = Object.freeze([
  {
    value: "compact",
    label: "Compact",
    description: "Default workspace view"
  },
  {
    value: "presentation",
    label: "Presentation",
    description: "Large text for teaching and projectors"
  }
]);

export const DEFAULT_DISPLAY_MODE = "compact";
export const DISPLAY_MODE_STORAGE_KEY = "codeflow.display-mode";

export function normalizeDisplayMode(value) {
  return DISPLAY_MODES.some((mode) => mode.value === value)
    ? value
    : DEFAULT_DISPLAY_MODE;
}

export function readDisplayMode(storage = globalThis.localStorage) {
  try {
    return normalizeDisplayMode(storage?.getItem(DISPLAY_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_DISPLAY_MODE;
  }
}

export function saveDisplayMode(value, storage = globalThis.localStorage) {
  const normalized = normalizeDisplayMode(value);
  try {
    storage?.setItem(DISPLAY_MODE_STORAGE_KEY, normalized);
  } catch {
    // The selected mode still applies for this session when storage is blocked.
  }
  return normalized;
}
