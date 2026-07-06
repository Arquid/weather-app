import { useState } from "react";

function Weather() {
  const [city, setCity] = useState("");
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiKey = import.meta.env.VITE_WEATHER_API_KEY;

  const fetchWeather = async (query) => {
    try {
      setLoading(true);
      setError("");

      const res1 = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${apiKey}&units=metric`
      );
      const data1 = await res1.json();

      const res2 = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?${query}&appid=${apiKey}&units=metric`
      );
      const data2 = await res2.json();

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
      console.error(err);
      setError("Something went wrong");
      setLoading(false);
    }
  };

  const getWeather = () => {
    if (!city || loading) return;

    fetchWeather(`q=${encodeURIComponent(city)}`);
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
      () => {
        setError("Location access denied")
        setLoading(false);
      }
    )
  }

  const getIcon = (icon) =>
    `https://openweathermap.org/img/wn/${icon}@2x.png`;

  return (
    <div className={darkMode ? "app dark" : "app"}>
      <h1>🌦️ Weather App</h1>
      <input
        type="text"
        placeholder="Enter city"
        onChange={(e) => setCity(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && getWeather()}
      />
      <button onClick={getWeather} disabled={loading}>Search</button>
      <button onClick={getWeatherByLocation} disabled={loading}>📍 Own location</button>
      <button onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? "☀️ Light" : "🌙 Dark"}
      </button>
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
          <p>{current?.main?.temp?.toFixed(1)} °C</p>
          <p>Wind: {current?.wind?.speed?.toFixed(1)} m/s</p>
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
            <p>{day?.main?.temp?.toFixed(1)} °C</p>
            <p>Wind: {day?.wind?.speed?.toFixed(1)} m/s</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Weather;