import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readSetting, saveSetting } from "./storage";

const blocked = () => {
  throw new DOMException("The operation is insecure.", "SecurityError");
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readSetting", () => {
  it("returns the stored value", () => {
    localStorage.setItem("unit", "imperial");
    expect(readSetting("unit", "metric")).toBe("imperial");
  });

  it("returns the fallback when nothing is stored", () => {
    expect(readSetting("unit", "metric")).toBe("metric");
  });

  it("keeps an empty stored string instead of replacing it with the fallback", () => {
    localStorage.setItem("lastCity", "");
    expect(readSetting("lastCity", "Helsinki")).toBe("");
  });

  it("returns the fallback when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    expect(readSetting("unit", "metric")).toBe("metric");
  });
});

describe("saveSetting", () => {
  it("stores the value as a string", () => {
    saveSetting("darkMode", true);
    expect(localStorage.getItem("darkMode")).toBe("true");
  });

  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    expect(() => saveSetting("darkMode", true)).not.toThrow();
  });
});
