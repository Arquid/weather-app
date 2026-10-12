import {
  convertTemp,
  convertWind,
  formatTime,
  getIcon,
  tempUnitLabel,
  windUnitLabel,
} from "../utils/weather";

function CurrentWeather({ data, unit }) {
  const tzOffset = data.timezone ?? 0;
  const tempUnit = tempUnitLabel(unit);

  return (
    <div className="current">
      <h2>{data.name}</h2>
      <img
        src={getIcon(data.weather?.[0]?.icon)}
        alt={data.weather?.[0]?.description || "Weather image"}
      />
      <h3>Today</h3>
      <p>{convertTemp(data.main?.temp, unit)?.toFixed(1)} {tempUnit}</p>
      <p>Feels like: {convertTemp(data.main?.feels_like, unit)?.toFixed(1)} {tempUnit}</p>
      <p>Wind: {convertWind(data.wind?.speed, unit)?.toFixed(1)} {windUnitLabel(unit)}</p>
      <p>Humidity: {data.main?.humidity}%</p>
      <p>
        Sunrise: {formatTime(data.sys?.sunrise, tzOffset)} · Sunset: {formatTime(data.sys?.sunset, tzOffset)}
      </p>
    </div>
  );
}

export default CurrentWeather;
