# string-flags

**Developer-friendly, production-ready, human-readable alternative to binary flags.**

Store a set of flags in a single string, keep it canonical, and get full TypeScript autocomplete on every subset.

```ts
type State = "idle" | "busy" | "error" | "blocked";

let flags: FlagsString<State> = "";
flags = addStringFlag(flags, "busy");      // "busy"
flags = addStringFlag(flags, "blocked");   // "blocked,busy"
hasStringFlag<State>(flags, "busy");       // true
```

---

## Why not bitmasks?

Bitmasks are fast and compact. They are also opaque: `5` means nothing without the constants, they are a pain to inspect in logs and databases, and adding a flag requires a migration of every integer ever stored.

`string-flags` stores the same information as a readable, canonically ordered string:

| Bitmask    | string-flags                |
| ---------- | --------------------------- |
| `5`        | `"blocked,idle"`            |
| `0`        | `""`                        |
| `BUSY\|IDLE` | `"busy,idle"`             |

- Readable in logs, database rows, URLs, and JSON payloads.
- Safe to diff — `"busy,idle"` is always the same string, never `"idle,busy"`.
- Type-checked — the set of valid strings is a finite union that TypeScript autocompletes.
- Safe to extend — adding a flag does not reindex old data.

## Install

```bash
yarn add string-flags
# or
npm install string-flags
```

Requires Node 18+ and TypeScript 5+.

## Two APIs, same guarantees

Pick whichever fits your code style. Both enforce the same rules and produce the same canonical strings.

### Schema-based (`StringFlags` / `defineStringFlags`)

Use this when you have a fixed set of flags. It catches unknown flags at runtime and gives you a single object to pass around.

```ts
import { defineStringFlags, type FlagsString } from "string-flags";

type State = "idle" | "busy" | "error" | "blocked";

const state = defineStringFlags<State>({
  idle: true,
  busy: true,
  error: true,
  blocked: true,
});

let s: FlagsString<State> = "";
s = state.addFlag(s, "busy");       // "busy"
s = state.addFlag(s, "blocked");    // "blocked,busy"
s = state.toggleFlag(s, "busy");    // "blocked"

state.hasFlag(s, "blocked");        // true
state.hasAllFlags(s, ["blocked"]);  // true
state.getFlags(s);                  // ["blocked"]

state.isFlagsString("busy,idle");   // true
state.isFlagsString("idle,busy");   // false — not canonical
state.isFlag("busy");               // true
```

The `Record<U, true>` form gives compile-time exhaustiveness — miss a flag and TypeScript complains. An array form is also accepted.

### Schema-less helpers

Drop-in functions that work on any valid flag name. Great for ad-hoc flag sets.

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
```

Since there is no schema, unknown flag names cannot be detected. Pass the union explicitly (as shown above) so TypeScript catches typos at the call site.

## Canonical form

A canonical flags string is:

1. A comma-separated list of flag names.
2. Sorted alphabetically.
3. With no duplicates.
4. Or the empty string `""` for the empty set.

This is the only form the library ever produces. Queries like `hasFlag` accept the same form on input.

## Strict vs non-strict

Non-canonical input (swapped order, duplicates) is always detectable. What happens next is your choice:

- **Non-strict (default)** — `console.warn` is emitted and the input is normalized. You always get the canonical result back.
- **Strict** — non-canonical input throws.

```ts
const loose  = defineStringFlags<State>({ idle: true, busy: true, ... });
const strict = defineStringFlags<State>({ idle: true, busy: true, ... }, { strict: true });

loose.getFlags("busy,blocked");
// warn: input "busy,blocked" was not canonical; normalized to "blocked,busy"
// returns ["blocked", "busy"]

strict.getFlags("busy,blocked");
// throws
```

Unknown flags and disallowed characters always throw, in both modes. The strict switch is only about recoverable shape problems.

Rule of thumb: keep things non-strict inside your app, strict at trust boundaries (request bodies, external data).

### Assertions and type guards

```ts
state.isFlagsString(value);                          // type guard, strict
state.assertFlagsString(value, "bad input");         // throws on non-canonical, always strict
state.assertFlag(value, new BadRequestError("..."));  // returns U
```

`assertFlagsString` is unconditionally strict — the whole point of an assertion is a hard boundary. To normalize non-canonical input, call `getFlags` (or the standalone `parseStringFlags`).

You can pass either a string or an `Error` instance to any `assert*` method. Custom `Error` subclasses pass through unchanged.

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
