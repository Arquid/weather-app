import { it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("renders the weather app", () => {
  vi.stubEnv("VITE_WEATHER_API_KEY", "test-api-key");
  render(<App />);

  expect(screen.getByRole("heading", { level: 1, name: /Weather App/ })).toBeInTheDocument();
  expect(screen.getByRole("main")).toBeInTheDocument();
});
