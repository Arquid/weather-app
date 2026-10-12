import {
  convertTemp,
  convertWind,
  formatDay,
  getIcon,
  tempUnitLabel,
  windUnitLabel,
} from "../utils/weather";

function ForecastCard({ day, unit, tzOffset }) {
  return (
    <div className="card">
      <p>{formatDay(day.dt, tzOffset)}</p>
      <img
        src={getIcon(day.weather?.[0]?.icon)}
        alt={day.weather?.[0]?.description || "Weather image"}
      />
      <p>{convertTemp(day.main?.temp, unit)?.toFixed(1)} {tempUnitLabel(unit)}</p>
      <p>Wind: {convertWind(day.wind?.speed, unit)?.toFixed(1)} {windUnitLabel(unit)}</p>
      <p>Humidity: {day.main?.humidity}%</p>
    </div>
  );
}

export default ForecastCard;
