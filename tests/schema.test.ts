import { StringFlags, defineStringFlags } from "../src";

describe("schema validation", () => {
  it("rejects disallowed characters in a flag name", () => {
    expect(() => new StringFlags(["foo;"])).toThrow(/disallowed characters/);
  });

  it("rejects non-ASCII flag names", () => {
    expect(() => new StringFlags(["café"])).toThrow(/disallowed characters/);
  });

  it("rejects an empty member list", () => {
    expect(() => new StringFlags([])).toThrow(/at least one flag required/);
  });

  it("rejects duplicates in the member list", () => {
    expect(() => new StringFlags(["a", "a"])).toThrow(/duplicate flag "a"/);
  });

  it("rejects names over the length limit", () => {
    expect(() => new StringFlags(["a".repeat(65)])).toThrow(/exceeds max length/);
  });

  it("rejects more than 10 flags", () => {
    const many = Array.from({ length: 11 }, (_, i) => `f${i}`);
    expect(() => new StringFlags(many)).toThrow(/at most 10 flags/);
  });

  it("accepts a valid member list", () => {
    expect(() => new StringFlags(["a", "b", "c"])).not.toThrow();
  });

  it("defineStringFlags accepts an array", () => {
    const s = defineStringFlags(["busy", "idle"] as const);
    expect(s.flags).toEqual(["busy", "idle"]);
  });

  it("defineStringFlags accepts a Record<U, true>", () => {
    const s = defineStringFlags({ busy: true, idle: true });
    expect(new Set(s.flags)).toEqual(new Set(["busy", "idle"]));
  });

  it("defineStringFlags rejects a record whose value is not literal true", () => {
    expect(() =>
      defineStringFlags({ busy: true, idle: false as unknown as true }),
    ).toThrow(/must map to literal `true`/);
  });

  it("sorts declared members alphabetically", () => {
    const s = new StringFlags(["c", "a", "b"]);
    expect(s.flags).toEqual(["a", "b", "c"]);
  });

  it("freezes the flags array", () => {
    const s = new StringFlags(["a", "b"]);
    expect(Object.isFrozen(s.flags)).toBe(true);
  });

  it("toString returns a readable label", () => {
    const s = new StringFlags(["a", "b"]);
    expect(s.toString()).toBe("StringFlags(a, b)");
  });
});
