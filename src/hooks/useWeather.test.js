import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWeather } from "./useWeather";

const weather = (name) => ({
  name,
  timezone: 0,
  main: { temp: 10, feels_like: 9, humidity: 50 },
  wind: { speed: 2 },
  weather: [{ icon: "01d", description: "clear sky" }],
  sys: { sunrise: 1784606400, sunset: 1784664000 },
});

const forecast = {
  city: { timezone: 0 },
  list: [{ dt: 1784635200, main: { temp: 11, humidity: 60 }, wind: { speed: 3 }, weather: [{ icon: "01d", description: "clear sky" }] }],
};

const nameFrom = (url) => decodeURIComponent(url.match(/q=([^&]+)/)?.[1] ?? "Located place");

const okResponse = (url) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(url.includes("/forecast") ? forecast : weather(nameFrom(url))),
});

const mockFetchOk = () => vi.fn((url) => Promise.resolve(okResponse(url)));

// Requests stay pending until respondFor(city) is called, and reject like real fetch when aborted.
function mockFetchControlled() {
  const pending = [];
  const fetchMock = vi.fn(
    (url, { signal } = {}) =>
      new Promise((resolve, reject) => {
        pending.push({ url, resolve });
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
  );
  const respondFor = (city) => {
    for (const { url, resolve } of pending.filter((p) => p.url.includes(`q=${city}`))) {
      resolve(okResponse(url));
    }
  };
  return { fetchMock, respondFor };
}

beforeEach(() => {
  vi.stubEnv("VITE_WEATHER_API_KEY", "test-api-key");
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useWeather", () => {
  it("starts empty when no city has been saved", () => {
    globalThis.fetch = mockFetchOk();
    const { result } = renderHook(() => useWeather());

    expect(result.current).toMatchObject({ current: null, forecast: [], loading: false, error: "" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  describe("searchCity", () => {
    it("loads the weather, returns it, and remembers the trimmed city", async () => {
      globalThis.fetch = mockFetchOk();
      const { result } = renderHook(() => useWeather());

      let data;
      await act(async () => {
        data = await result.current.searchCity("  Helsinki  ");
      });

      expect(data.name).toBe("Helsinki");
      expect(result.current.current.name).toBe("Helsinki");
      expect(result.current.forecast).toHaveLength(1);
      expect(result.current.loading).toBe(false);
      expect(localStorage.getItem("lastCity")).toBe("Helsinki");
    });

    it("ignores a blank city", async () => {
      globalThis.fetch = mockFetchOk();
      const { result } = renderHook(() => useWeather());

      let data;
      await act(async () => {
        data = await result.current.searchCity("   ");
      });

      expect(data).toBeNull();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("reports a weather service error, returns null, and remembers nothing", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ message: "city not found" }) })
      );
      const { result } = renderHook(() => useWeather());

      let data;
      await act(async () => {
        data = await result.current.searchCity("Asdfqwerty");
      });

      expect(data).toBeNull();
      expect(result.current.error).toBe("No place with that name was found. Check the spelling and try again.");
      expect(result.current.current).toBeNull();
      expect(localStorage.getItem("lastCity")).toBeNull();
    });

    it("lets a newer search cancel one that is still loading", async () => {
      const { fetchMock, respondFor } = mockFetchControlled();
      globalThis.fetch = fetchMock;
      const { result } = renderHook(() => useWeather());

      let oslo, rome;
      await act(async () => {
        const osloSearch = result.current.searchCity("Oslo");
        const romeSearch = result.current.searchCity("Rome");
        respondFor("Rome");
        respondFor("Oslo");
        [oslo, rome] = await Promise.all([osloSearch, romeSearch]);
      });

      expect(oslo).toBeNull();
      expect(rome.name).toBe("Rome");
      expect(result.current.current.name).toBe("Rome");
      expect(result.current.error).toBe("");
      expect(localStorage.getItem("lastCity")).toBe("Rome");
    });
  });

  describe("searchLocation", () => {
    it("loads the weather for the browser's position and returns it, without remembering it", async () => {
      globalThis.fetch = mockFetchOk();
      vi.stubGlobal("navigator", {
        ...navigator,
        geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 35.6762, longitude: 139.6503 } }) },
      });
      const { result } = renderHook(() => useWeather());

      let data;
      await act(async () => {
        data = await result.current.searchLocation();
      });

      expect(data.name).toBe("Located place");
      expect(globalThis.fetch.mock.calls[0][0]).toContain("lat=35.6762&lon=139.6503");
      expect(localStorage.getItem("lastCity")).toBeNull();
    });

    it("returns null and explains when geolocation is not supported", async () => {
      globalThis.fetch = mockFetchOk();
      vi.stubGlobal("navigator", { ...navigator, geolocation: undefined });
      const { result } = renderHook(() => useWeather());

      let data;
      await act(async () => {
        data = await result.current.searchLocation();
      });

      expect(data).toBeNull();
      expect(result.current.error).toBe("Geolocation not supported");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("is cancelled by a city search started while waiting for the position", async () => {
      let deliverPosition;
      globalThis.fetch = mockFetchOk();
      vi.stubGlobal("navigator", {
        ...navigator,
        geolocation: { getCurrentPosition: (ok) => { deliverPosition = ok; } },
      });
      const { result } = renderHook(() => useWeather());

      let located;
      await act(async () => {
        const locationSearch = result.current.searchLocation();
        await result.current.searchCity("Turku");
        deliverPosition({ coords: { latitude: 60.17, longitude: 24.94 } });
        located = await locationSearch;
      });

      expect(located).toBeNull();
      expect(result.current.current.name).toBe("Turku");
      expect(globalThis.fetch.mock.calls.some(([url]) => url.includes("lat="))).toBe(false);
    });
  });

  it("restores the last saved city when it starts", async () => {
    localStorage.setItem("lastCity", "Turku");
    globalThis.fetch = mockFetchOk();
    const { result } = renderHook(() => useWeather());

    await waitFor(() => expect(result.current.current?.name).toBe("Turku"));
    expect(globalThis.fetch.mock.calls[0][0]).toContain("q=Turku");
  });
});
