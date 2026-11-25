import { useState, useEffect, useCallback, useRef } from "react";
import CurrentWeather from "./CurrentWeather";
import ForecastCard from "./ForecastCard";
import { pickMiddayForecasts } from "../utils/weather";
import { readSetting, saveSetting } from "../utils/storage";

const GEO_ERRORS = {
  1: "Location access denied — allow location access in your browser settings",
  2: "Your location could not be determined",
  3: "Location request timed out — try again",
};

const API_ERRORS = {
  401: "The weather service rejected the API key. Check VITE_WEATHER_API_KEY in your .env file.",
  404: "No place with that name was found. Check the spelling and try again.",
  429: "Too many requests right now. Wait a minute and try again.",
};

const systemPrefersDark = () => {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
};

function Weather() {
  const [city, setCity] = useState(readSetting("lastCity", ""));
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = readSetting("darkMode", null);
    return saved === null ? systemPrefersDark() : saved === "true";
  });
  const [unit, setUnit] = useState(readSetting("unit", "metric"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
  const abortRef = useRef(null);
  const didInit = useRef(false);

  const fetchWeather = useCallback(async (query) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError("");

      const [res1, res2] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?${query}&appid=${apiKey}&units=metric`, { signal: controller.signal }),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?${query}&appid=${apiKey}&units=metric`, { signal: controller.signal })
      ]);

      if (!res1.ok || !res2.ok) {
        const status = !res1.ok ? res1.status : res2.status;
        setError(API_ERRORS[status] || `The weather service returned an error (${status}). Try again in a moment.`);
        setCurrent(null);
        setForecast([]);
        setLoading(false);
        return null;
      }

      const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

      setCurrent(data1);
      const tzOffset = data2.city?.timezone ?? data1.timezone ?? 0;
      setForecast(pickMiddayForecasts(data2.list, tzOffset));
      setLoading(false);
      return data1;
    } catch (err) {
      if (err.name === "AbortError") return null;
      console.error(err);
      setError("Couldn't load the weather. Check your connection and try again.");
      setCurrent(null);
      setForecast([]);
      setLoading(false);
      return null;
    }
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) {
      console.warn("VITE_WEATHER_API_KEY is not set — check your .env file");
    }
  }, [apiKey]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const savedCity = readSetting("lastCity", "");
    if (savedCity) {
      Promise.resolve().then(() => fetchWeather(`q=${encodeURIComponent(savedCity)}`));
    }
  }, [fetchWeather]);

  const getWeather = async () => {
    const trimmedCity = city.trim();
    if (!trimmedCity) return;

    const data = await fetchWeather(`q=${encodeURIComponent(trimmedCity)}`);
    if (data) saveSetting("lastCity", trimmedCity);
  };

  const getWeatherByLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (controller.signal.aborted) return;
        const { latitude, longitude } = position.coords;
        const data = await fetchWeather(`lat=${latitude}&lon=${longitude}`);
        if (data) setCity(data.name);
      },
      (err) => {
        if (controller.signal.aborted) return;
        setError(GEO_ERRORS[err.code] || "Something went wrong while getting your location");
        setLoading(false);
      }
    );
  };

  const toggleUnit = () => {
    const newUnit = unit === "metric" ? "imperial" : "metric";
    setUnit(newUnit);
    saveSetting("unit", newUnit);
  };

  return (
    <main className={darkMode ? "app dark" : "app"}>
      <h1>🌦️ Weather App</h1>
      <input
        type="text"
        aria-label="City"
        placeholder="Enter city"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && getWeather()}
      />
      <button onClick={getWeather}>Search</button>
      <button onClick={getWeatherByLocation}>📍 Own location</button>
      <button
        onClick={() => {
          saveSetting("darkMode", !darkMode);
          setDarkMode(!darkMode);
        }}
      >
        {darkMode ? "☀️ Light" : "🌙 Dark"}
      </button>
      <button
        onClick={toggleUnit}
        aria-label={unit === "metric" ? "Show temperatures in Fahrenheit" : "Show temperatures in Celsius"}
      >
        {unit === "metric" ? "°F" : "°C"}
      </button>
      <div role="status">{loading && <p>Loading...</p>}</div>
      <div role="alert">{error && <p className="error">{error}</p>}</div>
      {current && <CurrentWeather data={current} unit={unit} />}
      <div className="forecast">
        {forecast.map((day) => (
          <ForecastCard key={day.dt} day={day} unit={unit} tzOffset={current?.timezone ?? 0} />
        ))}
      </div>
    </main>
  );
}

export default Weather;