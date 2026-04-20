import type { FlagsString } from "./types";
import {
  assert,
  assertValidName,
  canonicalize,
  ErrorInput,
  MAX_FLAGS,
  reportNonCanonical,
  resolveErrorInput,
  StringFlagsOptions,
} from "./internal";

export class StringFlags<U extends string> {
  readonly flags: readonly U[];
  private readonly memberIndex: ReadonlyMap<U, number>;
  private readonly memberSet: ReadonlySet<string>;
  private readonly strict: boolean;

  constructor(members: readonly U[], options: StringFlagsOptions = {}) {
    assert(Array.isArray(members), "StringFlags: members must be an array");
    assert(members.length > 0, "StringFlags: at least one flag required");
    assert(
      members.length <= MAX_FLAGS,
      `StringFlags: at most ${MAX_FLAGS} flags allowed (got ${members.length})`,
    );

    const seen = new Set<string>();
    for (const m of members) {
      assertValidName(m, "StringFlags");
      assert(!seen.has(m), `StringFlags: duplicate flag "${m}"`);
      seen.add(m);
    }

    const sorted = [...members].sort() as U[];
    this.flags = Object.freeze(sorted);
    this.memberIndex = new Map(sorted.map((f, i) => [f, i] as const));
    this.memberSet = new Set<string>(sorted);
    this.strict = options.strict ?? false;
  }

  toString(): string {
    return `StringFlags(${this.flags.join(", ")})`;
  }

  private compareByIndex = (a: U, b: U): number =>
    this.memberIndex.get(a)! - this.memberIndex.get(b)!;

  private assertKnown(flag: unknown, context: string): asserts flag is U {
    assert(this.isFlag(flag), `${context}: unknown flag ${JSON.stringify(flag)}`);
  }

  // Parses a flags string into an array of known flags. Unknown flags and
  // non-string inputs always throw. Non-canonical input warns or throws
  // depending on strict mode.
  private parse(input: unknown, context: string): U[] {
    assert(typeof input === "string", `${context}: expected a string (got ${String(input)})`);
    if (input === "") return [];

    const segments = input.split(",") as U[];
    for (const s of segments) this.assertKnown(s, context);

    const { canonical, wasAltered } = canonicalize(segments, this.compareByIndex);
    if (wasAltered) reportNonCanonical(context, input, canonical.join(","), this.strict);
    return canonical;
  }

  /** Build a canonical flags string from any order or duplication. */
  toFlagsString(input: readonly U[]): FlagsString<U> {
    assert(Array.isArray(input), "StringFlags.toFlagsString: expected an array");
    for (const f of input) this.assertKnown(f, "StringFlags.toFlagsString");
    const { canonical } = canonicalize(input, this.compareByIndex);
    return canonical.join(",") as FlagsString<U>;
  }

  /** Parse a flags string into an array. Normalizes in non-strict mode. */
  getFlags(input: FlagsString<U>): U[] {
    return this.parse(input, "StringFlags.getFlags");
  }

  hasFlag(input: FlagsString<U>, flag: U): boolean {
    this.assertKnown(flag, "StringFlags.hasFlag");
    return this.parse(input, "StringFlags.hasFlag").includes(flag);
  }

  hasAllFlags(input: FlagsString<U>, required: readonly U[]): boolean {
    for (const r of required) this.assertKnown(r, "StringFlags.hasAllFlags");
    const present = new Set(this.parse(input, "StringFlags.hasAllFlags"));
    return required.every((f) => present.has(f));
  }

  hasAnyFlag(input: FlagsString<U>, candidates: readonly U[]): boolean {
    for (const c of candidates) this.assertKnown(c, "StringFlags.hasAnyFlag");
    const present = new Set(this.parse(input, "StringFlags.hasAnyFlag"));
    return candidates.some((f) => present.has(f));
  }

  addFlag(input: FlagsString<U>, flag: U): FlagsString<U> {
    this.assertKnown(flag, "StringFlags.addFlag");
    const current = this.parse(input, "StringFlags.addFlag");
    if (current.includes(flag)) return this.toFlagsString(current);
    return this.toFlagsString([...current, flag]);
  }

  removeFlag(input: FlagsString<U>, flag: U): FlagsString<U> {
    this.assertKnown(flag, "StringFlags.removeFlag");
    const remaining = this.parse(input, "StringFlags.removeFlag").filter((f) => f !== flag);
    return this.toFlagsString(remaining);
  }

  toggleFlag(input: FlagsString<U>, flag: U): FlagsString<U> {
    this.assertKnown(flag, "StringFlags.toggleFlag");
    const current = this.parse(input, "StringFlags.toggleFlag");
    const next = current.includes(flag)
      ? current.filter((f) => f !== flag)
      : [...current, flag];
    return this.toFlagsString(next);
  }

  /** Is `value` one of the declared flags? */
  isFlag(value: unknown): value is U {
    return typeof value === "string" && this.memberSet.has(value);
  }

  /**
   * Is `value` a canonical flags string? Strict predicate — returns false
   * for non-canonical input regardless of the schema's strict mode.
   */
  isFlagsString(value: unknown): value is FlagsString<U> {
    if (typeof value !== "string") return false;
    if (value === "") return true;

    const segments = value.split(",");
    const seen = new Set<string>();
    let prev = -1;
    for (const s of segments) {
      if (!this.memberSet.has(s)) return false;
      if (seen.has(s)) return false;
      seen.add(s);
      const i = this.memberIndex.get(s as U)!;
      if (i <= prev) return false;
      prev = i;
    }
    return true;
  }

  /**
   * Throw `errorInput` unless `value` is a canonical flags string.
   * Always strict — the whole point of an assertion is a hard boundary.
   * To normalize non-canonical input, use `getFlags` or `toFlagsString`.
   */
  assertFlagsString(value: unknown, errorInput: ErrorInput): asserts value is FlagsString<U> {
    if (!this.isFlagsString(value)) throw resolveErrorInput(errorInput);
  }

  /** Throw `errorInput` unless `value` is a declared flag. Returns the narrowed value. */
  assertFlag(value: unknown, errorInput: ErrorInput): U {
    if (!this.isFlag(value)) throw resolveErrorInput(errorInput);
    return value;
  }
}

type DefineInput<U extends string> = readonly U[] | Record<U, true>;

function resolveInput<U extends string>(input: DefineInput<U>): U[] {
  if (Array.isArray(input)) return [...input];

  assert(
    input !== null && typeof input === "object",
    `defineStringFlags: expected an array or Record<U, true> (got ${String(input)})`,
  );

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record) as U[];
  for (const k of keys) {
    assert(
      record[k] === true,
      `defineStringFlags: flag "${k}" must map to literal \`true\` (got ${String(record[k])})`,
    );
  }
  return keys;
}

/**
 * Create a StringFlags schema. The `Record<U, true>` form gives
 * compile-time exhaustiveness; the array form does not but is easier
 * to read. Runtime behaviour is identical.
 */
export function defineStringFlags<U extends string>(
  input: DefineInput<U>,
  options?: StringFlagsOptions,
): StringFlags<U> {
  return new StringFlags(resolveInput(input), options);
}
