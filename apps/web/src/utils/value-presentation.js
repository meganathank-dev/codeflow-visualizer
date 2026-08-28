function isOpaqueRuntimeObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.$type === "object" &&
    typeof value.display === "string";
}

export function isJavaScannerValue(value) {
  return isOpaqueRuntimeObject(value) &&
    /(?:^|\.)Scanner(?:$|[@{\s])/i.test(value.display);
}

export function isInternalRuntimeVariable(name, value, language) {
  const normalizedName = String(name || "").toLowerCase();

  if (["args", "argv"].includes(normalizedName) && Array.isArray(value) && value.length === 0) {
    return true;
  }

  return language === "java" && isJavaScannerValue(value);
}

export function selectVisibleRuntimeVariables(variables = {}, language) {
  return Object.fromEntries(
    Object.entries(variables).filter(
      ([name, value]) => !isInternalRuntimeVariable(name, value, language)
    )
  );
}

function friendlyOpaqueObjectName(display) {
  if (/java\.util\.Scanner/i.test(display)) {
    return "Scanner (System.in)";
  }

  const className = display.match(/(?:^|\.)([A-Za-z_$][\w$]*)(?:@|$)/)?.[1];
  return className || display;
}

export function formatRuntimeValue(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (value === undefined) {
    return "undefined";
  }

  if (isOpaqueRuntimeObject(value)) {
    return friendlyOpaqueObjectName(value.display);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => formatRuntimeValue(entry)).join(", ")}]`;
  }

  if (value !== null && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function getRuntimeValueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (isOpaqueRuntimeObject(value)) return "object";
  return typeof value;
}
