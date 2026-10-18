"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import {
  ACCESSORY_SLOTS,
  ALL_SLOTS,
  FORMALITY,
  OCCASIONS,
  REQUIRED_SLOTS,
  canAutoSwap,
  candidatesFor,
  chosenItem,
  isAccessorySlot,
  isSlot,
  nextCandidate,
  randomizeSelection,
  weatherFellBack,
  type AccessorySlot,
  type Formality,
  type Occasion,
  type OutfitItem,
  type Selection,
  type Slot,
} from "@/lib/outfit";
import {
  BAND_ADVICE,
  bandFor,
  describeCode,
  fetchWeather,
  formatTemp,
  searchPlaces,
  type Place,
  type PlaceResult,
  type Unit,
  type Weather,
} from "@/lib/weather";

type Item = OutfitItem & {
  name: string;
  image_path: string | null;
  created_at: string;
};

type ItemWithUrl = Item & { image_url?: string | null };

// The outfit is kept in sessionStorage so it survives a trip to the Closet
// (Choose from Closet) and back. The Closet leaves its pick under PICK_KEY.
const STATE_KEY = "styleme.outfit.v1";
const PICK_KEY = "styleme.pick.v1";

// Weather settings live in localStorage so they are remembered on this device.
const PLACE_KEY = "styleme.place.v1";
const UNIT_KEY = "styleme.unit.v1";
const WEATHER_ON_KEY = "styleme.weatherOn.v1";

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // remembering is only a convenience
  }
}

function validPlace(p: unknown): p is Place {
  const x = p as Place;
  return !!x && typeof x.name === "string" && Number.isFinite(x.lat) && Number.isFinite(x.lon);
}

