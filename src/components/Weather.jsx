import { useState, useEffect, useCallback, useRef } from "react";

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
        return;
      }

      setCurrent(data1);
      const daily = data2.list.filter((item) => item.dt_txt.includes("12:00:00"));
      setForecast(daily);
      setLoading(false);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error(err);
      setError("Something went wrong");
      setLoading(false);
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

  const getWeather = () => {
    const trimmedCity = city.trim();
    if (!trimmedCity || loading) return;

    localStorage.setItem("lastCity", trimmedCity);
    fetchWeather(`q=${encodeURIComponent(trimmedCity)}`);
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
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access denied — allow location access in your browser settings");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Your location could not be determined");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out — try again");
        } else {
          setError("Something went wrong while getting your location");
        }
        setLoading(false);
      }
    )
  }

  const getIcon = (icon) =>
    `https://openweathermap.org/img/wn/${icon}@2x.png`;

  const formatTemp = (celsius) => {
    if (celsius == null) return null;
    return unit === "imperial" ? (celsius * 9) / 5 + 32 : celsius;
  };

  const formatWind = (mps) => {
    if (mps == null) return null;
    return unit === "imperial" ? mps * 2.23694 : mps;
  };

  const tempUnit = unit === "imperial" ? "°F" : "°C";
  const windUnit = unit === "imperial" ? "mph" : "m/s";

  const formatTime = (unixSeconds) => {
    if (unixSeconds == null) return null;
    return new Date(unixSeconds * 1000).toLocaleTimeString("fi-FI", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
      {current && (
        <div className="current">
          <h2>{current.name}</h2>
          <img
            src={getIcon(current?.weather?.[0]?.icon)}
            alt={current?.weather?.[0]?.description || "Weather image"}
          />
          <h3>Today</h3>
          <p>{formatTemp(current?.main?.temp)?.toFixed(1)} {tempUnit}</p>
          <p>Feels like: {formatTemp(current?.main?.feels_like)?.toFixed(1)} {tempUnit}</p>
          <p>Wind: {formatWind(current?.wind?.speed)?.toFixed(1)} {windUnit}</p>
          <p>Humidity: {current?.main?.humidity}%</p>
          <p>Sunrise: {formatTime(current?.sys?.sunrise)} · Sunset: {formatTime(current?.sys?.sunset)}</p>
        </div>
      )}
      <div className="forecast">
        {forecast.map((day) => (
          <div key={day.dt} className="card">
            <p>
              {new Date(day.dt_txt).toLocaleDateString("fi-FI", {
                weekday: "short",
                day: "numeric",
                month: "numeric",
              })}
            </p>
            <img
              src={getIcon(day?.weather?.[0]?.icon)}
              alt={day?.weather?.[0]?.description || "Weather image"}
            />
            <p>{formatTemp(day?.main?.temp)?.toFixed(1)} {tempUnit}</p>
            <p>Wind: {formatWind(day?.wind?.speed)?.toFixed(1)} {windUnit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Weather;