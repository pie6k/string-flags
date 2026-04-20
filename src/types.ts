// Type-level machinery for FlagsString<U>.
//
// Given a string-literal union U, FlagsString<U> is the set of every
// protocol-compliant (alphabetical, deduplicated) comma-joined subset.
// Empty string represents no flags.
//
// Autocomplete surfaces shorter subsets first (singletons, then pairs, ...).
// With the hard 10-flag runtime cap this stays within TypeScript's
// instantiation limits.

// Order for character comparison. Matches Array.prototype.sort on the
// characters our runtime accepts (/^[a-zA-Z0-9]+$/).
type OrderedChars =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

type CharLessThan<A extends string, B extends string> = A extends B
  ? false
  : OrderedChars extends `${string}${A}${string}${B}${string}`
    ? true
    : false;

type StringLessThan<A extends string, B extends string> = A extends ""
  ? B extends ""
    ? false
    : true
  : B extends ""
    ? false
    : A extends `${infer HeadA}${infer TailA}`
      ? B extends `${infer HeadB}${infer TailB}`
        ? HeadA extends HeadB
          ? StringLessThan<TailA, TailB>
          : CharLessThan<HeadA, HeadB>
        : false
      : false;

// Sort a string union alphabetically into a tuple, without relying on the
// common UnionToTuple hack (which reorders non-deterministically).
type UnionHasTrue<U> = true extends U ? true : false;

type HasSmaller<Candidate extends string, Pool extends string> = UnionHasTrue<
  Pool extends string ? StringLessThan<Pool, Candidate> : never
>;

type Smallest<Remaining extends string, All extends string = Remaining> =
  Remaining extends string
    ? HasSmaller<Remaining, Exclude<All, Remaining>> extends true
      ? never
      : Remaining
    : never;

type SortUnion<
  U extends string,
  Acc extends readonly string[] = [],
> = [U] extends [never]
  ? Acc
  : Smallest<U> extends infer S extends string
    ? [S] extends [never]
      ? Acc
      : SortUnion<Exclude<U, S>, [...Acc, S]>
    : Acc;

// Power set, grouped by subset size so autocomplete lists singletons first.
type PopTuple<T extends readonly unknown[]> = T extends readonly [
  unknown,
  ...infer Rest,
]
  ? Rest
  : [];

type SubsetsOfSize<
  Members extends readonly string[],
  Size extends readonly unknown[],
> = Size["length"] extends 0
  ? never
  : Size["length"] extends 1
    ? Members[number]
    : Members extends readonly [
          infer Head extends string,
          ...infer Rest extends readonly string[],
        ]
      ? `${Head},${SubsetsOfSize<Rest, PopTuple<Size>>}` | SubsetsOfSize<Rest, Size>
      : never;

type PowerSet<
  Members extends readonly string[],
  Size extends readonly unknown[] = [unknown],
> = Members["length"] extends Size["length"]
  ? SubsetsOfSize<Members, Size>
  : SubsetsOfSize<Members, Size> | PowerSet<Members, [unknown, ...Size]>;

/**
 * Protocol-compliant flags string built from a union of flag names.
 *
 * - `""` means no flags.
 * - Non-empty values are alphabetical and deduplicated.
 */
export type FlagsString<U extends string> = [U] extends [never]
  ? ""
  : "" | PowerSet<SortUnion<U>>;
