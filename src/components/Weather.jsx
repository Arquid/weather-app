import { useState, useEffect, useCallback, useRef } from "react";
import CurrentWeather from "./CurrentWeather";
import ForecastCard from "./ForecastCard";
import { pickMiddayForecasts } from "../utils/weather";

const GEO_ERRORS = {
  1: "Location access denied — allow location access in your browser settings",
  2: "Your location could not be determined",
  3: "Location request timed out — try again",
};

function Weather() {
  const [city, setCity] = useState(localStorage.getItem("lastCity") || "");
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");
  const [unit, setUnit] = useState(localStorage.getItem("unit") || "metric");
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
      const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

      if (!res1.ok || !res2.ok) {
        setError(data1.message || data2.message || "Something went wrong");
        setCurrent(null);
        setForecast([]);
        setLoading(false);
        return false;
      }

      setCurrent(data1);
      const tzOffset = data2.city?.timezone ?? data1.timezone ?? 0;
      setForecast(pickMiddayForecasts(data2.list, tzOffset));
      setLoading(false);
      return true;
    } catch (err) {
      if (err.name === "AbortError") return false;
      console.error(err);
      setError("Something went wrong");
      setLoading(false);
      return false;
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

    const savedCity = localStorage.getItem("lastCity");
    if (savedCity) {
      Promise.resolve().then(() => fetchWeather(`q=${encodeURIComponent(savedCity)}`));
    }
  }, [fetchWeather]);

  const getWeather = async () => {
    const trimmedCity = city.trim();
    if (!trimmedCity || loading) return;

    const ok = await fetchWeather(`q=${encodeURIComponent(trimmedCity)}`);
    if (ok) localStorage.setItem("lastCity", trimmedCity);
  };

  const getWeatherByLocation = () => {
    if (loading) return;
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeather(`lat=${latitude}&lon=${longitude}`);
      },
      (err) => {
        setError(GEO_ERRORS[err.code] || "Something went wrong while getting your location");
        setLoading(false);
      }
    )
  }

  const toggleUnit = () => {
    const newUnit = unit === "metric" ? "imperial" : "metric";
    setUnit(newUnit);
    localStorage.setItem("unit", newUnit);
  };

  return (
    <div className={darkMode ? "app dark" : "app"}>
      <h1>🌦️ Weather App</h1>
      <input
        type="text"
        aria-label="City"
        placeholder="Enter city"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && getWeather()}
      />
      <button onClick={getWeather} disabled={loading}>Search</button>
      <button onClick={getWeatherByLocation} disabled={loading}>📍 Own location</button>
      <button
        onClick={() => {
          localStorage.setItem("darkMode", !darkMode);
          setDarkMode(!darkMode);
        }}
      >
        {darkMode ? "☀️ Light" : "🌙 Dark"}
      </button>
      <button onClick={toggleUnit}>{unit === "metric" ? "°F" : "°C"}</button>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {current && <CurrentWeather data={current} unit={unit} />}
      <div className="forecast">
        {forecast.map((day) => (
          <ForecastCard key={day.dt} day={day} unit={unit} tzOffset={current?.timezone ?? 0} />
        ))}
      </div>
    </div>
  );
}

export default Weather;