import { resolveErrorInput } from "../src";

describe("resolveErrorInput", () => {
  it("returns the same instance when given an Error", () => {
    const err = new Error("x");
    expect(resolveErrorInput(err)).toBe(err);
  });

  it("preserves Error subclasses", () => {
    class Bad extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = "Bad";
      }
    }
    const err = new Bad("x");
    const resolved = resolveErrorInput(err);
    expect(resolved).toBe(err);
    expect(resolved).toBeInstanceOf(Bad);
  });

  it("wraps a string in an Error", () => {
    const resolved = resolveErrorInput("hello");
    expect(resolved).toBeInstanceOf(Error);
    expect(resolved.message).toBe("hello");
  });
});
