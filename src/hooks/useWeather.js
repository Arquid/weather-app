import { useState, useEffect, useCallback, useRef } from "react";
import { pickMiddayForecasts } from "../utils/weather";
import { readSetting, saveSetting } from "../utils/storage";

const API_URL = "https://api.openweathermap.org/data/2.5";

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

export function useWeather() {
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
  const abortRef = useRef(null);
  const didInit = useRef(false);

  // Cancels whatever request is still running and claims the slot for a new one.
  const startRequest = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  }, []);

  const fail = useCallback((message) => {
    setError(message);
    setCurrent(null);
    setForecast([]);
    setLoading(false);
  }, []);

  const fetchWeather = useCallback(async (query) => {
    const controller = startRequest();

    try {
      setLoading(true);
      setError("");

      const [res1, res2] = await Promise.all([
        fetch(`${API_URL}/weather?${query}&appid=${apiKey}&units=metric`, { signal: controller.signal }),
        fetch(`${API_URL}/forecast?${query}&appid=${apiKey}&units=metric`, { signal: controller.signal }),
      ]);

      if (!res1.ok || !res2.ok) {
        const status = !res1.ok ? res1.status : res2.status;
        fail(API_ERRORS[status] || `The weather service returned an error (${status}). Try again in a moment.`);
        return null;
      }

      const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

      setCurrent(data1);
      setForecast(pickMiddayForecasts(data2.list, data2.city?.timezone ?? data1.timezone ?? 0));
      setLoading(false);
      return data1;
    } catch (err) {
      if (err.name === "AbortError") return null;
      console.error(err);
      fail("Couldn't load the weather. Check your connection and try again.");
      return null;
    }
  }, [apiKey, startRequest, fail]);

  const searchCity = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const data = await fetchWeather(`q=${encodeURIComponent(trimmed)}`);
    if (data) saveSetting("lastCity", trimmed);
    return data;
  }, [fetchWeather]);

  const searchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return Promise.resolve(null);
    }

    // The browser can't cancel a position lookup, so claim the request slot now:
    // a search started while waiting aborts this controller and the position is ignored.
    const controller = startRequest();
    setLoading(true);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (controller.signal.aborted) return resolve(null);
          resolve(fetchWeather(`lat=${coords.latitude}&lon=${coords.longitude}`));
        },
        (err) => {
          if (controller.signal.aborted) return resolve(null);
          setError(GEO_ERRORS[err.code] || "Something went wrong while getting your location");
          setLoading(false);
          resolve(null);
        }
      );
    });
  }, [startRequest, fetchWeather]);

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

  return { current, forecast, loading, error, searchCity, searchLocation };
}