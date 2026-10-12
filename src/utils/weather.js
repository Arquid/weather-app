const LOCALE = "en-GB";

export const getIcon = (icon) => `https://openweathermap.org/img/wn/${icon}@2x.png`;

export const convertTemp = (celsius, unit) => {
  if (celsius == null) return null;
  return unit === "imperial" ? (celsius * 9) / 5 + 32 : celsius;
};

export const convertWind = (mps, unit) => {
  if (mps == null) return null;
  return unit === "imperial" ? mps * 2.23694 : mps;
};

export const tempUnitLabel = (unit) => (unit === "imperial" ? "°F" : "°C");
export const windUnitLabel = (unit) => (unit === "imperial" ? "mph" : "m/s");

// Shift by the city's UTC offset and format as UTC, so values show in the city's local time.
export const formatTime = (unixSeconds, tzOffset) => {
  if (unixSeconds == null) return null;
  return new Date((unixSeconds + tzOffset) * 1000).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
};

export const formatDay = (unixSeconds, tzOffset) =>
  new Date((unixSeconds + tzOffset) * 1000).toLocaleDateString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });

// Forecast entries are 3 hours apart, so every full day has one within 1.5 h of local noon.
export const pickMiddayForecasts = (list, tzOffset) => {
  const byDay = new Map();
  for (const item of list) {
    const local = new Date((item.dt + tzOffset) * 1000);
    const distance = Math.abs(local.getUTCHours() + local.getUTCMinutes() / 60 - 12);
    if (distance > 1.5) continue;
    const day = local.toISOString().slice(0, 10);
    const best = byDay.get(day);
    if (!best || distance < best.distance) byDay.set(day, { item, distance });
  }
  return [...byDay.values()].map(({ item }) => item);
};
