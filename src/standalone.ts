import type { FlagsString } from "./types";
import {
  assert,
  assertValidName,
  lexCompare,
  normalize,
  reportProtocolViolation,
  StringFlagsOptions,
} from "./internal";

// Schema-less helpers. They enforce the protocol (character validity,
// alphabetical order, no duplicates) but cannot detect "unknown" flags
// because there is no reference set.
//
// Pass the flag union explicitly for a safer call site:
//   toggleStringFlag<State>(current, "idle")

function parse(input: unknown, context: string, strict: boolean): string[] {
  assert(typeof input === "string", `${context}: expected a string (got ${String(input)})`);
  if (input === "") return [];

  const segments = input.split(",");
  for (const s of segments) assertValidName(s, context);

  const result = normalize(segments, lexCompare);
  if (result.wasAltered) {
    reportProtocolViolation(
      context,
      input,
      result.normalized.join(","),
      strict,
      result.wasReordered,
      result.hadDuplicates,
    );
  }
  return result.normalized;
}

/** Build a protocol-compliant flags string from an array. */
export function toStringFlags<F extends string>(flags: readonly F[]): FlagsString<F> {
  assert(Array.isArray(flags), "toStringFlags: expected an array");
  for (const f of flags) assertValidName(f, "toStringFlags");
  const { normalized } = normalize(flags, lexCompare);
  return normalized.join(",") as FlagsString<F>;
}

/** Parse a flags string into an array. Normalizes in non-strict mode. */
export function parseStringFlags<F extends string>(
  input: FlagsString<F>,
  options: StringFlagsOptions = {},
): F[] {
  return parse(input, "parseStringFlags", options.strict ?? false) as F[];
}

export function hasStringFlag<F extends string>(
  input: FlagsString<F>,
  flag: F,
  options: StringFlagsOptions = {},
): boolean {
  assertValidName(flag, "hasStringFlag");
  return parse(input, "hasStringFlag", options.strict ?? false).includes(flag);
}

export function addStringFlag<F extends string>(
  input: FlagsString<F>,
  flag: F,
  options: StringFlagsOptions = {},
): FlagsString<F> {
  assertValidName(flag, "addStringFlag");
  const current = parse(input, "addStringFlag", options.strict ?? false);
  if (current.includes(flag)) return toStringFlags(current as F[]);
  return toStringFlags([...current, flag] as F[]);
}

export function removeStringFlag<F extends string>(
  input: FlagsString<F>,
  flag: F,
  options: StringFlagsOptions = {},
): FlagsString<F> {
  assertValidName(flag, "removeStringFlag");
  const remaining = parse(input, "removeStringFlag", options.strict ?? false)
    .filter((f) => f !== flag);
  return toStringFlags(remaining as F[]);
}

export function toggleStringFlag<F extends string>(
  input: FlagsString<F>,
  flag: F,
  options: StringFlagsOptions = {},
): FlagsString<F> {
  assertValidName(flag, "toggleStringFlag");
  const current = parse(input, "toggleStringFlag", options.strict ?? false);
  const next = current.includes(flag)
    ? current.filter((f) => f !== flag)
    : [...current, flag];
  return toStringFlags(next as F[]);
}
