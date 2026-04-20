export const MAX_FLAGS = 10;
export const MAX_FLAG_NAME_LENGTH = 64;
export const VALID_FLAG_NAME = /^[a-zA-Z0-9]+$/;

export type ErrorInput = string | Error;

export function resolveErrorInput(input: ErrorInput): Error {
  return input instanceof Error ? input : new Error(input);
}

export function assert(condition: unknown, input: ErrorInput): asserts condition {
  if (!condition) throw resolveErrorInput(input);
}

export function assertValidName(
  flag: unknown,
  context: string,
): asserts flag is string {
  assert(typeof flag === "string", `${context}: flag must be a string (got ${String(flag)})`);
  assert(flag.length > 0, `${context}: flag cannot be empty`);
  assert(
    flag.length <= MAX_FLAG_NAME_LENGTH,
    `${context}: flag "${flag}" exceeds max length (${MAX_FLAG_NAME_LENGTH})`,
  );
  assert(
    VALID_FLAG_NAME.test(flag),
    `${context}: flag "${flag}" contains disallowed characters. Only a-zA-Z0-9 allowed.`,
  );
}

export interface NormalizeResult<T> {
  normalized: T[];
  wasAltered: boolean;
  wasReordered: boolean;
  hadDuplicates: boolean;
}

export function normalize<T>(
  items: readonly T[],
  compare: (a: T, b: T) => number,
): NormalizeResult<T> {
  const seen = new Set<T>();
  const deduped: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      deduped.push(item);
    }
  }
  const hadDuplicates = deduped.length !== items.length;
  const normalized = [...deduped].sort(compare);
  const wasReordered = normalized.some((item, i) => item !== deduped[i]);
  const wasAltered = hadDuplicates || wasReordered;
  return { normalized, wasAltered, wasReordered, hadDuplicates };
}

function describeReason(wasReordered: boolean, hadDuplicates: boolean): string {
  const parts: string[] = [];
  if (wasReordered) parts.push("not properly ordered");
  if (hadDuplicates) parts.push("contains duplicates");
  return parts.join(" and ");
}

export function reportProtocolViolation(
  context: string,
  original: string,
  normalized: string,
  strict: boolean,
  wasReordered: boolean,
  hadDuplicates: boolean,
): void {
  const reason = describeReason(wasReordered, hadDuplicates);
  const message = `${context}: input ${JSON.stringify(original)} does not follow the protocol (${reason}); normalized to ${JSON.stringify(normalized)}`;
  if (strict) throw new Error(message);
  console.warn(message);
}

export const lexCompare = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

export interface StringFlagsOptions {
  /**
   * When true, input that violates the protocol (duplicates, wrong order)
   * throws. When false (default), it is normalized and a warning is emitted
   * on `console.warn`. Unknown flags and invalid characters always throw,
   * regardless of this setting.
   */
  strict?: boolean;
}
