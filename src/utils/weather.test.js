import { describe, it, expect } from "vitest";
import {
  convertTemp,
  convertWind,
  formatDay,
  formatTime,
  pickMiddayForecasts,
  tempUnitLabel,
  windUnitLabel,
} from "./weather";

const NOON_UTC_2026_07_21 = 1784635200;
const HOUR = 3600;

describe("unit conversion", () => {
  it("keeps metric values unchanged", () => {
    expect(convertTemp(20, "metric")).toBe(20);
    expect(convertWind(5, "metric")).toBe(5);
  });

  it("converts to imperial", () => {
    expect(convertTemp(0, "imperial")).toBe(32);
    expect(convertTemp(100, "imperial")).toBe(212);
    expect(convertWind(10, "imperial")).toBeCloseTo(22.3694);
  });

  it("returns null for missing values instead of NaN", () => {
    expect(convertTemp(undefined, "imperial")).toBeNull();
    expect(convertWind(null, "imperial")).toBeNull();
  });

  it("labels units", () => {
    expect(tempUnitLabel("metric")).toBe("°C");
    expect(tempUnitLabel("imperial")).toBe("°F");
    expect(windUnitLabel("metric")).toBe("m/s");
    expect(windUnitLabel("imperial")).toBe("mph");
  });
});

describe("time formatting", () => {
  it("formats times in the city's local time", () => {
    expect(formatTime(NOON_UTC_2026_07_21, 0)).toBe("12:00");
    expect(formatTime(NOON_UTC_2026_07_21, 9 * HOUR)).toBe("21:00");
    expect(formatTime(NOON_UTC_2026_07_21, -5 * HOUR)).toBe("07:00");
  });

  it("returns null for a missing timestamp", () => {
    expect(formatTime(undefined, 0)).toBeNull();
  });

  it("formats the local day, which can differ from the UTC day", () => {
    expect(formatDay(NOON_UTC_2026_07_21, 0)).toBe("Tue 21/07");
    expect(formatDay(NOON_UTC_2026_07_21, 14 * HOUR)).toBe("Wed 22/07");
  });
});

describe("pickMiddayForecasts", () => {
  const threeHourly = (start, count) =>
    Array.from({ length: count }, (_, i) => ({ dt: start + i * 3 * HOUR }));

  it("picks one entry per day, the one at local noon", () => {
    const list = threeHourly(NOON_UTC_2026_07_21 - 12 * HOUR, 16); // two full UTC days
    const picked = pickMiddayForecasts(list, 0);
    expect(picked.map((item) => item.dt)).toEqual([
      NOON_UTC_2026_07_21,
      NOON_UTC_2026_07_21 + 24 * HOUR,
    ]);
  });

  it("uses the city's offset to decide what local noon is", () => {
    const list = threeHourly(NOON_UTC_2026_07_21 - 12 * HOUR, 8);
    const [picked] = pickMiddayForecasts(list, 9 * HOUR);
    expect(picked.dt).toBe(NOON_UTC_2026_07_21 - 9 * HOUR); // 03:00 UTC = 12:00 in UTC+9
  });

  it("skips a partial day whose noon has already passed", () => {
    const list = threeHourly(NOON_UTC_2026_07_21 + 6 * HOUR, 4); // 18:00 → 03:00 next day
    expect(pickMiddayForecasts(list, 0)).toEqual([]);
  });
});
