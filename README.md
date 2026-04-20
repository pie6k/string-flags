# string-flags

**Developer-friendly, production-ready, human-readable alternative to binary flags.**

Store a set of flags in a single string, keep it in a strict, self-healing protocol form, and get full TypeScript autocomplete on every subset.

```ts
import { addStringFlag, toggleStringFlag, hasStringFlag, type FlagsString } from "string-flags";

type State = "idle" | "busy" | "error" | "blocked";

let flags: FlagsString<State> = "";
flags = addStringFlag<State>(flags, "busy");       // "busy"
flags = addStringFlag<State>(flags, "blocked");    // "blocked,busy"
flags = toggleStringFlag<State>(flags, "busy");    // "blocked"
flags = toggleStringFlag<State>(flags, "busy");    // "blocked,busy"

hasStringFlag<State>(flags, "busy");               // true
```

## Install

```bash
yarn add string-flags
# or
npm install string-flags
```

Requires Node 18+ and TypeScript 5+.

## Why not bitmasks?

Bitmasks are fast and compact. They are also opaque: `5` means nothing without the constants, they are a pain to inspect in logs and databases, and adding a flag requires a migration of every integer ever stored.

`string-flags` stores the same information as a readable, protocol-compliant string:

| Bitmask      | string-flags       |
| ------------ | ------------------ |
| `5`          | `"blocked,idle"`   |
| `0`          | `""`               |
| `BUSY\|IDLE` | `"busy,idle"`      |

- Readable in logs, database rows, URLs, and JSON payloads.
- Safe to diff — `"busy,idle"` is always the same string, never `"idle,busy"`.
- Type-checked — the set of valid strings is a finite union that TypeScript autocompletes.
- Safe to extend — adding a new flag does not reindex existing data.

## The protocol

A flags string follows a single, strict protocol:

1. A comma-separated list of flag names matching `/^[a-zA-Z0-9]+$/`.
2. Sorted alphabetically.
3. With no duplicates.
4. Or the empty string `""` for the empty set.

The library only ever **produces** strings in this form, and operations **expect** inputs in this form.

**It is self-healing.** In the real world, flag strings leak into places humans can edit — config files, database rows, URL params. When something comes back to the library out of order or with duplicates, you always find out:

- In non-strict mode (default), the library emits a `console.warn` and normalizes the input — every operation still returns a protocol-compliant string.
- In strict mode, the library throws instead.

Either way, protocol violations are never silent.

## Basic usage (schema-less helpers)

The standalone helpers work on any valid flag name. Pass the flag union explicitly as a type argument so TypeScript catches typos at the call site:

```ts
import {
  addStringFlag,
  removeStringFlag,
  toggleStringFlag,
  hasStringFlag,
  parseStringFlags,
  toStringFlags,
  type FlagsString,
} from "string-flags";

type State = "idle" | "busy" | "error" | "blocked";

let s: FlagsString<State> = "";
s = addStringFlag<State>(s, "idle");
s = toggleStringFlag<State>(s, "busy");   // "busy,idle"
hasStringFlag<State>(s, "busy");          // true
parseStringFlags<State>(s);               // ["busy", "idle"]
```

Because there is no registered schema, unknown flag names cannot be detected at runtime — TypeScript is the only guard. That is usually enough, and it keeps the call site trivial.

## Schema-based API

If you want a single object that owns the list of allowed flags and rejects anything else at runtime, define a schema.

```ts
import { defineStringFlags, type FlagsString } from "string-flags";

type State = "idle" | "busy" | "error" | "blocked";

const state = defineStringFlags<State>(["idle", "busy", "error", "blocked"]);

let s: FlagsString<State> = "";
s = state.addFlag(s, "busy");        // "busy"
s = state.addFlag(s, "blocked");     // "blocked,busy"
s = state.toggleFlag(s, "busy");     // "blocked"

state.hasFlag(s, "blocked");         // true
state.hasAllFlags(s, ["blocked"]);   // true
state.getFlags(s);                   // ["blocked"]

state.isFlagsString("busy,idle");    // true
state.isFlagsString("idle,busy");    // false — not in protocol form
state.isFlag("busy");                // true
```

The schema rejects unknown flags anywhere they appear (method arguments, parsed strings), so you get a single failure mode instead of quietly doing the wrong thing.

### Exhaustive schemas with `Record<U, true>`

The array form is easy to read but does not stop you from forgetting a new flag when you extend the union. The `Record<U, true>` form does:

```ts
const state = defineStringFlags<State>({
  idle: true,
  busy: true,
  error: true,
  blocked: true,
});
```

