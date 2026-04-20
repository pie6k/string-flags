// Type-level assertions. These are checked at compile time by ts-jest.
// The describe/it exists so Jest has something to run.

import type { FlagsString } from "../src";

type State = "idle" | "busy" | "error" | "blocked";
type StateFlags = FlagsString<State>;

const empty: StateFlags = "";
const single: StateFlags = "blocked";
const pair: StateFlags = "blocked,busy";
const triple: StateFlags = "blocked,busy,error";
const full: StateFlags = "blocked,busy,error,idle";

// @ts-expect-error — wrong order (protocol violation)
const _nonCanonical: StateFlags = "busy,blocked";
// @ts-expect-error — duplicate flag
const _duplicate: StateFlags = "blocked,blocked";
// @ts-expect-error — unknown flag
const _unknown: StateFlags = "unknown";
// @ts-expect-error — trailing comma
const _trailingComma: StateFlags = "blocked,";

// Reference the values so unused-locals rules do not complain.
void empty;
void single;
void pair;
void triple;
void full;
void _nonCanonical;
void _duplicate;
void _unknown;
void _trailingComma;

describe("FlagsString type", () => {
  it("compiles", () => {
    expect(true).toBe(true);
  });
});
