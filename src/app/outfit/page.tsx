"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";

type Item = {
  id: string;
  name: string;
  type: string;                 // shirt, tee, pants, shorts, shoes, jacket, hoodie
  color_primary: string | null;
  brand: string | null;
  created_at: string;
  image_path: string | null;
  occasions?: string[] | null;  // may be null in your current data
  season?: string[] | null;
};

type ItemWithUrl = Item & { image_url?: string | null };
type Occasion = "casual" | "formal" | "gym" | "hike";

export default function OutfitPage() {
  const [status, setStatus] = useState<string>("");
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [items, setItems] = useState<ItemWithUrl[]>([]);
  const [occasion, setOccasion] = useState<Occasion>("casual");
  const [suggestion, setSuggestion] = useState<ItemWithUrl[] | null>(null);

  useEffect(() => {
    (async () => {
      setStatus("Loading…");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Please go to /auth and sign in, then return here.");
        return;
      }
      // Load selfie (from profiles.selfie_path)
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

      // Load closet items
      const { data: rawItems, error: iErr } = await supabase
        .from("items")
        .select("id,name,type,color_primary,brand,created_at,image_path,occasions,season")
        .order("created_at", { ascending: false });

      if (iErr) {
        setStatus("Could not load items: " + iErr.message);
        return;
      }

      // Create signed URLs for any images
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

  // Simple rule-based filters for occasion
  const filteredByOccasion = useMemo(() => {
    if (!items.length) return items;
    // If item has occasions, use them; otherwise include as general-purpose
    return items.filter((it) => {
      if (!it.occasions || it.occasions.length === 0) return true;
      return it.occasions.includes(occasion);
    });
  }, [items, occasion]);

  function pick(array: ItemWithUrl[] | null | undefined, types: string[]): ItemWithUrl[] {
    const pool = (array || []).filter((it) => types.includes(it.type));
    // Choose first viable in each type category to keep it deterministic
    const chosen: ItemWithUrl[] = [];
    for (const t of types) {
      const found = pool.find((it) => it.type === t);
      if (found) chosen.push(found);
    }
    return chosen;
  }

  function suggestOutfit() {
    if (!filteredByOccasion?.length) {
      setStatus("No closet items available for suggestions yet.");
      setSuggestion(null);
      return;
    }

    // Minimal rules per occasion
    let typesOrder: string[] = [];
    if (occasion === "formal") {
      typesOrder = ["shirt", "pants", "shoes"]; // (optionally add jacket later)
    } else if (occasion === "gym") {
      typesOrder = ["tee", "shorts", "shoes"];
    } else if (occasion === "hike") {
      typesOrder = ["tee", "pants", "shoes"]; // add jacket if cold later
    } else {
      // casual
      typesOrder = ["tee", "pants", "shoes"];
      // fallbacks: if no tee, try shirt
      if (!filteredByOccasion.some((i) => i.type === "tee") && filteredByOccasion.some((i) => i.type === "shirt")) {
        typesOrder = ["shirt", "pants", "shoes"];
      }
    }

    const chosen = pick(filteredByOccasion, typesOrder);

    // Ensure we have at least top + bottom
    const hasTop = chosen.some((c) => c.type === "tee" || c.type === "shirt" || c.type === "jacket" || c.type === "hoodie");
    const hasBottom = chosen.some((c) => c.type === "pants" || c.type === "shorts");
    if (!hasTop || !hasBottom) {
      setStatus("Not enough variety in closet for this occasion (need a top and a bottom). Try adding more items.");
      setSuggestion(null);
      return;
    }

    setStatus("");
    setSuggestion(chosen);
  }

  return (
    <main className="min-h-screen bg-white">
      <NavBar />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold">Outfit Suggestions</h1>
        <p className="text-slate-600 mt-2">
          Choose an occasion and generate a simple outfit from your closet. We’ll improve the AI later.
        </p>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="text-sm">Occasion:</label>
          <select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value as Occasion)}
            className="border rounded px-3 py-2"
          >
            <option value="casual">casual</option>
            <option value="formal">formal</option>
            <option value="gym">gym</option>
            <option value="hike">hike</option>
          </select>

          <button
            onClick={suggestOutfit}
            className="border rounded px-3 py-2 hover:bg-slate-50"
          >
            Suggest Outfit
          </button>
        </div>

        {/* Selfie preview */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold">Your Selfie</h2>
          {selfieUrl ? (
            <img
              src={selfieUrl}
              alt="Your selfie"
              className="mt-3 w-full max-w-sm rounded-lg border"
            />
          ) : (
            <p className="mt-3 text-slate-600">
              No selfie found. Go to <a className="underline" href="/selfie">/selfie</a> to upload one.
            </p>
          )}
        </div>

        {/* Suggestion */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold">Suggested Outfit</h2>
          {status && <p className="mt-2 text-sm">{status}</p>}

          {suggestion ? (
            <div className="grid gap-4 mt-4 sm:grid-cols-3">
              {suggestion.map((it) => (
                <div key={it.id} className="border rounded-lg p-3">
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.name}
                      className="w-full h-40 object-cover rounded mb-2"
                    />
                  ) : (
                    <div className="w-full h-40 bg-slate-100 rounded mb-2 flex items-center justify-center text-slate-400 text-sm">
                      No image
                    </div>
                  )}
                  <div className="font-medium">{it.name}</div>
                  <div className="text-sm text-slate-600">{it.type}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-slate-600">Click “Suggest Outfit” to generate a combo.</p>
          )}
        </div>
      </section>
    </main>
  );
}
