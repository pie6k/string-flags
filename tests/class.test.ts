import { defineStringFlags, FlagsString, StringFlags } from "../src";

type State = "idle" | "busy" | "error" | "blocked";

function makeSchema(strict = false): StringFlags<State> {
  return defineStringFlags<State>(
    { idle: true, busy: true, error: true, blocked: true },
    { strict },
  );
}

describe("StringFlags (non-strict, protocol-compliant input)", () => {
  const schema = makeSchema();
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("hasFlag returns true for a present flag", () => {
    expect(schema.hasFlag("blocked,busy", "blocked")).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("hasFlag returns false for an absent flag", () => {
    expect(schema.hasFlag("blocked,busy", "idle")).toBe(false);
  });

  it("getFlags returns the parsed array", () => {
    expect(schema.getFlags("blocked,busy")).toEqual(["blocked", "busy"]);
  });

  it("toFlagsString sorts an unsorted array without warning", () => {
    expect(schema.toFlagsString(["idle", "busy"])).toBe("busy,idle");
    expect(warn).not.toHaveBeenCalled();
  });

  it("toFlagsString dedupes an array without warning", () => {
    expect(schema.toFlagsString(["busy", "busy", "idle"])).toBe("busy,idle");
  });

  it("hasAllFlags works", () => {
    expect(schema.hasAllFlags("blocked,busy,idle", ["busy", "idle"])).toBe(true);
    expect(schema.hasAllFlags("blocked,busy", ["busy", "idle"])).toBe(false);
  });

  it("hasAnyFlag works", () => {
    expect(schema.hasAnyFlag("blocked", ["idle", "blocked"])).toBe(true);
    expect(schema.hasAnyFlag("blocked", ["idle", "busy"])).toBe(false);
  });

  it("addFlag adds a missing flag", () => {
    expect(schema.addFlag("blocked", "busy")).toBe("blocked,busy");
  });

  it("addFlag is idempotent", () => {
    expect(schema.addFlag("blocked,busy", "busy")).toBe("blocked,busy");
  });

  it("removeFlag removes a present flag", () => {
    expect(schema.removeFlag("blocked,busy", "blocked")).toBe("busy");
  });

  it("removeFlag on an absent flag is a no-op", () => {
    expect(schema.removeFlag("blocked", "busy")).toBe("blocked");
  });

  it("toggleFlag toggles on and off", () => {
    expect(schema.toggleFlag("", "idle")).toBe("idle");
    expect(schema.toggleFlag("idle", "idle")).toBe("");
  });

  it("empty string represents no flags", () => {
    expect(schema.getFlags("")).toEqual([]);
    expect(schema.hasFlag("", "idle")).toBe(false);
    expect(schema.toFlagsString([])).toBe("");
    expect(schema.removeFlag("idle", "idle")).toBe("");
  });
});

describe("StringFlags (non-strict, protocol-violating input)", () => {
  const schema = makeSchema();
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("hasFlag warns and recovers on swapped order", () => {
    expect(schema.hasFlag("busy,blocked" as FlagsString<State>, "blocked")).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/does not follow the protocol/);
  });

  it("getFlags normalizes swapped order", () => {
    expect(schema.getFlags("busy,blocked" as FlagsString<State>)).toEqual([
      "blocked",
      "busy",
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("getFlags dedupes repeated flags", () => {
    expect(schema.getFlags("busy,busy,blocked" as FlagsString<State>)).toEqual([
      "blocked",
      "busy",
    ]);
    expect(warn).toHaveBeenCalled();
  });

  it("addFlag normalizes then adds", () => {
    expect(schema.addFlag("busy,blocked" as FlagsString<State>, "idle")).toBe(
      "blocked,busy,idle",
    );
    expect(warn).toHaveBeenCalled();
  });

  it("toggleFlag normalizes before toggling", () => {
    expect(
      schema.toggleFlag("busy,busy,blocked" as FlagsString<State>, "idle"),
    ).toBe("blocked,busy,idle");
    expect(warn).toHaveBeenCalled();
  });

  it("toggleFlag normalizes then removes an existing flag", () => {
    expect(schema.toggleFlag("idle,busy" as FlagsString<State>, "idle")).toBe("busy");
    expect(warn).toHaveBeenCalled();
  });

  it("warning cites wrong order when only order is off", () => {
    schema.getFlags("busy,blocked" as FlagsString<State>);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/\(not properly ordered\)/),
    );
  });

  it("warning cites duplicates when the only problem is duplicates", () => {
    schema.getFlags("busy,busy" as FlagsString<State>);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/\(contains duplicates\)/),
    );
  });

  it("warning cites both when order and duplicates are both off", () => {
    schema.getFlags("busy,busy,blocked" as FlagsString<State>);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/\(not properly ordered and contains duplicates\)/),
    );
  });
});

