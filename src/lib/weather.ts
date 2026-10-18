// Weather for outfit suggestions. Data comes from Open-Meteo (free, no key):
// https://open-meteo.com  (data licensed CC BY 4.0).

export const WARMTH_LEVELS = ["light", "medium", "heavy"] as const;
export type Warmth = (typeof WARMTH_LEVELS)[number];

export type Band = "hot" | "warm" | "cool" | "cold";

export type Weather = {
  tempC: number;
  feelsC: number;
  highC: number;
  lowC: number;
  code: number;
  precipitationMm: number;
};

export type Place = { name: string; lat: number; lon: number };

export type Unit = "C" | "F";

// "Feels like" temperature decides how warmly to dress.
export function bandFor(feelsC: number): Band {
  if (feelsC >= 24) return "hot";
  if (feelsC >= 16) return "warm";
  if (feelsC >= 8) return "cool";
  return "cold";
}

// Which warmth levels suit each band, per kind of garment. Bottoms and shoes are
// more forgiving than tops (jeans and sneakers work in most weather).
export function allowedWarmth(band: Band, slot: "top" | "bottom" | "footwear"): readonly Warmth[] {
  if (slot === "top") {
    return { hot: ["light"], warm: ["light", "medium"], cool: ["medium", "heavy"], cold: ["heavy"] }[band] as readonly Warmth[];
  }
  return { hot: ["light", "medium"], warm: ["light", "medium"], cool: ["medium", "heavy"], cold: ["medium", "heavy"] }[band] as readonly Warmth[];
}

// An item with no warmth set fits any weather, so untagged items never disappear.
export function fitsWeather(warmth: string | null | undefined, band: Band, slot: "top" | "bottom" | "footwear"): boolean {
  if (!warmth) return true;
  return (allowedWarmth(band, slot) as readonly string[]).includes(warmth);
}

export const BAND_ADVICE: Record<Band, string> = {
  hot: "Hot: favouring light pieces.",
  warm: "Mild: light to medium pieces.",
  cool: "Cool: favouring warmer pieces.",
  cold: "Cold: favouring your warmest pieces.",
};

// WMO weather codes -> words, and whether it is wet.
export function describeCode(code: number): { text: string; wet: boolean } {
  if (code === 0) return { text: "Clear", wet: false };
  if (code === 1) return { text: "Mostly clear", wet: false };
  if (code === 2) return { text: "Partly cloudy", wet: false };
  if (code === 3) return { text: "Overcast", wet: false };
  if (code === 45 || code === 48) return { text: "Fog", wet: false };
  if (code >= 51 && code <= 57) return { text: "Drizzle", wet: true };
  if (code >= 61 && code <= 67) return { text: "Rain", wet: true };
  if (code >= 71 && code <= 77) return { text: "Snow", wet: true };
  if (code >= 80 && code <= 82) return { text: "Rain showers", wet: true };
  if (code === 85 || code === 86) return { text: "Snow showers", wet: true };
  if (code >= 95) return { text: "Thunderstorm", wet: true };
  return { text: "Unsettled", wet: false };
}

export function toUnit(c: number, unit: Unit): number {
  return Math.round(unit === "F" ? (c * 9) / 5 + 32 : c);
}

export function formatTemp(c: number, unit: Unit): string {
  return `${toUnit(c, unit)}°${unit}`;
}

// ---- network (browser) ----

export async function fetchWeather(place: Place): Promise<Weather> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${place.lat}&longitude=${place.lon}` +
    "&current=temperature_2m,apparent_temperature,precipitation,weather_code" +
    "&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather service error " + res.status);
  const json = await res.json();
  const c = json.current;
  if (!c || typeof c.temperature_2m !== "number") throw new Error("Weather data missing");
  return {
    tempC: c.temperature_2m,
    feelsC: typeof c.apparent_temperature === "number" ? c.apparent_temperature : c.temperature_2m,
    highC: json.daily?.temperature_2m_max?.[0] ?? c.temperature_2m,
    lowC: json.daily?.temperature_2m_min?.[0] ?? c.temperature_2m,
    code: c.weather_code ?? 0,
    precipitationMm: c.precipitation ?? 0,
  };
}

export type PlaceResult = Place & { detail: string };

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`
  );
  if (!res.ok) throw new Error("Place search error " + res.status);
  const json = await res.json();
  return (json.results ?? []).map(
    (r: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
      name: r.name,
      lat: r.latitude,
      lon: r.longitude,
      detail: [r.admin1, r.country].filter(Boolean).join(", "),
    })
  );
}