Now if someone adds `"paused"` to `State`, TypeScript will complain that `paused` is missing from the definition. Runtime behaviour is identical — pick the form that fits how you want to be warned.

## Strict mode

Every operation that can detect a problem does exactly one of three things:

| Situation                                  | Non-strict (default) | Strict  |
| ------------------------------------------ | -------------------- | ------- |
| Wrong order or duplicates (**recoverable**) | warn + normalize     | throw   |
| Unknown flag name (**unrecoverable**)       | throw                | throw   |
| Invalid characters, non-string input        | throw                | throw   |

```ts
const loose  = defineStringFlags<State>(["idle", "busy", "error", "blocked"]);
const strict = defineStringFlags<State>(["idle", "busy", "error", "blocked"], { strict: true });

loose.getFlags("busy,blocked");
// warn: input "busy,blocked" does not follow the protocol; normalized to "blocked,busy"
// returns ["blocked", "busy"]

strict.getFlags("busy,blocked");
// throws the same message
```

**Why unknown flags always throw** — even in non-strict mode. If your schema only knows `idle | busy | error | blocked`, and something passes `"blocked,paused"`, the library has no safe move:

- Dropping `paused` silently would lose information. The caller clearly meant for it to be there.
- Keeping it would mean returning a `FlagsString<State>` that contains a non-`State` member — a lie to TypeScript that would propagate undefined behaviour downstream.

So the library refuses to guess and throws. Strict mode only changes how **recoverable** problems are surfaced.

Rule of thumb: keep things non-strict inside your app, strict at trust boundaries (request bodies, external data).

### Assertions and type guards

```ts
state.isFlagsString(value);                            // type guard, strict
state.assertFlagsString(value, "bad input");           // throws on protocol violation, always strict
state.assertFlag(value, new BadRequestError("..."));   // returns U
```

`assertFlagsString` is unconditionally strict — the whole point of an assertion is a hard boundary. To normalize input, call `getFlags` (or the standalone `parseStringFlags`).

Every `assert*` method accepts either a string or an `Error` instance. Custom `Error` subclasses pass through unchanged.

## API reference

### Types

```ts
type FlagsString<U extends string>
type StringFlagsOptions = { strict?: boolean }
type ErrorInput = string | Error
```

### Schema

```ts
defineStringFlags<U>(
  input: readonly U[] | Record<U, true>,
  options?: StringFlagsOptions,
): StringFlags<U>

class StringFlags<U extends string> {
  readonly flags: readonly U[];

  toFlagsString(input: readonly U[]): FlagsString<U>;
  getFlags(input: FlagsString<U>): U[];

  hasFlag(input: FlagsString<U>, flag: U): boolean;
  hasAllFlags(input: FlagsString<U>, required: readonly U[]): boolean;
  hasAnyFlag(input: FlagsString<U>, candidates: readonly U[]): boolean;

  addFlag(input: FlagsString<U>, flag: U): FlagsString<U>;
  removeFlag(input: FlagsString<U>, flag: U): FlagsString<U>;
  toggleFlag(input: FlagsString<U>, flag: U): FlagsString<U>;

  isFlag(value: unknown): value is U;
  isFlagsString(value: unknown): value is FlagsString<U>;
  assertFlag(value: unknown, err: ErrorInput): U;
  assertFlagsString(value: unknown, err: ErrorInput): asserts value is FlagsString<U>;
}
```

### Standalone

```ts
toStringFlags<F>(flags: readonly F[]): FlagsString<F>;
parseStringFlags<F>(input: FlagsString<F>, options?: StringFlagsOptions): F[];
hasStringFlag<F>(input: FlagsString<F>, flag: F, options?): boolean;
addStringFlag<F>(input: FlagsString<F>, flag: F, options?): FlagsString<F>;
removeStringFlag<F>(input: FlagsString<F>, flag: F, options?): FlagsString<F>;
toggleStringFlag<F>(input: FlagsString<F>, flag: F, options?): FlagsString<F>;
```

## Constraints

- Flag names match `/^[a-zA-Z0-9]+$/`.
- Flag names are at most 64 characters.
- Schemas have at most 10 flags (keeps the compile-time power-set within TypeScript's instantiation limits).

## Contributing

The repo uses Yarn 4 via [Corepack](https://nodejs.org/api/corepack.html) with the `node-modules` linker. Enable Corepack once (`corepack enable`) and the right Yarn version is picked automatically from `packageManager` in `package.json`.

```bash
corepack enable
yarn install
yarn test
yarn typecheck
yarn build
```

## License

MIT © Adam Pietrasiak
