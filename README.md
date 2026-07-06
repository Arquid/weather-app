# React Weather App 🌦️

A simple, modern weather application built with **React** that fetches current weather and 5-day forecast data from the **OpenWeatherMap API**. Features include dark mode, geolocation search, persisted preferences, loading state, error handling, and temperature/wind speed rounded to 1 decimal.

---

## Features

- 🌍 Search weather by city name  
- 📍 "Own location" search using browser geolocation  
- 📅 5-day forecast with date, temperature, wind speed, and weather icon  
- 🌙 Dark and light mode toggle  
- 💾 Last searched city and theme remembered between visits (localStorage)  
- ⏳ Loading state while fetching data  
- ⚠️ Error handling for invalid city names  
- 🧊 Temperature and wind speed rounded to 1 decimal  

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
