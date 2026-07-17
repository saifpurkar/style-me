"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";

type Item = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  occasions: string[] | null;
  formality: string[] | null;
  image_path: string | null;
  created_at: string;
};

type ItemWithUrl = Item & { image_url?: string | null };

const OCCASIONS = ["work", "wfh", "dining", "date", "casual_hangout", "special_event", "travel", "outdoor", "gym"] as const;
type Occasion = (typeof OCCASIONS)[number];

const FORMALITY = ["casual", "smart_casual", "business_casual", "formal"] as const;
type Formality = (typeof FORMALITY)[number];

const REQUIRED_SLOTS = ["top", "bottom", "footwear"] as const;
type RequiredSlot = (typeof REQUIRED_SLOTS)[number];

// Accessory slot is derived from an item's subcategory (subcategory values map
// 1:1 to slot names, except 'socks'/'other' which have no flat-lay slot).
const ACCESSORY_SLOTS = ["headgear", "eyewear", "watch", "bracelet", "belt", "bag"] as const;
type AccessorySlot = (typeof ACCESSORY_SLOTS)[number];

type Slot = RequiredSlot | AccessorySlot;

function label(value: string): string {
  if (value === "wfh") return "WFH";
  return value
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default function OutfitPage() {
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<ItemWithUrl[]>([]);
  const [occasion, setOccasion] = useState<Occasion>("casual_hangout");
  const [formality, setFormality] = useState<Formality>("casual");

  const showFormality = occasion !== "gym";

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
        .select("id,name,category,subcategory,occasions,formality,image_path,created_at")
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

  const matches = useMemo(() => {
    return items.filter((it) => {
      if (!it.occasions?.includes(occasion)) return false;
      if (showFormality && !it.formality?.includes(formality)) return false;
      return true;
    });
  }, [items, occasion, formality, showFormality]);

  const outfit = useMemo(() => {
    const slots: Record<Slot, ItemWithUrl | undefined> = {
      top: undefined,
      bottom: undefined,
      footwear: undefined,
      headgear: undefined,
      eyewear: undefined,
      watch: undefined,
      bracelet: undefined,
      belt: undefined,
      bag: undefined,
    };

    for (const slot of REQUIRED_SLOTS) {
      slots[slot] = matches.find((it) => it.category === slot);
    }
    for (const slot of ACCESSORY_SLOTS) {
      slots[slot] = matches.find((it) => it.category === "accessory" && it.subcategory === slot);
    }

    const missingRequired = REQUIRED_SLOTS.filter((slot) => !slots[slot]);

    return { slots, missingRequired };
  }, [matches]);

  const occasionLabel = label(occasion);
  const formalityLabel = label(formality);

  return (
    <main className="min-h-screen bg-white">
      <NavBar />
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">Outfit</h1>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="text-sm">Occasion:</label>
          <select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value as Occasion)}
            className="border rounded px-3 py-2"
          >
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>{label(o)}</option>
            ))}
          </select>

          {showFormality && (
            <>
              <label className="text-sm">Formality:</label>
              <select
                value={formality}
                onChange={(e) => setFormality(e.target.value as Formality)}
                className="border rounded px-3 py-2"
              >
                {FORMALITY.map((f) => (
                  <option key={f} value={f}>{label(f)}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {status && <p className="mt-4 text-sm">{status}</p>}

        {!status && outfit.missingRequired.length > 0 && (
          <div className="mt-6 text-sm text-red-600">
            {outfit.missingRequired.map((slot) => (
              <p key={slot}>
                No {slot} tagged for {showFormality ? `${formalityLabel} ` : ""}{occasionLabel} yet.
              </p>
            ))}
          </div>
        )}

        {!status && outfit.missingRequired.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-4">
            {outfit.slots.headgear && <OutfitCard item={outfit.slots.headgear} />}
            {outfit.slots.eyewear && <OutfitCard item={outfit.slots.eyewear} />}

            <div className="flex items-start justify-center gap-4">
              {outfit.slots.watch && <OutfitCard item={outfit.slots.watch} />}
              <OutfitCard item={outfit.slots.top!} />
              {outfit.slots.bracelet && <OutfitCard item={outfit.slots.bracelet} />}
            </div>

            {outfit.slots.belt && <OutfitCard item={outfit.slots.belt} />}

            <OutfitCard item={outfit.slots.bottom!} />

            <div className="flex items-start justify-center gap-4">
              <OutfitCard item={outfit.slots.footwear!} />
              {outfit.slots.bag && <OutfitCard item={outfit.slots.bag} />}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function OutfitCard({ item }: { item: ItemWithUrl }) {
  return (
    <div className="border rounded-lg p-3 w-40">
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover rounded mb-2" />
      ) : (
        <div className="w-full h-32 bg-slate-100 rounded mb-2 flex items-center justify-center text-slate-400 text-xs">
          No image
        </div>
      )}
      <div className="text-sm font-medium">{item.name}</div>
    </div>
  );
}
