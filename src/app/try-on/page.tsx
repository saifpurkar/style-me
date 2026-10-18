"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import { pageCls, panelCls } from "@/lib/ui";

type Item = {
  id: string;
  name: string;
  category: string | null;
  image_path: string | null;
};

type ItemWithUrl = Item & { image_url?: string | null };

type Slot = "top" | "bottom" | "shoes";

// Which item category fills each try-on slot.
const SLOT_CATEGORY: Record<Slot, string> = {
  top: "top",
  bottom: "bottom",
  shoes: "footwear",
};

const SLOT_LABEL: Record<Slot, string> = { top: "Top", bottom: "Bottom", shoes: "Shoes" };

// Rough vertical placement + size for each overlay slot, as a % of the selfie frame.
const OVERLAY_STYLE: Record<Slot, React.CSSProperties> = {
  top: { top: "18%", left: "20%", width: "60%", height: "34%" },
  bottom: { top: "50%", left: "24%", width: "52%", height: "32%" },
  shoes: { top: "82%", left: "30%", width: "40%", height: "14%" },
};

const SLOTS = Object.keys(SLOT_CATEGORY) as Slot[];

export default function TryOnPage() {
  const [status, setStatus] = useState<string>("");
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [items, setItems] = useState<ItemWithUrl[]>([]);
  const [selected, setSelected] = useState<Record<Slot, string | null>>({
    top: null,
    bottom: null,
    shoes: null,
  });

  useEffect(() => {
    (async () => {
      setStatus("Loading…");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Please go to /auth and sign in, then return here.");
        return;
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("selfie_path")
        .eq("id", user.id)
        .single();

      if (pErr) {
        setStatus("Could not load profile: " + pErr.message);
        return;
      }

      if (profile?.selfie_path) {
        const { data: sData, error: sErr } = await supabase.storage
          .from("wardrobe")
          .createSignedUrl(profile.selfie_path, 60 * 60);
        if (!sErr) setSelfieUrl(sData?.signedUrl ?? null);
      }

      const { data: rawItems, error: iErr } = await supabase
        .from("items")
        .select("id,name,category,image_path")
        .order("created_at", { ascending: false });

      if (iErr) {
        setStatus("Could not load items: " + iErr.message);
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

  const itemsBySlot = useMemo(() => {
    const grouped: Record<Slot, ItemWithUrl[]> = { top: [], bottom: [], shoes: [] };
    for (const it of items) {
      for (const slot of SLOTS) {
        if (it.category === SLOT_CATEGORY[slot]) grouped[slot].push(it);
      }
    }
    return grouped;
  }, [items]);

  function toggleSelect(slot: Slot, itemId: string) {
    setSelected((prev) => ({
      ...prev,
      [slot]: prev[slot] === itemId ? null : itemId,
    }));
  }

  const selectedItems = SLOTS
    .map((slot) => ({ slot, item: items.find((it) => it.id === selected[slot]) }))
    .filter((x): x is { slot: Slot; item: ItemWithUrl } => !!x.item);

  return (
    <main className={pageCls}>
      <NavBar />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display font-semibold text-3xl text-paper">Try it on</h1>
        <p className="text-paper/70 mt-2">
          Pick a top, bottom, and pair of shoes from your closet to preview them over your selfie.
        </p>

        {status && <p className="mt-4 text-sm text-paper/80">{status}</p>}

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {/* Selfie + overlay preview */}
          <div>
            <h2 className="font-display font-semibold text-xl mb-3">Preview</h2>
            {selfieUrl ? (
              <div className="relative w-full max-w-sm aspect-[3/4] rounded-[2px] border border-dashed border-paper/40 overflow-hidden bg-paper">
                <img
                  src={selfieUrl}
                  alt="Your selfie"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {selectedItems.map(({ slot, item }) => (
                  <img
                    key={slot}
                    src={item.image_url ?? undefined}
                    alt={item.name}
                    className="absolute object-contain drop-shadow-lg opacity-90"
                    style={OVERLAY_STYLE[slot]}
                  />
                ))}
              </div>
            ) : (
              <p className="text-paper/70">
                No selfie found. Go to{" "}
                <a className="underline hover:text-brass" href="/selfie">
                  the Selfie page
                </a>{" "}
                to add one.
              </p>
            )}
          </div>

          {/* Pickers */}
          <div className="space-y-6">
            {SLOTS.map((slot) => (
              <div key={slot} className={panelCls}>
                <h2 className="font-display font-semibold text-xl mb-3">{SLOT_LABEL[slot]}</h2>
                {itemsBySlot[slot].length === 0 ? (
                  <p className="text-sm text-ink/70">
                    No {SLOT_LABEL[slot].toLowerCase()} items in your closet yet.
                  </p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {itemsBySlot[slot].map((it) => {
                      const isSelected = selected[slot] === it.id;
                      return (
                        <button
                          key={it.id}
                          onClick={() => toggleSelect(slot, it.id)}
                          aria-pressed={isSelected}
                          className={`shrink-0 w-24 border rounded-[2px] p-2 text-left bg-paper text-ink ${
                            isSelected ? "border-denim ring-1 ring-denim" : "border-ink/20 hover:border-denim"
                          }`}
                        >
                          {it.image_url ? (
                            <img
                              src={it.image_url}
                              alt={it.name}
                              className="w-full h-20 object-cover rounded-[2px]"
                            />
                          ) : (
                            <div className="w-full h-20 bg-ink/5 rounded-[2px] flex items-center justify-center text-ink/40 text-xs">
                              No image
                            </div>
                          )}
                          <div className="mt-1 text-xs truncate">{it.name}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
