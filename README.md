# React Weather App 🌦️

A simple, modern weather application built with **React** that fetches current weather and 5-day forecast data from the **OpenWeatherMap API**. Features include detailed current conditions, dark mode, geolocation search, a °C/°F toggle, persisted preferences, loading state, and error handling.

---

## Features

- 🌍 Search weather by city name  
- 📍 "Own location" search using browser geolocation, with clear messages for denied, unavailable, or timed-out location requests  
- 🌤️ Current conditions: temperature, feels-like temperature, wind speed, humidity, sunrise and sunset  
- 📅 5-day forecast (one entry per day, closest to local noon) with date, temperature, wind speed, humidity, and weather icon  
- 🕒 Sunrise, sunset, and forecast dates shown in the searched city's local time  
- 🌙 Dark and light mode toggle  
- 🌡️ Celsius / Fahrenheit unit toggle (converted instantly, no extra request)  
- 💾 Last successfully searched city, theme, and unit remembered between visits (localStorage); a failed search never replaces the saved city. If the browser blocks site data, the app still works with default settings  
- ⏳ Loading state while fetching data  
- ⚠️ Error handling for invalid city names  
- 🧊 Temperatures and wind speed rounded to 1 decimal  

---

## Installation

Requires **Node.js 20.19+ or 22.12+** (needed by Vite 8) and a free [OpenWeatherMap API key](https://home.openweathermap.org/api_keys).

```bash
git clone https://github.com/Arquid/weather-app.git
cd weather-app
npm install
```

Copy `.env.example` to `.env` and add your OpenWeatherMap API key:

```bash
cp .env.example .env
```

```
VITE_WEATHER_API_KEY=your_api_key_here
```

> **Note:** this is a browser-only app, so the key is embedded in the built JavaScript and visible to anyone who opens the site. `.env` keeps it out of git, not out of the browser. Use a free-tier key you don't mind being public.

```bash
npm run dev
```

---

## Project structure

```
src/
├── components/
│   ├── Weather.jsx         # state, data fetching, search and toggle controls
│   ├── CurrentWeather.jsx  # current conditions panel
│   └── ForecastCard.jsx    # one forecast day
└── utils/
    ├── storage.js          # safe localStorage reads and writes for saved settings
    └── weather.js          # unit conversion, local-time formatting, forecast day selection
```

---

## Testing

Automated tests use **Vitest** and **React Testing Library**:

- `src/components/Weather.test.jsx` — component tests for searching, errors, toggles, persistence, and geolocation
- `src/utils/weather.test.js` — unit tests for conversions, time zones, and forecast day selection
- `src/utils/storage.test.js` — unit tests for saved settings, including blocked storage

`fetch`, geolocation, and `localStorage` are mocked, so no API key or network access is required to run them.

```bash
npm test          # run once
npm run test:watch  # watch mode
```
