import { useState } from "react";
import CurrentWeather from "./CurrentWeather";
import ForecastCard from "./ForecastCard";
import { useWeather } from "../hooks/useWeather";
import { readSetting, saveSetting } from "../utils/storage";

const systemPrefersDark = () => {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
};

function Weather() {
  const [city, setCity] = useState(readSetting("lastCity", ""));
  const [darkMode, setDarkMode] = useState(() => {
    const saved = readSetting("darkMode", null);
    return saved === null ? systemPrefersDark() : saved === "true";
  });
  const [unit, setUnit] = useState(readSetting("unit", "metric"));
  const { current, forecast, loading, error, searchCity, searchLocation } = useWeather();

  const getWeatherByLocation = async () => {
    const data = await searchLocation();
    if (data) setCity(data.name);
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
        onKeyDown={(e) => e.key === "Enter" && searchCity(city)}
      />
      <button onClick={() => searchCity(city)}>Search</button>
      <button
        onClick={getWeatherByLocation}
        aria-label="Use my location"
      >
        📍 Own location
      </button>
      <button
        onClick={() => {
          saveSetting("darkMode", !darkMode);
          setDarkMode(!darkMode);
        }}
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
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