"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import { v4 as uuidv4 } from "uuid";

type Item = {
  id: string;
  name: string;
  type: string;
  color_primary: string | null;
  brand: string | null;
  created_at: string;
  image_path: string | null;
  category: string | null;
  subcategory: string | null;
  occasions: string[] | null;
  formality: string[] | null;
};

type ItemWithUrl = Item & { image_url?: string | null };

const CATEGORIES = ["top", "bottom", "footwear", "accessory"] as const;
const SUBCATEGORIES = ["headgear", "eyewear", "watch", "bracelet", "belt", "bag", "socks", "other"] as const;
const OCCASIONS = ["work", "wfh", "dining", "date", "casual_hangout", "special_event", "travel", "outdoor", "gym"] as const;
const FORMALITY = ["casual", "smart_casual", "business_casual", "formal"] as const;

function toggleValue(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export default function ClosetPage() {
  const [items, setItems] = useState<ItemWithUrl[]>([]);
  const [status, setStatus] = useState<string>("");
  const [name, setName] = useState("");
  const [type, setType] = useState("shirt");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("top");
  const [subcategory, setSubcategory] = useState<string>("");
  const [occasions, setOccasions] = useState<string[]>([]);
  const [formality, setFormality] = useState<string[]>([]);

  // for per-item image upload
  const hiddenFileRef = useRef<HTMLInputElement | null>(null);
  const [targetItemId, setTargetItemId] = useState<string | null>(null);

  async function createSigned(it: Item): Promise<ItemWithUrl> {
    if (!it.image_path) return { ...it, image_url: null };
    const { data: urlData, error: urlErr } = await supabase
      .storage
      .from("wardrobe")
      .createSignedUrl(it.image_path, 60 * 60); // 1 hour
    return { ...it, image_url: urlErr ? null : urlData?.signedUrl ?? null };
  }

  async function loadItems() {
    setStatus("Loading...");
    const { data, error } = await supabase
      .from("items")
      .select("id,name,type,color_primary,brand,created_at,image_path,category,subcategory,occasions,formality")
      .order("created_at", { ascending: false });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    const withUrls = await Promise.all((data || []).map(createSigned));
    setItems(withUrls);
    setStatus("");
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Please go to /auth and sign in, then return here.");
        return;
      }
      await loadItems();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upload a file to wardrobe/<userId>/<uuid>.<ext>
  async function uploadImageForUser(userId: string, file: File) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const filename = `${uuidv4()}.${ext}`;
    const path = `${userId}/${filename}`;

    const { error } = await supabase.storage
      .from("wardrobe")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (error) throw new Error(error.message);
    return path;
  }

  // Add NEW item (name + type + optional image)
  const insertItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Adding...");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus("Please sign in at /auth, then return here.");
      return;
    }
    if (!name.trim()) {
      setStatus("Please enter a name.");
      return;
    }

    let imagePath: string | null = null;
    try {
      if (file) {
        imagePath = await uploadImageForUser(user.id, file);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      setStatus("Upload failed: " + message);
      return;
    }

    const { error } = await supabase.from("items").insert({
      user_id: user.id,
      name: name.trim(),
      type: type.trim(),
      color_primary: null,
      brand: null,
      colors: null,
      notes: null,
      image_path: imagePath,
      season: null,
      category: category || null,
      subcategory: category === "accessory" ? (subcategory || null) : null,
      occasions: occasions.length ? occasions : null,
      formality: formality.length ? formality : null,
    });

    if (error) {
      setStatus("Insert failed: " + error.message);
    } else {
      setName("");
      setType("shirt");
      setFile(null);
      setCategory("top");
      setSubcategory("");
      setOccasions([]);
      setFormality([]);
      const addFormFile = document.querySelector('#add-form-file') as HTMLInputElement | null;
      if (addFormFile) addFormFile.value = "";
      setStatus("Added!");
      await loadItems();
    }
  };

  // Change/attach image for an EXISTING item
  const onClickChangeImage = (itemId: string) => {
    setTargetItemId(itemId);
    hiddenFileRef.current?.click();
  };

  const onFileChosenForItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (!chosen || !targetItemId) return;

    setStatus("Uploading image...");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus("Please sign in at /auth, then return here.");
      e.target.value = "";
      return;
    }

    try {
      const newPath = await uploadImageForUser(user.id, chosen);
      const { error } = await supabase
        .from("items")
        .update({ image_path: newPath })
        .eq("id", targetItemId)
        .eq("user_id", user.id); // RLS safety

      if (error) {
        setStatus("Update failed: " + error.message);
      } else {
        setStatus("Image updated!");
        await loadItems();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      setStatus("Upload failed: " + message);
    } finally {
      e.target.value = "";
      setTargetItemId(null);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <NavBar />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold">Closet</h1>

        {/* Status / messages */}
        {status && <p className="mt-3 text-sm">{status}</p>}

        {/* Add Item form */}
        <form onSubmit={insertItem} className="mt-6 grid gap-3 sm:grid-cols-4">
          <input
            type="text"
            placeholder="Item name (e.g., Navy Polo)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-3 py-2"
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="shirt">shirt</option>
            <option value="tee">tee</option>
            <option value="pants">pants</option>
            <option value="shorts">shorts</option>
            <option value="shoes">shoes</option>
            <option value="jacket">jacket</option>
            <option value="hoodie">hoodie</option>
          </select>

          <input
            id="add-form-file"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="border rounded px-3 py-2"
          />

          <button type="submit" className="border rounded px-3 py-2 hover:bg-slate-50">
            Add Item
          </button>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setSubcategory("");
            }}
            className="border rounded px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {category === "accessory" && (
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">— subcategory —</option>
              {SUBCATEGORIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          <fieldset className="border rounded px-3 py-2 sm:col-span-2">
            <legend className="text-sm text-slate-600 px-1">Occasions</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {OCCASIONS.map((o) => (
                <label key={o} className="text-sm flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={occasions.includes(o)}
                    onChange={() => setOccasions(toggleValue(occasions, o))}
                  />
                  {o}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="border rounded px-3 py-2 sm:col-span-2">
            <legend className="text-sm text-slate-600 px-1">Formality</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {FORMALITY.map((f) => (
                <label key={f} className="text-sm flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={formality.includes(f)}
                    onChange={() => setFormality(toggleValue(formality, f))}
                  />
                  {f}
                </label>
              ))}
            </div>
          </fieldset>
        </form>

        {/* Hidden input used for per-item "Change image" */}
        <input
          ref={hiddenFileRef}
          type="file"
          accept="image/*"
          onChange={onFileChosenForItem}
          className="hidden"
        />

        {/* Items grid */}
        <div className="grid gap-4 mt-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.id} className="border rounded-lg p-4">
              {/* Thumbnail if present */}
              {it.image_url ? (
                <img
                  src={it.image_url}
                  alt={it.name}
                  className="w-full h-40 object-cover rounded mb-3"
                />
              ) : (
                <div className="w-full h-40 bg-slate-100 rounded mb-3 flex items-center justify-center text-slate-400 text-sm">
                  No image
                </div>
              )}

              <div className="text-xs text-slate-500">
                {new Date(it.created_at).toLocaleString()}
              </div>
              <div className="mt-1 font-semibold">{it.name}</div>
              <div className="text-sm text-slate-600">{it.type}</div>
              {it.color_primary && <div className="text-sm">Color: {it.color_primary}</div>}
              {it.brand && <div className="text-sm">Brand: {it.brand}</div>}
              {it.category && (
                <div className="text-xs text-slate-500 mt-1">
                  {it.category}{it.subcategory ? ` / ${it.subcategory}` : ""}
                </div>
              )}
              {it.formality && it.formality.length > 0 && (
                <div className="text-xs text-slate-500">Formality: {it.formality.join(", ")}</div>
              )}
              {it.occasions && it.occasions.length > 0 && (
                <div className="text-xs text-slate-500">Occasions: {it.occasions.join(", ")}</div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  className="text-sm border rounded px-2 py-1 hover:bg-slate-50"
                  onClick={() => onClickChangeImage(it.id)}
                  type="button"
                >
                  {it.image_url ? "Change image" : "Add image"}
                </button>
              </div>
            </div>
          ))}

          {items.length === 0 && !status && (
            <p className="text-slate-600 mt-4">No items yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
