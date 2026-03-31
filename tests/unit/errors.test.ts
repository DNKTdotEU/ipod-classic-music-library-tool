import { describe, expect, it } from "vitest";
import { AppRuntimeError, ok, fail, mapError } from "../../electron/core/errors";

describe("ok", () => {
  it("wraps data in an ok envelope", () => {
    const result = ok({ count: 42 });
    expect(result).toEqual({ ok: true, data: { count: 42 } });
  });

  it("works with primitive values", () => {
    expect(ok("hello")).toEqual({ ok: true, data: "hello" });
    expect(ok(null)).toEqual({ ok: true, data: null });
  });
});

describe("fail", () => {
  it("produces a fail envelope with defaults", () => {
    const result = fail("bad input");
    expect(result).toEqual({
      ok: false,
      error: { code: "BAD_REQUEST", message: "bad input", details: undefined }
    });
  });

  it("accepts custom code and details", () => {
    const result = fail("not found", "NOT_FOUND", "/some/path");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.details).toBe("/some/path");
    }
  });
});

describe("AppRuntimeError", () => {
  it("is an instance of Error", () => {
    const err = new AppRuntimeError("MY_CODE", "something broke");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("something broke");
    expect(err.code).toBe("MY_CODE");
  });

  it("stores optional details", () => {
    const err = new AppRuntimeError("DB_ERROR", "query failed", "SELECT * FROM foo");
    expect(err.details).toBe("SELECT * FROM foo");
  });
});

describe("mapError", () => {
  it("maps AppRuntimeError to a fail envelope preserving code and details", () => {
    const err = new AppRuntimeError("SCAN_FAIL", "disk full", "/dev/sda1");
    const result = mapError(err);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCAN_FAIL");
      expect(result.error.message).toBe("disk full");
      expect(result.error.details).toBe("/dev/sda1");
    }
  });

  it("maps a plain Error to INTERNAL_ERROR", () => {
    const result = mapError(new Error("oops"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toBe("oops");
    }
  });

  it("maps an unknown value to INTERNAL_ERROR with generic message", () => {
    const result = mapError("just a string");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toBe("Unknown error");
    }
  });

  it("maps null/undefined to INTERNAL_ERROR", () => {
    expect(mapError(null).ok).toBe(false);
    expect(mapError(undefined).ok).toBe(false);
  });
});
