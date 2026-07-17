"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";

type Item = {
  id: string;
  name: string;
  type: string;
  image_path: string | null;
};

type ItemWithUrl = Item & { image_url?: string | null };

type Category = "top" | "bottom" | "shoes";

const CATEGORY_TYPES: Record<Category, string[]> = {
  top: ["tee", "shirt", "hoodie", "jacket"],
  bottom: ["pants", "shorts"],
  shoes: ["shoes"],
};

// Rough vertical placement + size for each overlay slot, as a % of the selfie frame.
const OVERLAY_STYLE: Record<Category, React.CSSProperties> = {
  top: { top: "18%", left: "20%", width: "60%", height: "34%" },
  bottom: { top: "50%", left: "24%", width: "52%", height: "32%" },
  shoes: { top: "82%", left: "30%", width: "40%", height: "14%" },
};

export default function TryOnPage() {
  const [status, setStatus] = useState<string>("");
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [items, setItems] = useState<ItemWithUrl[]>([]);
  const [selected, setSelected] = useState<Record<Category, string | null>>({
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
        .select("id,name,type,image_path")
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

  const itemsByCategory = useMemo(() => {
    const grouped: Record<Category, ItemWithUrl[]> = { top: [], bottom: [], shoes: [] };
    for (const it of items) {
      for (const cat of Object.keys(CATEGORY_TYPES) as Category[]) {
        if (CATEGORY_TYPES[cat].includes(it.type)) grouped[cat].push(it);
      }
    }
    return grouped;
  }, [items]);

  function toggleSelect(cat: Category, itemId: string) {
    setSelected((prev) => ({
      ...prev,
      [cat]: prev[cat] === itemId ? null : itemId,
    }));
  }

  const selectedItems = (Object.keys(selected) as Category[])
    .map((cat) => ({ cat, item: items.find((it) => it.id === selected[cat]) }))
    .filter((x): x is { cat: Category; item: ItemWithUrl } => !!x.item);

  return (
    <main className="min-h-screen bg-white">
      <NavBar />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold">Try It On</h1>
        <p className="text-slate-600 mt-2">
          Pick a top, bottom, and pair of shoes from your closet to preview them over your selfie.
        </p>

        {status && <p className="mt-4 text-sm">{status}</p>}

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {/* Selfie + overlay preview */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Preview</h2>
            {selfieUrl ? (
              <div className="relative w-full max-w-sm aspect-[3/4] rounded-lg border overflow-hidden bg-slate-50">
                <img
                  src={selfieUrl}
                  alt="Your selfie"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {selectedItems.map(({ cat, item }) => (
                  <img
                    key={cat}
                    src={item.image_url ?? undefined}
                    alt={item.name}
                    className="absolute object-contain drop-shadow-lg opacity-90"
                    style={OVERLAY_STYLE[cat]}
                  />
                ))}
              </div>
            ) : (
              <p className="text-slate-600">
                No selfie found. Go to{" "}
                <a className="underline" href="/selfie">
                  /selfie
                </a>{" "}
                to upload one.
              </p>
            )}
          </div>

          {/* Pickers */}
          <div className="space-y-8">
            {(Object.keys(CATEGORY_TYPES) as Category[]).map((cat) => (
              <div key={cat}>
                <h2 className="text-xl font-semibold mb-3 capitalize">{cat}</h2>
                {itemsByCategory[cat].length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No {cat} items in your closet yet.
                  </p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {itemsByCategory[cat].map((it) => {
                      const isSelected = selected[cat] === it.id;
                      return (
                        <button
                          key={it.id}
                          onClick={() => toggleSelect(cat, it.id)}
                          className={`shrink-0 w-24 border rounded-lg p-2 text-left ${
                            isSelected ? "border-slate-900 ring-2 ring-slate-900" : "hover:bg-slate-50"
                          }`}
                        >
                          {it.image_url ? (
                            <img
                              src={it.image_url}
                              alt={it.name}
                              className="w-full h-20 object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-20 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-xs">
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
