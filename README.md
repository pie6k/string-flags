# string-flags

**Developer-friendly, production-ready, human-readable alternative to binary flags.**

Store a set of flags in a single string, keep it in a strict, self-healing protocol form, and get full TypeScript autocomplete on every legal subset.

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

## Type-safe and autocompletable

`FlagsString<U>` is not a generic string. TypeScript knows the exact set of legal values and enforces the protocol at compile time.

```ts
type State = "idle" | "busy" | "error" | "blocked";

const a: FlagsString<State> = "";               // ✓ empty set
const a1: FlagsString<State> = "busy";          // ✓ single flag
const a2: FlagsString<State> = "blocked,busy";  // ✓ alphabetical
const a3: FlagsString<State> = "blocked,busy,error,idle"; // ✓ full set

const b: FlagsString<State> = "busy,blocked";   // ✗ wrong order
const c: FlagsString<State> = "busy,busy";      // ✗ duplicate
const d: FlagsString<State> = "paused";         // ✗ unknown flag
const e: FlagsString<State> = "blocked,";       // ✗ trailing comma
```

Autocomplete lists every legal subset — the empty string, then singletons, pairs, triples, up to the full set. Typos do not compile. When a user edits a string by hand and puts the flags in the wrong order, the runtime normalizes the value and emits a warning (see [The protocol](#the-protocol) below).

## A semi-real example

```ts
import { defineStringFlags, type FlagsString } from "string-flags";

type TaskState = "idle" | "busy" | "error" | "blocked";

const taskState = defineStringFlags<TaskState>(["idle", "busy", "error", "blocked"]);

class Task {
  state: FlagsString<TaskState> = "";

  setState(next: FlagsString<TaskState>) {
    // The argument is autocompleted: the IDE suggests every legal subset,
    // and "busy,idle" / "busy,busy" / "paused" simply do not compile.
    this.state = next;
  }

  performWork() {
    if (taskState.hasFlag(this.state, "busy")) {
      throw new Error("Task is already busy");
    }
    this.state = taskState.addFlag(this.state, "busy");
    try {
      // ... do the work ...
    } finally {
      this.state = taskState.removeFlag(this.state, "busy");
    }
  }
}

const task = new Task();
task.setState("blocked,error");   // ✓
task.performWork();               // throws if "busy" is already in state
```

## Install

```bash
yarn add string-flags
# or
npm install string-flags
```

Requires Node 18+ and TypeScript 5+.

## Why not bitmasks?

Bitmasks are great for computers. They are tricky for developers:

- **Opaque.** You cannot understand what `5` means without looking up the mask definition.
- **Not how we think.** Even when you know the flags, you think in names (`"busy"`, `"blocked"`), not in bits.
- **Hard for humans to edit.** A database row that says `blocked,idle` is obvious to a non-technical user. `5` is not.
- **Import everywhere.** Anywhere you want to check a bit, you have to import the enum of masks.
- **Awkward syntax.** `|`, `&`, `^`, `~`, `&=`, `<<`, `>>` — correct, but uncommon in everyday JavaScript.
- **No help from the compiler on combinations.** `BUSY | IDLE` is just a `number`; TypeScript cannot tell you which combinations are meaningful.

`string-flags` addresses all of these:

- **Readable** in logs, URLs, database rows, and JSON payloads.
- **Type-safe for single flags and for combinations.** `FlagsString<U>` is a finite union, not a string.
- **Alphabetical autocomplete** on every legal subset — the IDE teaches the API as you type.
- **Safe to diff.** `"busy,idle"` is always the same string; the library never produces `"idle,busy"`.
- **Safe to extend.** Adding a flag does not reindex old data; old strings keep their meaning.

## `defineStringFlags` — stricter, contained API

The standalone helpers (`addStringFlag`, `toggleStringFlag`, …) work on any valid flag name. That is convenient for ad-hoc sets, but unknown flags can only be caught by TypeScript — there is no registered list.

`defineStringFlags` gives you a single object that owns the exact list of allowed flags and rejects anything else at runtime:

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

state.isFlag("busy");                // true
state.isFlagsString("busy,idle");    // true
state.isFlagsString("idle,busy");    // false — not in protocol form
```

### Exhaustive schemas with `Record<U, true>`

The array form does not stop you from forgetting a new flag when you extend the union. The `Record<U, true>` form does:

```ts
const state = defineStringFlags<State>({
  idle: true,
  busy: true,
  error: true,
  blocked: true,
});
```

Add `"paused"` to `State` and TypeScript will refuse to compile this object until you register it. Runtime behaviour is identical; pick the form that fits how you want to be warned.

## The protocol

`string-flags` is designed for production use, with no undefined behaviour and no silent drift. The format every value follows is called _the protocol_.

**The rules:**

1. Flags are joined with a single comma `,`. **No whitespace.**
2. The list is always in alphabetical order.
3. No duplicates.
4. Flag names match `/^[a-zA-Z0-9]+$/` — no special characters.
5. The empty string `""` is valid and means no flags.

**The library is self-fixing.** Flag strings leak into places humans can edit — config files, database rows, URL parameters. When something comes back out of order or with duplicates, the library normalizes it and emits a `console.warn`. The returned value is always in protocol form.

**The library is strict where self-fixing would be unsafe.** If a schema-based operation receives a flag it does not know about, it has no safe move:

- Dropping the unknown flag silently would lose information — the caller meant it to be there.
- Keeping the unknown flag would mean returning a `FlagsString<State>` that contains a non-`State` member. That is a lie to TypeScript, and it propagates undefined behaviour downstream.

So the library refuses to guess and throws. The same applies to invalid characters and non-string input.

## Strict mode

Strict mode exists because recoverable problems like wrong order can still be bugs — if your database should only ever contain protocol-compliant strings, you want to know the moment one does not.

| Situation                                    | Non-strict (default) | Strict  |
| -------------------------------------------- | -------------------- | ------- |
| Wrong order or duplicates (**recoverable**)   | warn + normalize     | throw   |
| Unknown flag name (**unrecoverable**)         | throw                | throw   |
| Invalid characters, non-string input          | throw                | throw   |

```ts
const loose  = defineStringFlags<State>(["idle", "busy", "error", "blocked"]);
const strict = defineStringFlags<State>(["idle", "busy", "error", "blocked"], { strict: true });

loose.getFlags("busy,blocked");
// warn: input "busy,blocked" does not follow the protocol; normalized to "blocked,busy"
// returns ["blocked", "busy"]

strict.getFlags("busy,blocked");
// throws the same message
```

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