describe("StringFlags (unrecoverable input)", () => {
  const schema = makeSchema();

  it("throws on an unknown flag in the input string", () => {
    expect(() => schema.getFlags("blocked,baz" as FlagsString<State>)).toThrow(
      /unknown flag "baz"/,
    );
  });

  it("throws on an unknown flag via hasFlag", () => {
    expect(() =>
      schema.hasFlag("blocked,baz" as FlagsString<State>, "blocked"),
    ).toThrow(/unknown flag "baz"/);
  });

  it("throws on an unknown flag in mutations", () => {
    expect(() =>
      schema.toggleFlag("blocked,baz" as FlagsString<State>, "idle"),
    ).toThrow(/unknown flag "baz"/);
  });

  it("throws when asked to operate on a non-string", () => {
    expect(() =>
      schema.getFlags(123 as unknown as FlagsString<State>),
    ).toThrow(/expected a string/);
  });

  it("throws on an unknown single flag argument", () => {
    expect(() =>
      schema.hasFlag("blocked", "nope" as State),
    ).toThrow(/unknown flag "nope"/);
  });
});

describe("StringFlags (strict mode)", () => {
  const schema = makeSchema(true);
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("accepts protocol-compliant input", () => {
    expect(schema.hasFlag("blocked,busy", "blocked")).toBe(true);
  });

  it("throws on wrong order", () => {
    expect(() =>
      schema.hasFlag("busy,blocked" as FlagsString<State>, "blocked"),
    ).toThrow(/does not follow the protocol/);
  });

  it("throws on duplicates", () => {
    expect(() =>
      schema.getFlags("busy,busy,blocked" as FlagsString<State>),
    ).toThrow(/does not follow the protocol/);
  });

  it("throws from mutations", () => {
    expect(() =>
      schema.addFlag("busy,blocked" as FlagsString<State>, "idle"),
    ).toThrow(/does not follow the protocol/);
  });

  it("does not emit warnings when it throws", () => {
    try {
      schema.hasFlag("busy,blocked" as FlagsString<State>, "blocked");
    } catch {
      // expected
    }
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("isFlag / isFlagsString", () => {
  const schema = makeSchema();

  it("isFlag accepts a declared flag", () => {
    expect(schema.isFlag("idle")).toBe(true);
  });

  it("isFlag rejects other values", () => {
    expect(schema.isFlag("nope")).toBe(false);
    expect(schema.isFlag(42)).toBe(false);
    expect(schema.isFlag(null)).toBe(false);
  });

  it("isFlagsString accepts protocol-compliant values", () => {
    expect(schema.isFlagsString("")).toBe(true);
    expect(schema.isFlagsString("blocked")).toBe(true);
    expect(schema.isFlagsString("blocked,busy")).toBe(true);
    expect(schema.isFlagsString("blocked,busy,error,idle")).toBe(true);
  });

  it("isFlagsString rejects protocol-violating or invalid values", () => {
    expect(schema.isFlagsString("busy,blocked")).toBe(false);
    expect(schema.isFlagsString("blocked,blocked")).toBe(false);
    expect(schema.isFlagsString("blocked,unknown")).toBe(false);
    expect(schema.isFlagsString(42)).toBe(false);
  });
});

describe("assertFlagsString / assertFlag", () => {
  const schema = makeSchema();

  it("assertFlagsString passes through a protocol-compliant value", () => {
    const v: unknown = "blocked,busy";
    expect(() => schema.assertFlagsString(v, "bad")).not.toThrow();
  });

  it("assertFlagsString is strict regardless of the schema's strict mode", () => {
    expect(() =>
      schema.assertFlagsString("busy,blocked", "bad"),
    ).toThrow(/bad/);
  });

  it("assertFlagsString throws for unknown flags", () => {
    expect(() =>
      schema.assertFlagsString("blocked,xxx", "bad input"),
    ).toThrow(/bad input/);
  });

  it("assertFlagsString forwards custom Error subclasses", () => {
    class BadRequestError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = "BadRequestError";
      }
    }
    expect(() =>
      schema.assertFlagsString("busy,blocked", new BadRequestError("custom")),
    ).toThrow(BadRequestError);
  });

  it("assertFlag returns the narrowed flag on success", () => {
    expect(schema.assertFlag("idle", "bad")).toBe("idle");
  });

  it("assertFlag throws for an unknown value", () => {
    expect(() => schema.assertFlag("nope", "bad")).toThrow(/bad/);
  });
});

describe("realistic usage", () => {
  it("toggling flags on a wrapper object keeps the string in protocol form", () => {
    const schema = makeSchema();

    class Item {
      flags: FlagsString<State> = "";
      constructor(private schema: StringFlags<State>) {}
      toggle(flag: State) {
        this.flags = this.schema.toggleFlag(this.flags, flag);
      }
      has(flag: State) {
        return this.schema.hasFlag(this.flags, flag);
      }
    }

    const item = new Item(schema);
    item.toggle("idle");
    item.toggle("busy");
    expect(item.flags).toBe("busy,idle");
    expect(item.has("idle")).toBe(true);

    item.toggle("idle");
    expect(item.flags).toBe("busy");
  });
});
