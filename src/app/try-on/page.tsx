"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Icon, { type IconName } from "@/components/Icon";
import { TONES, type Tone } from "@/lib/labels";
import { containerCls, h1Cls, linkBtn, mutedCls, pageCls, panelCls, primaryBtn } from "@/lib/ui";

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
      <div className={containerCls}>
        <h1 className={h1Cls}>Try it on</h1>
        <p className={`${mutedCls} mt-0.5`}>Pick a top, bottom and shoes to preview over your selfie.</p>

        {status && (
          <p className="mt-4 rounded-2xl bg-sand px-4 py-2.5 text-sm font-medium text-sand-ink" role="status">
            {status}
          </p>
        )}

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          {/* Selfie + overlay preview, in a mirror */}
          <div>
            {selfieUrl ? (
              <>
                <div className="mirror-frame mx-auto w-full max-w-sm">
                  <div className="mirror-glass relative aspect-[3/4] w-full">
                    <img
                      src={selfieUrl}
                      alt="Your selfie"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {selectedItems.map(({ slot, item }) => (
                      <img
                        key={slot}
                        src={item.image_url ?? undefined}
                        alt={item.name}
                        className="absolute object-contain opacity-90 drop-shadow-lg"
                        style={OVERLAY_STYLE[slot]}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <Link href="/selfie" className={linkBtn}>
                    Change selfie
                  </Link>
                </div>
              </>
            ) : (
              !status && (
                <div className={`${panelCls} text-center`}>
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lilac text-lilac-ink">
                    <Icon name="tryon" className="h-7 w-7" />
                  </span>
                  <p className="mt-3 text-base font-bold">No selfie yet</p>
                  <p className={`${mutedCls} mt-1`}>Add one and you can see your outfit on you.</p>
                  <Link href="/selfie" className={`${primaryBtn} mt-4`}>
                    <Icon name="selfie" className="h-4 w-4" />
                    Add a selfie
                  </Link>
                </div>
              )
            )}
          </div>

          {/* Pickers */}
          <div className="space-y-4">
            {SLOTS.map((slot) => (
              <div key={slot} className={panelCls}>
                <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${TONES[SLOT_TONE[slot]].soft}`}>
                    <Icon name={SLOT_ICON[slot]} className="h-4 w-4" />
                  </span>
                  {SLOT_LABEL[slot]}
                </h2>
                {itemsBySlot[slot].length === 0 ? (
                  <p className="text-sm text-ink/60">
                    No {SLOT_LABEL[slot].toLowerCase()} in your closet yet.
                  </p>
                ) : (
                  <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                    {itemsBySlot[slot].map((it) => {
                      const isSelected = selected[slot] === it.id;
                      return (
                        <button
                          key={it.id}
                          onClick={() => toggleSelect(slot, it.id)}
                          aria-pressed={isSelected}
                          className={`w-24 shrink-0 rounded-2xl bg-cream p-1.5 text-left transition ${
                            isSelected ? "ring-2 ring-coral" : "ring-1 ring-line hover:ring-ink/30"
                          }`}
                        >
                          {it.image_url ? (
                            <img src={it.image_url} alt={it.name} className="h-20 w-full rounded-xl object-cover" />
                          ) : (
                            <div className={`flex h-20 w-full items-center justify-center rounded-xl ${TONES[SLOT_TONE[slot]].soft}`}>
                              <Icon name={SLOT_ICON[slot]} className="h-6 w-6 opacity-70" />
                            </div>
                          )}
                          <div className="mt-1 truncate text-xs font-semibold">{it.name}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <NavBar />
    </main>
  );
}

const SLOT_ICON: Record<Slot, IconName> = { top: "top", bottom: "bottom", shoes: "footwear" };
const SLOT_TONE: Record<Slot, Tone> = { top: "sky", bottom: "lilac", shoes: "peach" };
