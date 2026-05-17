import { describe, it, expect } from "vitest";
import { ok, fail, toLegacy } from "@/lib/server/result";

describe("Result helpers", () => {
  it("ok() with no data narrows correctly", () => {
    const r = ok();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBeUndefined();
  });

  it("ok(data) carries data", () => {
    const r = ok({ id: "x" });
    if (r.ok) expect(r.data.id).toBe("x");
  });

  it("fail() carries code/message/field", () => {
    const r = fail("validation", "boş olamaz", "name");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("validation");
      expect(r.error.message).toBe("boş olamaz");
      expect(r.error.field).toBe("name");
    }
  });

  it("toLegacy bridges success", () => {
    expect(toLegacy(ok({ x: 1 }))).toEqual({ success: true });
  });

  it("toLegacy bridges failure with message string", () => {
    expect(toLegacy(fail("x", "bad"))).toEqual({ success: false, error: "bad" });
  });
});
