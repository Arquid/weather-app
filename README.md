# React Weather App 🌦️

A simple, modern weather application built with **React** that fetches current weather and 5-day forecast data from the **OpenWeatherMap API**. Features include detailed current conditions, dark mode, geolocation search, a °C/°F toggle, persisted preferences, loading state, and error handling.

---

## Features

- 🌍 Search weather by city name  
- 📍 "Own location" search using browser geolocation, with clear messages for denied, unavailable, or timed-out location requests  
- 🌤️ Current conditions: temperature, feels-like temperature, wind speed, humidity, sunrise and sunset  
- 📅 5-day forecast with date, temperature, wind speed, humidity, and weather icon  
- 🌙 Dark and light mode toggle  
- 🌡️ Celsius / Fahrenheit unit toggle (converted instantly, no extra request)  
- 💾 Last searched city, theme, and unit remembered between visits (localStorage)  
- ⏳ Loading state while fetching data  
- ⚠️ Error handling for invalid city names  
- 🧊 Temperatures and wind speed rounded to 1 decimal  

---

## Installation

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

```bash
npm run dev
```

---

## Testing

Automated tests use **Vitest** and **React Testing Library**. `fetch`, geolocation, and `localStorage` are mocked, so no API key or network access is required to run them.

```bash
npm test          # run once
npm run test:watch  # watch mode
```