function label(value: string): string {
  if (value === "wfh") return "WFH";
  return value
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default function OutfitPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<ItemWithUrl[]>([]);
  const [occasion, setOccasion] = useState<Occasion>("casual_hangout");
  const [formality, setFormality] = useState<Formality>("casual");
  const [selection, setSelection] = useState<Selection>({});
  const [dismissed, setDismissed] = useState<AccessorySlot[]>([]);
  const [menuSlot, setMenuSlot] = useState<Slot | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Weather
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherNote, setWeatherNote] = useState("");
  const [unit, setUnit] = useState<Unit>("C");
  const [weatherOn, setWeatherOn] = useState(true);

  const showFormality = occasion !== "gym";

  // Remembered weather settings (place, units, on/off).
  useEffect(() => {
    const savedPlace = readStored<unknown>(PLACE_KEY, null);
    if (validPlace(savedPlace)) setPlace(savedPlace);
    const savedUnit = readStored<unknown>(UNIT_KEY, "C");
    setUnit(savedUnit === "F" ? "F" : "C");
    setWeatherOn(readStored<unknown>(WEATHER_ON_KEY, true) !== false);
  }, []);

  // Load the weather whenever the place changes.
  useEffect(() => {
    if (!place) {
      setWeather(null);
      setWeatherNote("");
      return;
    }
    let cancelled = false;
    setWeatherNote("Loading the weather…");
    fetchWeather(place)
      .then((w) => {
        if (cancelled) return;
        setWeather(w);
        setWeatherNote("");
      })
      .catch(() => {
        if (cancelled) return;
        setWeather(null);
        setWeatherNote("Couldn't load the weather right now. Outfits will ignore it for now.");
      });
    return () => {
      cancelled = true;
    };
  }, [place]);

  const band = weatherOn && weather ? bandFor(weather.feelsC) : null;

  const choosePlace = (p: Place | null) => {
    setPlace(p);
    writeStored(PLACE_KEY, p);
  };
  const changeUnit = (u: Unit) => {
    setUnit(u);
    writeStored(UNIT_KEY, u);
  };
  const changeWeatherOn = (on: boolean) => {
    setWeatherOn(on);
    writeStored(WEATHER_ON_KEY, on);
  };

  // Restore the saved outfit, then apply an item picked on the Closet screen.
  useEffect(() => {
    try {
      let nextSelection: Selection = {};
      let nextDismissed: AccessorySlot[] = [];

      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if ((OCCASIONS as readonly string[]).includes(saved.occasion)) setOccasion(saved.occasion);
        if ((FORMALITY as readonly string[]).includes(saved.formality)) setFormality(saved.formality);
        if (saved.selection && typeof saved.selection === "object") {
          for (const [slot, id] of Object.entries(saved.selection)) {
            if (isSlot(slot) && typeof id === "string") nextSelection[slot] = id;
          }
        }
        if (Array.isArray(saved.dismissed)) {
          nextDismissed = saved.dismissed.filter((s: string): s is AccessorySlot => isAccessorySlot(s));
        }
      }

      const pickRaw = sessionStorage.getItem(PICK_KEY);
      if (pickRaw) {
        sessionStorage.removeItem(PICK_KEY);
        const pick = JSON.parse(pickRaw);
        if (isSlot(pick.slot) && typeof pick.itemId === "string") {
          nextSelection = { ...nextSelection, [pick.slot]: pick.itemId };
          nextDismissed = nextDismissed.filter((s) => s !== pick.slot);
        }
      }

      setSelection(nextSelection);
      setDismissed(nextDismissed);
    } catch {
      // Saved state is only a convenience; start fresh if it can't be read.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ occasion, formality, selection, dismissed }));
    } catch {
      // ignore
    }
  }, [hydrated, occasion, formality, selection, dismissed]);

  useEffect(() => {
    (async () => {
      setStatus("Loading…");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Please go to /auth and sign in, then return here.");
        return;
      }

      const { data: rawItems, error } = await supabase
        .from("items")
        .select("id,name,category,subcategory,occasions,formality,warmth,image_path,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setStatus("Could not load items: " + error.message);
        return;
      }

      const withUrls: ItemWithUrl[] = await Promise.all(
        (rawItems || []).map(async (it) => {
          if (!it.image_path) return { ...it, image_url: null };
          const { data: urlData, error: urlErr } = await supabase.storage
            .from("wardrobe")
            .createSignedUrl(it.image_path, 60 * 60);
          return { ...it, image_url: urlErr ? null : urlData?.signedUrl ?? null };
        })
      );

      setItems(withUrls);
      setStatus("");
    })();
  }, []);

  // Close the swap menu when clicking anywhere outside a card.
  useEffect(() => {
    if (menuSlot === null) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-swap-root]")) setMenuSlot(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuSlot]);

  const slotInfo = useMemo(() => {
    const info = {} as Record<Slot, { candidates: ItemWithUrl[]; current: ItemWithUrl | undefined }>;
    for (const slot of ALL_SLOTS) {
      const candidates = candidatesFor(items, slot, occasion, formality, band);
      info[slot] = { candidates, current: chosenItem(items, slot, selection, candidates) };
    }
    return info;
  }, [items, occasion, formality, selection, band]);

  const missingRequired = REQUIRED_SLOTS.filter((slot) => !slotInfo[slot].current);
  // Main garments where nothing suits the weather, so we are showing the other matches.
  const fellBackSlots = REQUIRED_SLOTS.filter((slot) => weatherFellBack(items, slot, occasion, formality, band));
  const dismissedSlots = ACCESSORY_SLOTS.filter((slot) => dismissed.includes(slot) && slotInfo[slot].current);

  const autoSwap = (slot: Slot) => {
    const { candidates, current } = slotInfo[slot];
    const next = nextCandidate(candidates, current?.id);
    if (next) setSelection((s) => ({ ...s, [slot]: next.id }));
    setMenuSlot(null);
  };

  const chooseFromCloset = (slot: Slot) => {
    setMenuSlot(null);
    router.push(`/closet?pick=${slot}`);
  };

  const dismissSlot = (slot: AccessorySlot) => {
    setMenuSlot(null);
    setDismissed((d) => (d.includes(slot) ? d : [...d, slot]));
  };

  const restoreSlot = (slot: AccessorySlot) => {
    setDismissed((d) => d.filter((s) => s !== slot));
  };

  const swapEntireOutfit = () => {
    setSelection(randomizeSelection(items, occasion, formality, selection, Math.random, band));
    setDismissed([]);
    setMenuSlot(null);
  };

  const occasionLabel = label(occasion);
  const formalityLabel = label(formality);

  const card = (slot: Slot) => {
    const { candidates, current } = slotInfo[slot];
    if (!current) return null;
    if (isAccessorySlot(slot) && dismissed.includes(slot)) return null;
    return (
      <OutfitCard
        key={slot}
        slot={slot}
        item={current}
        required={!isAccessorySlot(slot)}
        menuOpen={menuSlot === slot}
        canAuto={canAutoSwap(candidates, current.id)}
        onToggleMenu={() => setMenuSlot((m) => (m === slot ? null : slot))}
        onAutoSwap={() => autoSwap(slot)}
        onChoose={() => chooseFromCloset(slot)}
        onDismiss={isAccessorySlot(slot) ? () => dismissSlot(slot) : undefined}
      />
    );
  };

  return (
    <main className="min-h-screen bg-charcoal text-paper font-body">
      <NavBar />
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display font-semibold text-3xl text-paper">Outfit</h1>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="block font-utility text-xs uppercase tracking-wider text-paper/70 mb-1">
              Occasion
            </label>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value as Occasion)}
              className="border border-denim bg-charcoal text-paper px-3 py-2 rounded-[2px] focus:outline-none focus:ring-1 focus:ring-denim"
            >
              {OCCASIONS.map((o) => (
                <option key={o} value={o} className="bg-charcoal text-paper">{label(o)}</option>
              ))}
            </select>
          </div>

          {showFormality && (
            <div>
              <label className="block font-utility text-xs uppercase tracking-wider text-paper/70 mb-1">
                Formality
              </label>
              <select
                value={formality}
                onChange={(e) => setFormality(e.target.value as Formality)}
                className="border border-denim bg-charcoal text-paper px-3 py-2 rounded-[2px] focus:outline-none focus:ring-1 focus:ring-denim"
              >
                {FORMALITY.map((f) => (
                  <option key={f} value={f} className="bg-charcoal text-paper">{label(f)}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={swapEntireOutfit}
            disabled={!!status || missingRequired.length > 0}
            className="ml-auto font-utility text-xs uppercase tracking-wider bg-brass text-ink px-4 py-2 rounded-[2px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Swap Entire Outfit
          </button>
        </div>

        <WeatherPanel
          place={place}
          weather={weather}
          note={weatherNote}
          unit={unit}
          on={weatherOn}
          band={band}
          fellBack={fellBackSlots}
          onPlace={choosePlace}
          onUnit={changeUnit}
          onOn={changeWeatherOn}
        />

        {status && <p className="mt-4 text-sm text-paper/80">{status}</p>}

        {!status && missingRequired.length > 0 && (
          <div className="mt-6 bg-paper text-ink border border-dashed border-brass rounded-[2px] p-4">
            <div className="font-utility text-xs uppercase tracking-wider text-brass mb-2">
              Missing required items
            </div>
            {missingRequired.map((slot) => (
              <p key={slot} className="text-sm">
                No {slot} tagged for {showFormality ? `${formalityLabel} ` : ""}{occasionLabel} yet.
              </p>
            ))}
          </div>
        )}

        {!status && missingRequired.length === 0 && (
          <div className="mt-8 bg-paper border border-dashed border-ink/40 rounded-[2px] p-6 flex flex-col items-center gap-4">
            {card("headgear")}
            {card("eyewear")}

            <div className="flex items-start justify-center gap-4">
              {card("watch")}
              {card("top")}
              {card("bracelet")}
            </div>

            {card("belt")}

            {card("bottom")}

            <div className="flex items-start justify-center gap-4">
              {card("footwear")}
              {card("bag")}
            </div>

            {dismissedSlots.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 border-t border-dashed border-ink/30 pt-4 w-full">
                <span className="font-utility text-[10px] uppercase tracking-wider text-ink/60">Removed</span>
                {dismissedSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => restoreSlot(slot)}
                    className="font-utility text-[10px] uppercase tracking-wider text-brass border border-dashed border-brass rounded-[2px] px-2 py-1 hover:bg-brass hover:text-ink"
                  >
                    + {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

const darkBtn =
  "font-utility text-[10px] uppercase tracking-wider border border-brass text-brass px-3 py-1.5 rounded-[2px] hover:bg-brass hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed";
const linkBtn = "font-utility text-[10px] uppercase tracking-wider text-paper/70 underline hover:text-brass";

function WeatherPanel({
  place,
  weather,
  note,
  unit,
  on,
  band,
  fellBack,
  onPlace,
  onUnit,
  onOn,
}: {
  place: Place | null;
  weather: Weather | null;
  note: string;
  unit: Unit;
  on: boolean;
  band: ReturnType<typeof bandFor> | null;
  fellBack: readonly string[];
  onPlace: (p: Place | null) => void;
  onUnit: (u: Unit) => void;
  onOn: (on: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setMessage("");
    try {
      const found = await searchPlaces(query);
      setResults(found);
      if (found.length === 0) setMessage("No places found. Try another spelling.");
    } catch {
      setMessage("Couldn't search right now. Try again in a moment.");
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Your browser can't share its location. Search for your city instead.");
      return;
    }
    setMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Rounded to about 1 km: plenty for weather, and less precise to store.
        onPlace({
          name: "Your location",
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lon: Math.round(pos.coords.longitude * 100) / 100,
        });
        setMessage("");
      },
      () => setMessage("Couldn't get your location. Search for your city instead."),
      { timeout: 10000 }
    );
  };

  const info = weather ? describeCode(weather.code) : null;

  return (
    <div className="mt-6 border border-dashed border-paper/30 rounded-[2px] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-utility text-[10px] uppercase tracking-wider text-brass">Weather</span>
        {place && (
          <label className="flex items-center gap-2 font-utility text-[10px] uppercase tracking-wider text-paper/80">
            <input type="checkbox" className="accent-brass" checked={on} onChange={(e) => onOn(e.target.checked)} />
            Dress for the weather
          </label>
        )}
      </div>

      {place ? (
        <div className="mt-2">
          {weather && info ? (
            <p className="text-sm">
              <span className="font-semibold">{place.name}</span> · {formatTemp(weather.tempC, unit)} (feels{" "}
              {formatTemp(weather.feelsC, unit)}) · {info.text} · H {formatTemp(weather.highC, unit)} / L{" "}
              {formatTemp(weather.lowC, unit)}
            </p>
          ) : (
            <p className="text-sm text-paper/70">{note || "…"}</p>
          )}

          {on && band && (
            <p className="mt-1 text-xs text-paper/70">
              {BAND_ADVICE[band]}
              {info?.wet ? " Wet out, so bring a rain layer." : ""}
            </p>
          )}
          {on && fellBack.length > 0 && (
            <p className="mt-1 text-xs text-brass">
              Nothing you own for {fellBack.join(", ")} suits this weather, so your other options are shown.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button type="button" className={linkBtn} onClick={() => onPlace(null)}>
              Change location
            </button>
            <button type="button" className={linkBtn} onClick={() => onUnit(unit === "C" ? "F" : "C")}>
              Show in °{unit === "C" ? "F" : "C"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-paper/70">
            Add your city and outfits will favour pieces that suit today&apos;s weather.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
              placeholder="Search your city"
              aria-label="Search your city"
              className="border border-denim bg-charcoal text-paper px-3 py-2 rounded-[2px] text-sm focus:outline-none focus:ring-1 focus:ring-denim"
            />
            <button type="button" className={darkBtn} onClick={() => void search()} disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
            <button type="button" className={darkBtn} onClick={useMyLocation}>
              Use my location
            </button>
          </div>
          {results.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    type="button"
                    className="w-full text-left text-sm border border-paper/20 rounded-[2px] px-3 py-1.5 hover:border-brass"
                    onClick={() => {
                      onPlace({ name: r.name, lat: r.lat, lon: r.lon });
                      setResults([]);
                      setQuery("");
                    }}
                  >
                    {r.name}
                    {r.detail ? <span className="text-paper/60">, {r.detail}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {message && <p className="mt-2 text-xs text-paper/70">{message}</p>}
        </div>
      )}

      <p className="mt-3 text-[10px] text-paper/50">
        Weather data by{" "}
        <a href="https://open-meteo.com" className="underline hover:text-brass" target="_blank" rel="noreferrer">
          Open-Meteo.com
        </a>
      </p>
    </div>
  );
}

function OutfitCard({
  item,
  slot,
  required,
  menuOpen,
  canAuto,
  onToggleMenu,
  onAutoSwap,
  onChoose,
  onDismiss,
}: {
  item: ItemWithUrl;
  slot: string;
  required: boolean;
  menuOpen: boolean;
  canAuto: boolean;
  onToggleMenu: () => void;
  onAutoSwap: () => void;
  onChoose: () => void;
  onDismiss?: () => void;
}) {
  const accent = required ? "text-denim" : "text-brass";
  const buttonTone = required
    ? "border-denim text-denim hover:bg-denim hover:text-paper"
    : "border-brass text-brass hover:bg-brass hover:text-ink";

  return (
    <div data-swap-root className="relative w-36 border border-ink/20 rounded-[2px] p-2 bg-paper">
      <div className="flex items-center justify-between mb-1">
        <span className={`font-utility text-[10px] uppercase tracking-wider ${accent}`}>{slot}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Remove ${slot}`}
            className="font-utility text-sm leading-none text-brass hover:text-ink px-1"
          >
            ×
          </button>
        )}
      </div>
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="w-full h-28 object-cover rounded-[2px] mb-1" />
      ) : (
        <div className="w-full h-28 bg-ink/5 rounded-[2px] mb-1 flex items-center justify-center text-ink/40 text-xs">
          No image
        </div>
      )}
      <div className="text-sm font-body text-ink truncate">{item.name}</div>

      <button
        type="button"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        className={`mt-2 w-full font-utility text-[10px] uppercase tracking-wider border rounded-[2px] py-1 ${buttonTone}`}
      >
        Swap
      </button>

      {menuOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-paper border border-ink/30 rounded-[2px] p-1 flex flex-col gap-1">
          <button
            type="button"
            onClick={onAutoSwap}
            disabled={!canAuto}
            className={`font-utility text-[10px] uppercase tracking-wider border rounded-[2px] py-1 disabled:opacity-40 disabled:cursor-not-allowed ${buttonTone}`}
          >
            Auto-swap
          </button>
          {!canAuto && (
            <span className="font-utility text-[9px] uppercase tracking-wider text-ink/50 text-center">
              No other match
            </span>
          )}
          <button
            type="button"
            onClick={onChoose}
            className={`font-utility text-[10px] uppercase tracking-wider border rounded-[2px] py-1 ${buttonTone}`}
          >
            Choose from closet
          </button>
        </div>
      )}
    </div>
  );
}
