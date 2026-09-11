import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Weather from "./Weather";

const weatherData = {
  name: "Helsinki",
  main: { temp: 15.567, feels_like: 13.2, humidity: 72 },
  wind: { speed: 4.321 },
  weather: [{ icon: "01d", description: "clear sky" }],
  sys: { sunrise: 1753070400, sunset: 1753124400 },
};

const forecastData = {
  list: [
    { dt: 1, dt_txt: "2026-07-21 12:00:00", main: { temp: 16.7 }, wind: { speed: 3.1 }, weather: [{ icon: "01d", description: "clear sky" }] },
    { dt: 2, dt_txt: "2026-07-22 12:00:00", main: { temp: 17.2 }, wind: { speed: 2.4 }, weather: [{ icon: "02d", description: "few clouds" }] },
    { dt: 3, dt_txt: "2026-07-23 12:00:00", main: { temp: 18.9 }, wind: { speed: 1.9 }, weather: [{ icon: "03d", description: "scattered clouds" }] },
    { dt: 4, dt_txt: "2026-07-24 12:00:00", main: { temp: 14.1 }, wind: { speed: 5.6 }, weather: [{ icon: "10d", description: "light rain" }] },
    { dt: 5, dt_txt: "2026-07-25 12:00:00", main: { temp: 19.3 }, wind: { speed: 2.2 }, weather: [{ icon: "01d", description: "clear sky" }] },
  ],
};

function mockFetchSuccess() {
  return vi.fn((url) => {
    const body = url.includes("/forecast") ? forecastData : weatherData;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    });
  });
}

function mockFetchNotFound() {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ cod: "404", message: "city not found" }),
    })
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_WEATHER_API_KEY", "test-api-key");
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Weather", () => {
  it("renders the search input and buttons", () => {
    render(<Weather />);
    expect(screen.getByPlaceholderText("Enter city")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Own location/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dark/ })).toBeInTheDocument();
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

  it("shows the API's own error message when the city is not found", async () => {
    globalThis.fetch = mockFetchNotFound();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByPlaceholderText("Enter city"), "Asdfqwerty");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("city not found")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /Dark/ }));

    expect(container.querySelector(".app")).toHaveClass("dark");
    expect(localStorage.getItem("darkMode")).toBe("true");
    expect(screen.getByRole("button", { name: /Light/ })).toBeInTheDocument();
  });

  it("toggles between Celsius and Fahrenheit without an extra fetch", async () => {
    globalThis.fetch = mockFetchSuccess();
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByPlaceholderText("Enter city"), "Helsinki");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("15.6 °C");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "°F" }));

    expect(screen.getByText("60.0 °F")).toBeInTheDocument();
    expect(screen.getByText("Wind: 9.7 mph")).toBeInTheDocument();
    expect(localStorage.getItem("unit")).toBe("imperial");
    expect(screen.getByRole("button", { name: "°C" })).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // toggling unit must not trigger a refetch

    await user.click(screen.getByRole("button", { name: "°C" }));

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

    await user.click(screen.getByRole("button", { name: /Own location/ }));

    await screen.findByText("Helsinki");
    expect(globalThis.fetch.mock.calls[0][0]).toContain("lat=60.1699");
    expect(globalThis.fetch.mock.calls[0][0]).toContain("lon=24.9384");
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

    await user.click(screen.getByRole("button", { name: /Own location/ }));

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

    await user.click(screen.getByRole("button", { name: /Own location/ }));

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

    await user.click(screen.getByRole("button", { name: /Own location/ }));

    expect(await screen.findByText("Location request timed out — try again")).toBeInTheDocument();
  });

  it("disables the search buttons while a request is loading", async () => {
    const resolvers = [];
    globalThis.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );
    const user = userEvent.setup();
    render(<Weather />);

    await user.type(screen.getByPlaceholderText("Enter city"), "Helsinki");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    resolvers.forEach((resolve) => resolve({ ok: true, json: () => Promise.resolve(weatherData) }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).not.toBeDisabled());
  });
});
