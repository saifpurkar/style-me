"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Icon, { type IconName } from "@/components/Icon";
import { TONES, label, occasionTone, type Tone } from "@/lib/labels";
import { containerCls, fieldCls, h1Cls, h2Cls, linkBtn, mutedCls, outlineBtn, pageCls, panelCls, primaryBtn } from "@/lib/ui";
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
  weatherNotes,
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
  isWet,
  searchPlaces,
  type Conditions,
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
  // What outfits are dressed for: how warm it feels, and whether it is wet.
  const cond: Conditions | null = weatherOn && weather ? { band: bandFor(weather.feelsC), wet: isWet(weather) } : null;

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

      // Coming from the Home screen's "Where to?" circles (/outfit?occasion=work) starts a fresh outfit.
      const wanted = new URLSearchParams(window.location.search).get("occasion");
      if (wanted && (OCCASIONS as readonly string[]).includes(wanted)) {
        setOccasion(wanted as Occasion);
        nextSelection = {};
        nextDismissed = [];
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
        .select("id,name,category,subcategory,occasions,formality,warmth,rain_ready,image_path,created_at")
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
      const candidates = candidatesFor(items, slot, occasion, formality, cond);
      info[slot] = { candidates, current: chosenItem(items, slot, selection, candidates) };
    }
    return info;
    // cond is rebuilt each render, so depend on what it is made of
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, occasion, formality, selection, cond?.band, cond?.wet]);

  const missingRequired = REQUIRED_SLOTS.filter((slot) => !slotInfo[slot].current);
  // Main garments where the weather couldn't be honoured, so we are showing other matches.
  const fellBackSlots = REQUIRED_SLOTS.filter((slot) => weatherNotes(items, slot, occasion, formality, cond).warmth);
  const noRainSlots = REQUIRED_SLOTS.filter((slot) => weatherNotes(items, slot, occasion, formality, cond).rain);
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
    setSelection(randomizeSelection(items, occasion, formality, selection, Math.random, cond));
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
        hang={slot === "top" || slot === "bottom"}
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
    <main className={pageCls}>
      <div className={containerCls}>
        <h1 className={h1Cls}>Your outfit</h1>
        <p className={`${mutedCls} mt-0.5`}>
          {occasionLabel}
          {showFormality ? ` · ${formalityLabel}` : ""}
        </p>

        {/* Where to? */}
        <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {OCCASIONS.map((o) => {
            const on = o === occasion;
            const tone = TONES[occasionTone(o)];
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => setOccasion(o)}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
                    on ? `${tone.solid} ring-4 ring-coral/30` : tone.soft
                  }`}
                >
                  <Icon name={o} className="h-6 w-6" />
                </span>
                <span className={`text-[11px] font-semibold ${on ? "text-ink" : "text-ink/55"}`}>{label(o)}</span>
              </button>
            );
          })}
        </div>

        {showFormality && (
          <div className="mt-2 flex flex-wrap gap-2">
            {FORMALITY.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={f === formality}
                onClick={() => setFormality(f)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  f === formality ? "bg-ink text-white" : "bg-white text-ink/70 soft-shadow hover:text-ink"
                }`}
              >
                {label(f)}
              </button>
            ))}
          </div>
        )}

        <WeatherPanel
          place={place}
          weather={weather}
          note={weatherNote}
          unit={unit}
          on={weatherOn}
          band={band}
          fellBack={fellBackSlots}
          noRain={noRainSlots}
          onPlace={choosePlace}
          onUnit={changeUnit}
          onOn={changeWeatherOn}
        />

        {status && (
          <p className="mt-5 rounded-2xl bg-sand px-4 py-2.5 text-sm font-medium text-sand-ink" role="status">
            {status}
          </p>
        )}

        {!status && missingRequired.length > 0 && (
          <div className={`${panelCls} mt-5`}>
            <h2 className={h2Cls}>We need a few more pieces</h2>
            <div className="mt-2 grid gap-1.5">
              {missingRequired.map((slot) => (
                <p key={slot} className="flex items-center gap-2 text-sm text-ink/80">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${TONES[SLOT_TONE[slot]].soft}`}>
                    <Icon name={SLOT_ICON[slot]} className="h-4 w-4" />
                  </span>
                  No {label(slot).toLowerCase()} yet for {occasionLabel}{showFormality ? ` (${formalityLabel})` : ""}.
                </p>
              ))}
            </div>
            <Link href="/closet?add=1" className={`${primaryBtn} mt-4`}>
              <Icon name="add" className="h-4 w-4" strokeWidth={2.6} />
              Add to your closet
            </Link>
          </div>
        )}

        {!status && missingRequired.length === 0 && (
          <>
            <div className="mt-5 flex flex-col items-center gap-4 rounded-[28px] bg-white p-4 soft-shadow sm:p-6">
              {card("headgear")}
              {card("eyewear")}

              <div className="flex items-start justify-center gap-2 sm:gap-4">
                {card("watch")}
                {card("top")}
                {card("bracelet")}
              </div>

              {card("belt")}

              {card("bottom")}

              <div className="flex items-start justify-center gap-2 sm:gap-4">
                {card("footwear")}
                {card("bag")}
              </div>

              {dismissedSlots.length > 0 && (
                <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-2 border-t border-line pt-4">
                  <span className="text-xs font-semibold text-ink/50">Removed</span>
                  {dismissedSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => restoreSlot(slot)}
                      className="inline-flex items-center gap-1 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-mint-ink"
                    >
                      <Icon name="add" className="h-3 w-3" strokeWidth={2.6} />
                      {label(slot)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={swapEntireOutfit} className={primaryBtn}>
                <Icon name="refresh" className="h-4 w-4" />
                New outfit
              </button>
              <Link href="/try-on" className={outlineBtn}>
                <Icon name="tryon" className="h-4 w-4" />
                Try it on
              </Link>
            </div>
          </>
        )}
      </div>
      <NavBar />
    </main>
  );
}

const SLOT_ICON: Record<Slot, IconName> = {
  headgear: "accessory",
  eyewear: "accessory",
  watch: "accessory",
  bracelet: "accessory",
  belt: "accessory",
  bag: "accessory",
  top: "top",
  bottom: "bottom",
  footwear: "footwear",
};
const SLOT_TONE: Record<Slot, Tone> = {
  headgear: "mint",
  eyewear: "mint",
  watch: "mint",
  bracelet: "mint",
  belt: "mint",
  bag: "mint",
  top: "sky",
  bottom: "lilac",
  footwear: "peach",
};

function WeatherPanel({
  place,
  weather,
  note,
  unit,
  on,
  band,
  fellBack,
  noRain,
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
  noRain: readonly string[];
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
    <div className="mt-5 rounded-3xl bg-sand/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-sand-ink">
          <Icon name="weather" className="h-5 w-5" />
          Weather
        </span>
        {place && (
          <label className="flex items-center gap-2 text-xs font-semibold text-sand-ink">
            <input type="checkbox" className="h-4 w-4 accent-coral" checked={on} onChange={(e) => onOn(e.target.checked)} />
            Dress for the weather
          </label>
        )}
      </div>

      {place ? (
        <div className="mt-2">
          {weather && info ? (
            <p className="text-sm text-ink">
              <span className="font-bold">{place.name}</span> · {formatTemp(weather.tempC, unit)} (feels{" "}
              {formatTemp(weather.feelsC, unit)}) · {info.text} · H {formatTemp(weather.highC, unit)} / L{" "}
              {formatTemp(weather.lowC, unit)}
            </p>
          ) : (
            <p className="text-sm text-ink/70">{note || "…"}</p>
          )}

          {on && band && (
            <p className="mt-1 text-xs text-ink/70">
              {BAND_ADVICE[band]}
              {weather && isWet(weather)
                ? noRain.length > 0
                  ? ` Wet out, and nothing you own for ${noRain.join(" or ")} is rain-ready, so ${[
                      noRain.includes("top") && "bring a rain layer",
                      noRain.includes("footwear") && "wear waterproof shoes",
                    ]
                      .filter(Boolean)
                      .join(" and ")}.`
                  : " Wet out: favouring rain-ready pieces."
                : ""}
            </p>
          )}
          {on && fellBack.length > 0 && (
            <p className="mt-1 text-xs font-semibold text-peach-ink">
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
        <div className="mt-2">
          <p className="text-xs text-ink/70">
            Add your city and outfits will favour pieces that suit today&apos;s weather.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
              placeholder="Search your city"
              aria-label="Search your city"
              className={`${fieldCls} basis-full py-2.5`}
            />
            <button type="button" className={outlineBtn} onClick={() => void search()} disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
            <button type="button" className={outlineBtn} onClick={useMyLocation}>
              Use my location
            </button>
          </div>
          {results.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    type="button"
                    className="w-full rounded-xl bg-white px-3 py-2 text-left text-sm hover:bg-cream"
                    onClick={() => {
                      onPlace({ name: r.name, lat: r.lat, lon: r.lon });
                      setResults([]);
                      setQuery("");
                    }}
                  >
                    {r.name}
                    {r.detail ? <span className="text-ink/60">, {r.detail}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {message && <p className="mt-2 text-xs text-ink/70">{message}</p>}
        </div>
      )}

      <p className="mt-3 text-[10px] text-ink/45">
        Weather data by{" "}
        <a href="https://open-meteo.com" className="underline hover:text-coral" target="_blank" rel="noreferrer">
          Open-Meteo.com
        </a>
      </p>
    </div>
  );
}

function OutfitCard({
  item,
  slot,
  menuOpen,
  canAuto,
  hang,
  onToggleMenu,
  onAutoSwap,
  onChoose,
  onDismiss,
}: {
  item: ItemWithUrl;
  slot: Slot;
  menuOpen: boolean;
  canAuto: boolean;
  hang?: boolean;
  onToggleMenu: () => void;
  onAutoSwap: () => void;
  onChoose: () => void;
  onDismiss?: () => void;
}) {
  const tone = TONES[SLOT_TONE[slot]];

  return (
    // On a phone three cards must fit in one row, so the width follows the screen (26vw), up to 9rem.
    <div
      data-swap-root
      className={`relative w-[27vw] min-w-[5.75rem] max-w-36 rounded-2xl bg-cream p-2 ring-1 ring-line ${hang ? "mt-7" : ""}`}
    >
      {hang && (
        <svg viewBox="0 0 48 28" aria-hidden="true" className="absolute -top-7 left-1/2 h-7 w-12 -translate-x-1/2 text-coral" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 14v-3a3.5 3.5 0 1 0-3.5-3.5" />
          <path d="M24 14 4 25.5h40L24 14Z" />
        </svg>
      )}
      <div className="mb-1.5 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.soft}`}>
          <Icon name={SLOT_ICON[slot]} className="h-3 w-3" />
          {label(slot)}
        </span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Remove ${label(slot)}`}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink/45 hover:bg-ink/10 hover:text-ink"
          >
            <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        )}
      </div>
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="mb-1.5 h-28 w-full rounded-xl object-cover" />
      ) : (
        <div className={`mb-1.5 flex h-28 w-full items-center justify-center rounded-xl ${tone.soft}`}>
          <Icon name={SLOT_ICON[slot]} className="h-8 w-8 opacity-70" />
        </div>
      )}
      <div className="truncate text-xs font-bold text-ink">{item.name}</div>

      <button
        type="button"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-full bg-white py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:bg-ink hover:text-white"
      >
        <Icon name="refresh" className="h-3 w-3" strokeWidth={2.4} />
        Swap
      </button>

      {menuOpen && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 flex flex-col gap-1 rounded-2xl bg-white p-1.5 shadow-[0_12px_28px_-8px_rgba(58,46,37,0.45)] ring-1 ring-line">
          <button
            type="button"
            onClick={onAutoSwap}
            disabled={!canAuto}
            className="rounded-xl px-2 py-2 text-left text-xs font-semibold hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
          >
            Auto-swap
          </button>
          {!canAuto && <span className="px-2 text-[10px] text-ink/50">No other match</span>}
          <button type="button" onClick={onChoose} className="rounded-xl px-2 py-2 text-left text-xs font-semibold hover:bg-cream">
            Choose from closet
          </button>
        </div>
      )}
    </div>
  );
}
