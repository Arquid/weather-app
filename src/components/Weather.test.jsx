import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Weather from "./Weather";

const weatherData = {
  name: "Helsinki",
  timezone: 0,
  main: { temp: 15.567, feels_like: 13.2, humidity: 72 },
  wind: { speed: 4.321 },
  weather: [{ icon: "01d", description: "clear sky" }],
  sys: { sunrise: 1753070400, sunset: 1753124400 },
};

// 12:00 UTC on 2026-07-21 … 2026-07-25
const forecastData = {
  city: { timezone: 0 },
  list: [
    { dt: 1784635200, main: { temp: 16.7, humidity: 60 }, wind: { speed: 3.1 }, weather: [{ icon: "01d", description: "clear sky" }] },
    { dt: 1784721600, main: { temp: 17.2, humidity: 65 }, wind: { speed: 2.4 }, weather: [{ icon: "02d", description: "few clouds" }] },
    { dt: 1784808000, main: { temp: 18.9, humidity: 70 }, wind: { speed: 1.9 }, weather: [{ icon: "03d", description: "scattered clouds" }] },
    { dt: 1784894400, main: { temp: 14.1, humidity: 88 }, wind: { speed: 5.6 }, weather: [{ icon: "10d", description: "light rain" }] },
    { dt: 1784980800, main: { temp: 19.3, humidity: 55 }, wind: { speed: 2.2 }, weather: [{ icon: "01d", description: "clear sky" }] },
  ],
};

const TOKYO_OFFSET = 9 * 3600;

const tokyoWeatherData = {
  ...weatherData,
  name: "Tokyo",
  timezone: TOKYO_OFFSET,
  sys: { sunrise: 1784575800, sunset: 1784627700 }, // 19:30 UTC and 09:55 UTC
};

// 03:00 UTC is local noon in Tokyo; 12:00 UTC is 21:00 local and must not be picked.
const tokyoForecastData = {
  city: { timezone: TOKYO_OFFSET },
  list: [
    { dt: 1784635200 - 9 * 3600, main: { temp: 25.0, humidity: 60 }, wind: { speed: 3.1 }, weather: [{ icon: "01d", description: "clear sky" }] },
    { dt: 1784635200, main: { temp: 10.0, humidity: 90 }, wind: { speed: 1.0 }, weather: [{ icon: "01n", description: "clear sky" }] },
  ],
};

function mockFetchSuccess(current = weatherData, forecast = forecastData) {
  return vi.fn((url) => {
    const body = url.includes("/forecast") ? forecast : current;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    });
  });
}

function mockFetchError(status, message) {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ cod: String(status), message }),
    })
  );
}

const mockFetchNotFound = () => mockFetchError(404, "city not found");

const NOT_FOUND_MESSAGE = "No place with that name was found. Check the spelling and try again.";

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
      const body = url.includes("/forecast") ? forecastData : { ...weatherData, name: city };
      resolve({ ok: true, json: () => Promise.resolve(body) });
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

