// Pure outfit logic (no React, no Supabase) so it can be tested on its own.
import { fitsWeather, type Conditions } from "@/lib/weather";

export const OCCASIONS = ["work", "wfh", "dining", "date", "casual_hangout", "special_event", "travel", "outdoor", "gym"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const FORMALITY = ["casual", "smart_casual", "business_casual", "formal"] as const;
export type Formality = (typeof FORMALITY)[number];

export const REQUIRED_SLOTS = ["top", "bottom", "footwear"] as const;
export type RequiredSlot = (typeof REQUIRED_SLOTS)[number];

// An accessory's slot comes from its subcategory. 'socks' and 'other' have no
// flat-lay slot, so they never appear in an outfit.
export const ACCESSORY_SLOTS = ["headgear", "eyewear", "watch", "bracelet", "belt", "bag"] as const;
export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number];

export type Slot = RequiredSlot | AccessorySlot;

export const ALL_SLOTS: readonly Slot[] = [...REQUIRED_SLOTS, ...ACCESSORY_SLOTS];

export function isAccessorySlot(slot: string): slot is AccessorySlot {
  return (ACCESSORY_SLOTS as readonly string[]).includes(slot);
}

export function isSlot(slot: string): slot is Slot {
  return (ALL_SLOTS as readonly string[]).includes(slot);
}

export type OutfitItem = {
  id: string;
  category: string | null;
  subcategory: string | null;
  occasions: string[] | null;
  formality: string[] | null;
  warmth?: string | null;
  rain_ready?: boolean | null;
};

// The item the user has explicitly picked for a slot (by id). Slots without an
// entry use the first matching item.
export type Selection = Partial<Record<Slot, string>>;

export function slotOf(item: OutfitItem): Slot | null {
  if (item.category === "top" || item.category === "bottom" || item.category === "footwear") {
    return item.category;
  }
  if (item.category === "accessory" && item.subcategory && isAccessorySlot(item.subcategory)) {
    return item.subcategory;
  }
  return null;
}

export function matchesFilter(item: OutfitItem, occasion: Occasion, formality: Formality): boolean {
  if (!item.occasions?.includes(occasion)) return false;
  // Gym has no formality, so it is not filtered on.
  if (occasion !== "gym" && !item.formality?.includes(formality)) return false;
  return true;
}

// Weather only shapes the main garments; accessories don't care.
function weatherSlot(slot: Slot): slot is RequiredSlot {
  return slot === "top" || slot === "bottom" || slot === "footwear";
}

// Narrow the occasion matches for a slot by the weather. Two preferences, each dropped
// (and reported) if it would leave the slot empty:
//  - warmth: items too light or too heavy for the temperature are left out;
//  - rain: when it is wet, tops and footwear must be rain-ready.
function narrow<T extends OutfitItem>(matching: T[], slot: Slot, cond: Conditions | null) {
  if (!cond || !weatherSlot(slot) || matching.length === 0) {
    return { pool: matching, warmthFellBack: false, rainFellBack: false };
  }

  let pool = matching;
  const warm = pool.filter((it) => fitsWeather(it.warmth, cond.band, slot));
  const warmthFellBack = warm.length === 0;
  if (!warmthFellBack) pool = warm;

  let rainFellBack = false;
  if (cond.wet && (slot === "top" || slot === "footwear")) {
    const dry = pool.filter((it) => it.rain_ready);
    rainFellBack = dry.length === 0;
    if (!rainFellBack) pool = dry;
  }
  return { pool, warmthFellBack, rainFellBack };
}

// Every item that fits this slot and the chosen occasion/formality, in the order given,
// narrowed by the weather when conditions are given.
export function candidatesFor<T extends OutfitItem>(
  items: T[],
  slot: Slot,
  occasion: Occasion,
  formality: Formality,
  cond: Conditions | null = null
): T[] {
  const matching = items.filter((it) => slotOf(it) === slot && matchesFilter(it, occasion, formality));
  return narrow(matching, slot, cond).pool;
}

// Where the weather couldn't be honoured for a slot, so the screen can say so.
export function weatherNotes<T extends OutfitItem>(
  items: T[],
  slot: Slot,
  occasion: Occasion,
  formality: Formality,
  cond: Conditions | null
): { warmth: boolean; rain: boolean } {
  const matching = items.filter((it) => slotOf(it) === slot && matchesFilter(it, occasion, formality));
  const { warmthFellBack, rainFellBack } = narrow(matching, slot, cond);
  return { warmth: warmthFellBack, rain: rainFellBack };
}

// The item shown in a slot: the user's pick if it still exists and belongs in
// the slot (it may not match the occasion, on purpose), otherwise the first match.
export function chosenItem<T extends OutfitItem>(items: T[], slot: Slot, selection: Selection, candidates: T[]): T | undefined {
  const pickedId = selection[slot];
  if (pickedId) {
    const picked = items.find((it) => it.id === pickedId && slotOf(it) === slot);
    if (picked) return picked;
  }
  return candidates[0];
}

// Auto-swap: the next candidate after the current one, wrapping around. If the
// current item isn't one of the candidates, start from the first.
export function nextCandidate<T extends { id: string }>(candidates: T[], currentId: string | undefined): T | undefined {
  if (candidates.length === 0) return undefined;
  const index = candidates.findIndex((c) => c.id === currentId);
  return candidates[(index + 1) % candidates.length];
}

// Whether auto-swap would actually change what is shown.
export function canAutoSwap<T extends { id: string }>(candidates: T[], currentId: string | undefined): boolean {
  const next = nextCandidate(candidates, currentId);
  return next !== undefined && next.id !== currentId;
}

// Swap Entire Outfit: pick again for every slot. Where there is more than one
// choice, the new pick differs from what is showing now.
export function randomizeSelection<T extends OutfitItem>(
  items: T[],
  occasion: Occasion,
  formality: Formality,
  current: Selection,
  rng: () => number = Math.random,
  cond: Conditions | null = null
): Selection {
  const next: Selection = {};
  for (const slot of ALL_SLOTS) {
    const candidates = candidatesFor(items, slot, occasion, formality, cond);
    if (candidates.length === 0) continue;
    const showing = chosenItem(items, slot, current, candidates);
    const options = candidates.length > 1 ? candidates.filter((c) => c.id !== showing?.id) : candidates;
    next[slot] = options[Math.floor(rng() * options.length)].id;
  }
  return next;
}
