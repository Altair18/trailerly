// Env values pasted through some terminals (notably Windows PowerShell pipes) can pick up
// a byte-order mark, zero-width characters or trailing newlines. Those break HTTP headers
// ("String contains non ISO-8859-1 code point"), so strip them wherever a value is read.
export function cleanEnv(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const cleaned = value.replace(/[﻿​-‍⁠ ]/g, "").trim();
  return cleaned === "" ? undefined : cleaned;
}