describe("Weather", () => {
  it("renders the search input and buttons", () => {
    render(<Weather />);
    expect(screen.getByPlaceholderText("Enter city")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use my location" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });

  describe("accessibility", () => {
    it("puts the app in a main landmark", () => {
      render(<Weather />);
      expect(screen.getByRole("main")).toBeInTheDocument();
    });

    it("names the unit button by what it does", async () => {
      const user = userEvent.setup();
      render(<Weather />);

      const toFahrenheit = screen.getByRole("button", { name: "Show temperatures in Fahrenheit" });
      expect(toFahrenheit).toHaveTextContent("°F");

      await user.click(toFahrenheit);

      expect(screen.getByRole("button", { name: "Show temperatures in Celsius" })).toHaveTextContent("°C");
    });

    it("names the location button by what it does, keeping the emoji as visible text only", () => {
      render(<Weather />);
      expect(screen.getByRole("button", { name: "Use my location" })).toHaveTextContent("📍 Own location");
    });

    it("names the theme button by what it does, keeping the emoji as visible text only", async () => {
      const user = userEvent.setup();
      render(<Weather />);

      const toDark = screen.getByRole("button", { name: "Switch to dark mode" });
      expect(toDark).toHaveTextContent("🌙 Dark");

      await user.click(toDark);

      expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveTextContent("☀️ Light");
    });

    // Screen readers announce changes inside a live region only if the region was already
    // in the page, so the same element must persist from before the request until after it.
    it("announces loading through a status region that is always present", async () => {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const respond = mockFetchSuccess();
      globalThis.fetch = vi.fn((url) => gate.then(() => respond(url)));
      const user = userEvent.setup();
      render(<Weather />);

      const status = screen.getByRole("status");
      expect(status).toBeEmptyDOMElement();

      await user.type(screen.getByLabelText("City"), "Helsinki");
      await user.click(screen.getByRole("button", { name: "Search" }));
      expect(status).toHaveTextContent("Loading...");

      release();
      await screen.findByRole("heading", { name: "Helsinki" });
      expect(status).toBeEmptyDOMElement();
    });

    it("announces errors through an alert region that is always present", async () => {
      globalThis.fetch = mockFetchNotFound();
      const user = userEvent.setup();
      render(<Weather />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeEmptyDOMElement();

      await user.type(screen.getByLabelText("City"), "Asdfqwerty");
      await user.click(screen.getByRole("button", { name: "Search" }));

      await waitFor(() => expect(alert).toHaveTextContent(NOT_FOUND_MESSAGE));
    });
  });

  it("fetches and displays weather and forecast on search", async () => {
    globalThis.fetch = mockFetchSuccess();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByPlaceholderText("Enter city"), "Helsinki");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Helsinki")).toBeInTheDocument();
    expect(screen.getByText("15.6 °C")).toBeInTheDocument();
    expect(screen.getByText("Wind: 4.3 m/s")).toBeInTheDocument();
    expect(screen.getAllByText(/°C/)).toHaveLength(7); // current temp + feels like + 5 forecast days
  });

  it("shows feels-like temperature, humidity, sunrise and sunset for the current weather", async () => {
    globalThis.fetch = mockFetchSuccess();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByPlaceholderText("Enter city"), "Helsinki");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("Helsinki");
    expect(screen.getByText("Feels like: 13.2 °C")).toBeInTheDocument();
    expect(screen.getByText("Humidity: 72%")).toBeInTheDocument();
    expect(screen.getByText(/Sunrise: .* · Sunset: .*/)).toBeInTheDocument();
  });

  it("shows sunrise and sunset in the searched city's local time", async () => {
    globalThis.fetch = mockFetchSuccess(tokyoWeatherData, tokyoForecastData);
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByLabelText("City"), "Tokyo");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("Tokyo");
    expect(screen.getByText("Sunrise: 04:30 · Sunset: 18:55")).toBeInTheDocument();
  });

  it("picks the forecast entry closest to the city's local noon", async () => {
    globalThis.fetch = mockFetchSuccess(tokyoWeatherData, tokyoForecastData);
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByLabelText("City"), "Tokyo");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("Tokyo");
    expect(screen.getByText("25.0 °C")).toBeInTheDocument();
    expect(screen.queryByText("10.0 °C")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".card")).toHaveLength(1);
  });

  it("shows humidity on each forecast card", async () => {
    globalThis.fetch = mockFetchSuccess();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByPlaceholderText("Enter city"), "Helsinki");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("Helsinki");
    for (const humidity of [60, 65, 70, 88, 55]) {
      expect(screen.getByText(`Humidity: ${humidity}%`)).toBeInTheDocument();
    }
  });

  describe("explains weather service errors in plain words instead of showing the raw API text", () => {
    it.each([
      [404, "city not found", NOT_FOUND_MESSAGE],
      [
        401,
        "Invalid API key. Please see https://openweathermap.org/faq#error401 for more info.",
        "The weather service rejected the API key. Check VITE_WEATHER_API_KEY in your .env file.",
      ],
      [429, "Your account is temporary blocked", "Too many requests right now. Wait a minute and try again."],
      [500, "Internal error", "The weather service returned an error (500). Try again in a moment."],
    ])("HTTP %i", async (status, apiMessage, shownMessage) => {
      globalThis.fetch = mockFetchError(status, apiMessage);
      const user = userEvent.setup();
      render(<Weather />);

      await user.type(screen.getByLabelText("City"), "Asdfqwerty{Enter}");

      const alert = screen.getByRole("alert");
      await waitFor(() => expect(alert).toHaveTextContent(shownMessage));
      expect(alert).not.toHaveTextContent(apiMessage);
    });
  });

  it("clears the previous city's weather and explains the problem when the network fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = mockFetchSuccess();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByLabelText("City"), "Helsinki");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("heading", { name: "Helsinki" });

    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    await user.clear(screen.getByLabelText("City"));
    await user.type(screen.getByLabelText("City"), "Oslo");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByText("Couldn't load the weather. Check your connection and try again.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Helsinki" })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".card")).toHaveLength(0);
  });

  it("does not remember a city that was not found", async () => {
    globalThis.fetch = mockFetchNotFound();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByLabelText("City"), "Asdfqwerty");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText(NOT_FOUND_MESSAGE);
    expect(localStorage.getItem("lastCity")).toBeNull();
  });

  describe("when the browser blocks localStorage", () => {
    beforeEach(() => {
      const blocked = () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      };
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    });

    it("still renders with default settings", () => {
      const { container } = render(<Weather />);

      expect(screen.getByLabelText("City")).toHaveValue("");
      expect(container.querySelector(".app")).not.toHaveClass("dark");
      expect(screen.getByRole("button", { name: /Fahrenheit/ })).toBeInTheDocument();
    });

    it("still searches and toggles settings, without remembering them", async () => {
      globalThis.fetch = mockFetchSuccess();
      const user = userEvent.setup();
      const { container } = render(<Weather />);

      await user.type(screen.getByLabelText("City"), "Helsinki");
      await user.click(screen.getByRole("button", { name: "Search" }));
      expect(await screen.findByText("Helsinki")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
      expect(container.querySelector(".app")).toHaveClass("dark");

      await user.click(screen.getByRole("button", { name: /Fahrenheit/ }));
      expect(screen.getByText("60.0 °F")).toBeInTheDocument();
    });
  });

  it("does not search when the input is only whitespace", async () => {
    globalThis.fetch = mockFetchSuccess();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByPlaceholderText("Enter city"), "   ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("trims whitespace before saving and searching", async () => {
    globalThis.fetch = mockFetchSuccess();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByPlaceholderText("Enter city"), "  Helsinki  ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("Helsinki");
    expect(localStorage.getItem("lastCity")).toBe("Helsinki");
    expect(globalThis.fetch.mock.calls[0][0]).toContain("q=Helsinki");
  });

  it("toggles dark mode and persists the preference", async () => {
    globalThis.fetch = mockFetchSuccess();
    const user = userEvent.setup();
    const { container } = render(<Weather />);

    expect(container.querySelector(".app")).not.toHaveClass("dark");

    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(container.querySelector(".app")).toHaveClass("dark");
    expect(localStorage.getItem("darkMode")).toBe("true");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  describe("initial theme", () => {
    const setSystemTheme = (theme) => {
      vi.stubGlobal("matchMedia", (query) => ({
        media: query,
        matches: query === "(prefers-color-scheme: dark)" && theme === "dark",
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
    };

    it.each([
      ["dark", true],
      ["light", false],
    ])("follows a %s system theme on the first visit", (systemTheme, expectDark) => {
      setSystemTheme(systemTheme);
      const { container } = render(<Weather />);
      expect(container.querySelector(".app").classList.contains("dark")).toBe(expectDark);
    });

    it.each([
      ["false", "dark", false],
      ["true", "light", true],
    ])("keeps the saved choice darkMode=%s even when the system theme is %s", (saved, systemTheme, expectDark) => {
      localStorage.setItem("darkMode", saved);
      setSystemTheme(systemTheme);
      const { container } = render(<Weather />);
      expect(container.querySelector(".app").classList.contains("dark")).toBe(expectDark);
    });

    it("starts in light mode when the browser can't report a system theme", () => {
      vi.stubGlobal("matchMedia", undefined);
      const { container } = render(<Weather />);
      expect(container.querySelector(".app")).not.toHaveClass("dark");
    });
  });

  it("toggles between Celsius and Fahrenheit without an extra fetch", async () => {
    globalThis.fetch = mockFetchSuccess();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByPlaceholderText("Enter city"), "Helsinki");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("15.6 °C");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: /Fahrenheit/ }));

    expect(screen.getByText("60.0 °F")).toBeInTheDocument();
    expect(screen.getByText("Feels like: 55.8 °F")).toBeInTheDocument();
    expect(screen.getByText("Wind: 9.7 mph")).toBeInTheDocument();
    expect(localStorage.getItem("unit")).toBe("imperial");
    expect(screen.getByRole("button", { name: /Celsius/ })).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // toggling unit must not trigger a refetch

    await user.click(screen.getByRole("button", { name: /Celsius/ }));

    expect(screen.getByText("15.6 °C")).toBeInTheDocument();
    expect(localStorage.getItem("unit")).toBe("metric");
  });

  it("restores the last searched city and dark mode from localStorage on mount", async () => {
    localStorage.setItem("lastCity", "Turku");
    localStorage.setItem("darkMode", "true");
    globalThis.fetch = mockFetchSuccess();

    const { container } = render(<Weather />);

    expect(screen.getByPlaceholderText("Enter city")).toHaveValue("Turku");
    expect(container.querySelector(".app")).toHaveClass("dark");
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(globalThis.fetch.mock.calls[0][0]).toContain("q=Turku");
  });

  it("fetches weather using geolocation coordinates", async () => {
    globalThis.fetch = mockFetchSuccess();
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success) =>
          success({ coords: { latitude: 60.1699, longitude: 24.9384 } }),
      },
    });
    const user = userEvent.setup();
    render(<Weather />);

    await user.click(screen.getByRole("button", { name: "Use my location" }));

    await screen.findByText("Helsinki");
    expect(globalThis.fetch.mock.calls[0][0]).toContain("lat=60.1699");
    expect(globalThis.fetch.mock.calls[0][0]).toContain("lon=24.9384");
  });

  it("shows the located place in the search box after a location search, without saving it", async () => {
    globalThis.fetch = vi.fn((url) => {
      const name = url.includes("lat=") ? "Horinouchi" : "Turku";
      const body = url.includes("/forecast") ? forecastData : { ...weatherData, name };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    });
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success) =>
          success({ coords: { latitude: 35.6762, longitude: 139.6503 } }),
      },
    });
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByLabelText("City"), "Turku{Enter}");
    await screen.findByRole("heading", { name: "Turku" });

    await user.click(screen.getByRole("button", { name: "Use my location" }));
    await screen.findByRole("heading", { name: "Horinouchi" });

    expect(screen.getByLabelText("City")).toHaveValue("Horinouchi");
    expect(localStorage.getItem("lastCity")).toBe("Turku");
  });

  it("shows a specific error when geolocation permission is denied", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (_success, error) =>
          error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
      },
    });
    const user = userEvent.setup();
    render(<Weather />);

    await user.click(screen.getByRole("button", { name: "Use my location" }));

    expect(
      await screen.findByText("Location access denied — allow location access in your browser settings")
    ).toBeInTheDocument();
  });

  it("shows a specific error when the position is unavailable", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (_success, error) =>
          error({ code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
      },
    });
    const user = userEvent.setup();
    render(<Weather />);

    await user.click(screen.getByRole("button", { name: "Use my location" }));

    expect(await screen.findByText("Your location could not be determined")).toBeInTheDocument();
  });

  it("shows a specific error when the geolocation request times out", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (_success, error) =>
          error({ code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
      },
    });
    const user = userEvent.setup();
    render(<Weather />);

    await user.click(screen.getByRole("button", { name: "Use my location" }));

    expect(await screen.findByText("Location request timed out — try again")).toBeInTheDocument();
  });

  it("explains when the browser doesn't support geolocation, without starting a request", async () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined });
    globalThis.fetch = vi.fn();
    const user = userEvent.setup();
    render(<Weather />);

    await user.click(screen.getByRole("button", { name: "Use my location" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Geolocation not supported");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  describe("API key check", () => {
    it("warns in the console when VITE_WEATHER_API_KEY is missing", () => {
      vi.stubEnv("VITE_WEATHER_API_KEY", "");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(<Weather />);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("VITE_WEATHER_API_KEY is not set"));
    });

    it("stays quiet when the key is set", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(<Weather />);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it("keeps Search available while loading, and a newer search replaces the one still loading", async () => {
    const { fetchMock, respondFor } = mockFetchControlled();
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();
    render(<Weather />);

    const input = screen.getByLabelText("City");
    await user.type(input, "Oslo");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    expect(screen.getByRole("button", { name: "Search" })).toBeEnabled();

    await user.clear(input);
    await user.type(input, "Rome{Enter}");
    respondFor("Rome");
    respondFor("Oslo"); // arrives late; its request was already cancelled

    expect(await screen.findByRole("heading", { name: "Rome" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Oslo" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    expect(localStorage.getItem("lastCity")).toBe("Rome");
  });

  it("ignores a location that arrives after the user already searched for a city", async () => {
    let deliverPosition;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success) => {
          deliverPosition = success;
        },
      },
    });
    globalThis.fetch = mockFetchSuccess({ ...weatherData, name: "Turku" });
    const user = userEvent.setup();
    render(<Weather />);

    await user.click(screen.getByRole("button", { name: "Use my location" }));
    await user.type(screen.getByLabelText("City"), "Turku{Enter}");
    await screen.findByRole("heading", { name: "Turku" });

    deliverPosition({ coords: { latitude: 60.1699, longitude: 24.9384 } });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(globalThis.fetch.mock.calls.some(([url]) => url.includes("lat="))).toBe(false);
    expect(screen.getByRole("heading", { name: "Turku" })).toBeInTheDocument();
  });
});
