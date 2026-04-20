import {
  addStringFlag,
  FlagsString,
  hasStringFlag,
  parseStringFlags,
  removeStringFlag,
  toggleStringFlag,
  toStringFlags,
} from "../src";

type State = "idle" | "busy" | "error" | "blocked";

describe("standalone helpers (protocol-compliant input)", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("toStringFlags sorts and dedupes an array", () => {
    expect(toStringFlags<State>(["busy", "blocked"])).toBe("blocked,busy");
    expect(toStringFlags<State>(["busy", "busy"])).toBe("busy");
    expect(toStringFlags<State>([])).toBe("");
  });

  it("parseStringFlags returns the parsed array", () => {
    expect(parseStringFlags<State>("blocked,busy")).toEqual(["blocked", "busy"]);
    expect(parseStringFlags<State>("")).toEqual([]);
  });

  it("has/add/remove/toggle match the class behaviour", () => {
    expect(hasStringFlag<State>("blocked,busy", "blocked")).toBe(true);
    expect(hasStringFlag<State>("blocked,busy", "idle")).toBe(false);
    expect(addStringFlag<State>("blocked", "busy")).toBe("blocked,busy");
    expect(removeStringFlag<State>("blocked,busy", "blocked")).toBe("busy");
    expect(toggleStringFlag<State>("blocked", "busy")).toBe("blocked,busy");
    expect(toggleStringFlag<State>("blocked,busy", "blocked")).toBe("busy");
    expect(toggleStringFlag<State>("", "idle")).toBe("idle");
  });

  it("does not warn on protocol-compliant input", () => {
    addStringFlag<State>("blocked", "busy");
    toggleStringFlag<State>("blocked,busy", "idle");
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("standalone helpers (protocol-violating input)", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("warns and normalizes on swapped order", () => {
    expect(
      toggleStringFlag<State>("busy,blocked" as FlagsString<State>, "idle"),
    ).toBe("blocked,busy,idle");
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/does not follow the protocol/));
  });

  it("warns and normalizes on the idle,busy case", () => {
    expect(
      toggleStringFlag<State>("idle,busy" as FlagsString<State>, "idle"),
    ).toBe("busy");
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/does not follow the protocol/));
  });

  it("dedupes and sorts in add", () => {
    expect(
      addStringFlag("foo,foo,bar" as FlagsString<string>, "baz"),
    ).toBe("bar,baz,foo");
    expect(warn).toHaveBeenCalled();
  });

  it("parseStringFlags normalizes with a warning", () => {
    expect(
      parseStringFlags<State>("busy,blocked" as FlagsString<State>),
    ).toEqual(["blocked", "busy"]);
    expect(warn).toHaveBeenCalled();
  });
});

describe("standalone helpers (strict mode)", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("throws on wrong alphabetical order", () => {
    expect(() =>
      toggleStringFlag<State>(
        "busy,blocked" as FlagsString<State>,
        "idle",
        { strict: true },
      ),
    ).toThrow(/does not follow the protocol/);
  });

  it("throws on duplicates", () => {
    expect(() =>
      addStringFlag("foo,foo" as FlagsString<string>, "bar", { strict: true }),
    ).toThrow(/does not follow the protocol/);
  });

  it("does not warn when throwing", () => {
    try {
      toggleStringFlag<State>(
        "busy,blocked" as FlagsString<State>,
        "idle",
        { strict: true },
      );
    } catch {
      // expected
    }
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("standalone helpers (invalid input)", () => {
  it("throws on disallowed characters in the input string", () => {
    expect(() =>
      toggleStringFlag("foo,bar,baz;" as FlagsString<string>, "idle"),
    ).toThrow(/disallowed characters/);
  });

  it("throws on disallowed characters in the flag argument", () => {
    expect(() =>
      toggleStringFlag("foo" as FlagsString<string>, "bad;"),
    ).toThrow(/disallowed characters/);
  });

  it("throws on a non-string input", () => {
    expect(() =>
      toggleStringFlag(42 as unknown as FlagsString<string>, "foo"),
    ).toThrow(/expected a string/);
  });

  it("toStringFlags rejects a non-array input", () => {
    expect(() =>
      toStringFlags("blocked" as unknown as string[]),
    ).toThrow(/expected an array/);
  });

  it("toStringFlags rejects invalid flag names in the array", () => {
    expect(() => toStringFlags(["ok", "bad;"])).toThrow(/disallowed characters/);
  });
});
