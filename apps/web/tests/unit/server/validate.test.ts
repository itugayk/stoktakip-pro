import { describe, it, expect } from "vitest";
import { parseInput, z } from "@/lib/server/validate";
import { AppError } from "@/lib/server/errors";

const schema = z.object({
  name: z.string().min(1, "Ad boş olamaz"),
  age: z.number().min(0),
});

describe("parseInput", () => {
  it("returns parsed value when input is valid", () => {
    expect(parseInput(schema, { name: "Ali", age: 30 })).toEqual({ name: "Ali", age: 30 });
  });

  it("throws AppError(code=validation) on schema violation", () => {
    try {
      parseInput(schema, { name: "", age: 30 });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const err = e as AppError;
      expect(err.code).toBe("validation");
      expect(err.field).toBe("name");
    }
  });

  it("surfaces nested path as field (dot-joined)", () => {
    const nested = z.object({ user: z.object({ email: z.string().email() }) });
    try {
      parseInput(nested, { user: { email: "not-email" } });
    } catch (e) {
      expect((e as AppError).field).toBe("user.email");
    }
  });
});
