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

`FlagsString<U>` is not a generic string — it's a type-safe union of every legal, alphabetically ordered combination of your flags, with full type checking and autocomplete. TypeScript enforces the protocol at compile time, so non-compliant values simply do not type-check.

```ts
type State = "idle" | "busy" | "error" | "blocked";

const a: FlagsString<State> = "";                          // 🟢 empty set
const a1: FlagsString<State> = "busy";                     // 🟢 single flag
const a2: FlagsString<State> = "blocked,busy";             // 🟢 alphabetical
const a3: FlagsString<State> = "blocked,busy,error,idle";  // 🟢 full set

const b: FlagsString<State> = "busy,blocked";              // 🔴 wrong order
const c: FlagsString<State> = "busy,busy";                 // 🔴 duplicate
const d: FlagsString<State> = "paused";                    // 🔴 unknown flag
const e: FlagsString<State> = "blocked,";                  // 🔴 trailing comma
```

Autocomplete lists every legal subset — the empty string, then singletons, pairs, triples, up to the full set. Typos do not compile. When a user edits a string by hand and puts the flags in the wrong order, the runtime normalizes the value and emits a warning (see [The protocol](#the-protocol) below).

## Example

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
task.setState("blocked,error");   // 🟢
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
- **Safe to diff.** Flags are always alphabetically ordered, so a given set has exactly one string form — you never see `"busy,idle"` in one place and `"idle,busy"` in another.
- **Safe to extend.** Adding a flag does not reindex old data; old strings keep their meaning.

## `defineStringFlags`

You can also define a schema with an explicit list of allowed flags and use it for strict, type-checked operations against that list.

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

The `Record<U, true>` form is useful when you want the compiler to force the definition to stay in sync with the union.

Consider the array form over time:

```ts
type State = "idle" | "busy" | "error" | "blocked";

const state = defineStringFlags<State>(["idle", "busy", "error", "blocked"]);
// 🟢 compiles
```

Later a teammate adds a new state:

```ts
type State = "idle" | "busy" | "error" | "blocked" | "paused";

const state = defineStringFlags<State>(["idle", "busy", "error", "blocked"]);
// 🔴 silently missing "paused" — TypeScript cannot catch this.
```

The `Record<U, true>` form does catch it:

```ts
const state = defineStringFlags<State>({
  idle: true,
  busy: true,
  error: true,
  blocked: true,
  // 🔴 TS error: Property 'paused' is missing in type '{...}'
  //    but required in type 'Record<State, true>'.
});
```

## The protocol

`string-flags` is designed for production use — no undefined behaviour, no silent drift. Every value the library produces or accepts follows a single format called _the protocol_.

**The rules:**

1. Flags are joined with a single comma `,`. No whitespace.
2. The list is always alphabetical.
3. No duplicates.
4. Flag names match `/^[a-zA-Z0-9]+$/` — no special characters.
5. The empty string `""` is valid and means no flags.

```ts
// 🟢 valid
""
"busy"
"blocked,busy"
"blocked,busy,error,idle"

// 🔴 invalid
"busy,blocked"     // wrong order
"busy, blocked"    // whitespace
"busy,busy"        // duplicate
"blocked,"         // trailing comma
"my-flag"          // disallowed character
```

**The library is self-fixing.** Flag strings leak into places humans can edit — config files, database rows, URL parameters. When something comes back out of order or with duplicates, the library normalizes it and emits a `console.warn` that cites the specific reason. The returned value is always in protocol form.

```ts
state.getFlags("busy,blocked");
// warn: input "busy,blocked" does not follow the protocol (not properly ordered);
//       normalized to "blocked,busy"
// returns ["blocked", "busy"]

state.getFlags("busy,busy");
// warn: input "busy,busy" does not follow the protocol (contains duplicates);
//       normalized to "busy"

state.getFlags("busy,busy,blocked");
// warn: input "busy,busy,blocked" does not follow the protocol
//       (not properly ordered and contains duplicates);
//       normalized to "blocked,busy"
```

**The library is strict where self-fixing would be unsafe.** If a schema-based operation receives a flag it does not know about, it has no safe move:

- Dropping the unknown flag silently would lose information — the caller meant it to be there.
- Keeping it would mean returning a `FlagsString<State>` that contains a non-`State` member. That is a lie to TypeScript, and it propagates undefined behaviour downstream.

So the library refuses to guess and throws. The same applies to invalid characters and non-string input.

```ts
state.getFlags("blocked,paused");
// throws: unknown flag "paused"

state.getFlags("blocked,my-flag");
// throws: flag "my-flag" contains disallowed characters.
```

## Strict mode

Non-strict mode (the default) is for places where flag strings may have been hand-edited outside of type-controlled code — a database row, a config file, a URL parameter. The library self-fixes and warns.

Strict mode is for places where you never hand-edit flags without type-control (i.e. an IDE with TypeScript). In that world, a protocol violation is always a bug, not a typo, and you want it to fail loudly.

Either way, truly ambiguous input (unknown flag names, invalid characters, wrong type) always throws — strict mode only changes how **recoverable** problems are surfaced.

| Situation                                    | Non-strict (default) | Strict  |
| -------------------------------------------- | -------------------- | ------- |
| Wrong order or duplicates (**recoverable**)  | warn + normalize     | throw   |
| Unknown flag name (**unrecoverable**)        | throw                | throw   |
| Invalid characters, non-string input         | throw                | throw   |

```ts
const loose  = defineStringFlags<State>(["idle", "busy", "error", "blocked"]);
const strict = defineStringFlags<State>(["idle", "busy", "error", "blocked"], { strict: true });

loose.getFlags("busy,blocked");
// warn: ... (not properly ordered); normalized to "blocked,busy"
// returns ["blocked", "busy"]

strict.getFlags("busy,blocked");
// throws the same message
```

### Assertions and type guards

```ts
state.isFlagsString(value);                            // type guard, always strict
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

### `defineStringFlags(input, options?)`

Creates a `StringFlags<U>` schema from either an array or a `Record<U, true>`.

```ts
defineStringFlags<State>(["idle", "busy", "error", "blocked"]);
defineStringFlags<State>({ idle: true, busy: true, error: true, blocked: true });
defineStringFlags<State>(["idle", "busy"], { strict: true });

defineStringFlags<State>(["idle", "idle"]);         // throws: duplicate flag "idle"
defineStringFlags<State>(["my-flag" as State]);     // throws: disallowed characters
```

### Schema methods

All methods on a `StringFlags<U>` instance.

#### `toFlagsString(input: readonly U[])`

Build a protocol-compliant string from an array.

```ts
state.toFlagsString(["busy", "blocked"]);        // "blocked,busy"
state.toFlagsString(["busy", "busy", "idle"]);   // "busy,idle" — deduped
state.toFlagsString([]);                         // ""
state.toFlagsString(["paused" as State]);        // throws: unknown flag "paused"
```

#### `getFlags(input: FlagsString<U>)`

Parse a flags string into an array. Normalizes in non-strict mode.

```ts
state.getFlags("blocked,busy");       // ["blocked", "busy"]
state.getFlags("");                   // []

state.getFlags("busy,blocked");
// non-strict: warns (not properly ordered), returns ["blocked", "busy"]
// strict:     throws

state.getFlags("blocked,paused");     // throws: unknown flag
```

#### `hasFlag(input, flag)`

```ts
state.hasFlag("blocked,busy", "busy");    // true
state.hasFlag("blocked,busy", "idle");    // false
state.hasFlag("blocked", "paused");       // TS error: "paused" is not in State
state.hasFlag("busy,blocked", "busy");    // non-strict: warns + returns true
```

#### `hasAllFlags(input, required)` / `hasAnyFlag(input, candidates)`

```ts
state.hasAllFlags("blocked,busy,idle", ["busy", "idle"]);   // true
state.hasAllFlags("blocked,busy", ["busy", "idle"]);        // false

state.hasAnyFlag("blocked", ["idle", "blocked"]);           // true
state.hasAnyFlag("blocked", ["idle", "busy"]);              // false
```

#### `addFlag(input, flag)`

```ts
state.addFlag("", "idle");              // "idle"
state.addFlag("blocked", "busy");       // "blocked,busy"
state.addFlag("blocked,busy", "busy");  // "blocked,busy" — idempotent
state.addFlag("", "paused");            // TS error: "paused" is not in State
```

#### `removeFlag(input, flag)`

```ts
state.removeFlag("blocked,busy", "blocked");  // "busy"
state.removeFlag("blocked", "busy");          // "blocked" — no-op
state.removeFlag("idle", "idle");             // "" — back to empty
```

#### `toggleFlag(input, flag)`

```ts
state.toggleFlag("", "idle");             // "idle"
state.toggleFlag("idle", "idle");         // ""
state.toggleFlag("blocked", "busy");      // "blocked,busy"
state.toggleFlag("blocked,busy", "busy"); // "blocked"
```

#### `isFlag(value)` / `isFlagsString(value)`

Type guards. Both are strict predicates — they answer "is this exactly a valid value?" without normalizing.

```ts
state.isFlag("busy");                // true
state.isFlag("paused");              // false

state.isFlagsString("blocked,busy"); // true
state.isFlagsString("busy,blocked"); // false — wrong order
state.isFlagsString("busy,busy");    // false — duplicate
state.isFlagsString("paused");       // false — unknown flag
```

#### `assertFlag(value, err)` / `assertFlagsString(value, err)`

```ts
state.assertFlag("busy", "bad");                 // returns "busy"
state.assertFlag("paused", "bad");               // throws "bad"

state.assertFlagsString("blocked,busy", "bad");  // passes (and narrows the type)
state.assertFlagsString("busy,blocked", "bad");  // throws "bad" — always strict
state.assertFlagsString("unknown", "bad");       // throws "bad"
```

### Standalone helpers

Same semantics as the schema methods, but with no registered list — unknown flag detection is delegated to TypeScript. All accept an optional `{ strict?: boolean }` second argument.

#### `toStringFlags(flags)`

```ts
toStringFlags<State>(["busy", "blocked"]);      // "blocked,busy"
toStringFlags<State>(["busy", "busy"]);         // "busy" — deduped
toStringFlags<State>([]);                       // ""
toStringFlags(["bad;"]);                        // throws: disallowed characters
```

#### `parseStringFlags(input, options?)`

```ts
parseStringFlags<State>("blocked,busy");        // ["blocked", "busy"]
parseStringFlags<State>("");                    // []

parseStringFlags<State>("busy,blocked");
// non-strict: warns (not properly ordered), returns ["blocked", "busy"]
// strict:     throws
```

#### `hasStringFlag(input, flag, options?)`

```ts
hasStringFlag<State>("blocked,busy", "busy");   // true
hasStringFlag<State>("blocked,busy", "idle");   // false
hasStringFlag<State>("busy,blocked", "busy");   // non-strict: warns + true
```

#### `addStringFlag(input, flag, options?)`

```ts
addStringFlag<State>("", "idle");                // "idle"
addStringFlag<State>("blocked", "busy");         // "blocked,busy"
addStringFlag<State>("blocked,busy", "busy");    // "blocked,busy"
```

#### `removeStringFlag(input, flag, options?)`

```ts
removeStringFlag<State>("blocked,busy", "blocked"); // "busy"
removeStringFlag<State>("blocked", "busy");         // "blocked" — no-op
```

#### `toggleStringFlag(input, flag, options?)`

```ts
toggleStringFlag<State>("", "idle");               // "idle"
toggleStringFlag<State>("idle", "idle");           // ""
toggleStringFlag<State>("idle,busy", "idle");      // non-strict: warns + "busy"
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
