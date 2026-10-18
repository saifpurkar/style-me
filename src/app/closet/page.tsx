"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import { isSlot, slotOf, type Slot } from "@/lib/outfit";
import { shrinkToJpegBase64 } from "@/lib/image";
import type { TagSuggestion } from "@/lib/tagging";
import { chipCls, fieldCls, labelCls, outlineBtn, primaryBtn } from "@/lib/ui";

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

function pretty(value: string): string {
  return value.replace(/_/g, " ");
}

function CheckGroup({
  legend,
  options,
  selected,
  onToggle,
  className = "",
}: {
  legend: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  className?: string;
}) {
  return (
    <fieldset className={`border border-ink/30 rounded-[2px] px-3 py-2 ${className}`}>
      <legend className={`${labelCls} px-1`}>{legend}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {options.map((o) => (
          <label key={o} className="text-xs flex items-center gap-1 text-ink">
            <input
              type="checkbox"
              className="accent-denim"
              checked={selected.includes(o)}
              onChange={() => onToggle(o)}
            />
            {pretty(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ClosetPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemWithUrl[]>([]);

  // "Pick mode": the Outfit screen sends us here as /closet?pick=<slot> to
  // choose one item for that slot, then we go back to /outfit.
  const [pickSlot, setPickSlot] = useState<Slot | null>(null);
  useEffect(() => {
    const slot = new URLSearchParams(window.location.search).get("pick");
    if (slot && isSlot(slot)) setPickSlot(slot);
  }, []);
  const [status, setStatus] = useState<string>("");
  const [name, setName] = useState("");
  const [type, setType] = useState("shirt");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("top");
  const [subcategory, setSubcategory] = useState<string>("");
  const [occasions, setOccasions] = useState<string[]>([]);
  const [formality, setFormality] = useState<string[]>([]);

  // Add Item photo: one input opens the camera (phones), the other the photo library.
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // AI suggestions for the photo (fills the form; everything stays editable)
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState("");
  const suggestRun = useRef(0);

  // for per-item image upload
  const hiddenFileRef = useRef<HTMLInputElement | null>(null);
  const [targetItemId, setTargetItemId] = useState<string | null>(null);

  // for per-item tag editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<string>("top");
  const [editSubcategory, setEditSubcategory] = useState<string>("");
  const [editOccasions, setEditOccasions] = useState<string[]>([]);
  const [editFormality, setEditFormality] = useState<string[]>([]);

  // Ask the server for tag suggestions for a photo and pre-fill the form with them.
  async function suggestFromPhoto(photo: File) {
    const run = ++suggestRun.current;
    setSuggesting(true);
    setSuggestNote("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSuggestNote("Sign in to get AI suggestions.");
        return;
      }
      const image = await shrinkToJpegBase64(photo);
      const res = await fetch("/api/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image, mediaType: "image/jpeg" }),
      });
      const json = await res.json().catch(() => ({}));
      if (run !== suggestRun.current) return; // a newer photo was chosen meanwhile
      if (!res.ok) {
        setSuggestNote(`${json.error ?? "AI suggestions failed."} You can fill the fields in yourself.`);
        return;
      }
      const s: TagSuggestion = json.suggestion;
      setName((current) => (current.trim() ? current : s.name));
      setType(s.type);
      setCategory(s.category);
      setSubcategory(s.subcategory ?? "");
      setOccasions(s.occasions);
      setFormality(s.formality);
      setSuggestNote("AI filled these in from your photo. Check them before adding.");
    } catch {
      if (run === suggestRun.current) {
        setSuggestNote("Couldn't read that photo for suggestions. You can fill the fields in yourself.");
      }
    } finally {
      if (run === suggestRun.current) setSuggesting(false);
    }
  }

  // A photo was chosen (camera or library): keep it, then ask for suggestions.
  function choosePhoto(photo: File | null) {
    setFile(photo);
    suggestRun.current++; // forget any suggestion still on its way
    setSuggesting(false);
    setSuggestNote("");
    if (photo) void suggestFromPhoto(photo);
  }

  // Show a small preview of the chosen photo, and free it when it changes.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
      choosePhoto(null);
      setCategory("top");
      setSubcategory("");
      setOccasions([]);
      setFormality([]);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
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

  // In pick mode only show items that belong in the slot being filled.
  const visibleItems = pickSlot ? items.filter((it) => slotOf(it) === pickSlot) : items;

  const pickItem = (it: ItemWithUrl) => {
    if (!pickSlot) return;
    try {
      sessionStorage.setItem("styleme.pick.v1", JSON.stringify({ slot: pickSlot, itemId: it.id }));
    } catch {
      // If storage is unavailable the outfit simply keeps its current item.
    }
    router.push("/outfit");
  };

  // Begin editing tags for an EXISTING item
  const startEdit = (it: ItemWithUrl) => {
    setEditingId(it.id);
    setEditCategory(it.category || "top");
    setEditSubcategory(it.subcategory || "");
    setEditOccasions(it.occasions || []);
    setEditFormality(it.formality || []);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (itemId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus("Please sign in at /auth, then return here.");
      return;
    }

    const { error } = await supabase
      .from("items")
      .update({
        category: editCategory || null,
        subcategory: editCategory === "accessory" ? (editSubcategory || null) : null,
        occasions: editOccasions.length ? editOccasions : null,
        formality: editFormality.length ? editFormality : null,
      })
      .eq("id", itemId)
      .eq("user_id", user.id); // RLS safety

    if (error) {
      setStatus("Update failed: " + error.message);
    } else {
      setStatus("Tags updated!");
      setEditingId(null);
      await loadItems();
    }
  };

  return (
    <main className="min-h-screen bg-charcoal text-paper font-body">
      <NavBar />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display font-semibold text-3xl text-paper">
          {pickSlot ? `Choose ${pickSlot}` : "Closet"}
        </h1>

        {pickSlot && (
          <p className="mt-2 text-sm text-paper/70">
            Pick an item for your outfit&apos;s {pickSlot} slot, or{" "}
            <a href="/outfit" className="underline hover:text-brass">go back to the outfit</a>.
          </p>
        )}

        {/* Status / messages */}
        {status && <p className="mt-3 text-sm text-paper/80">{status}</p>}

        {/* Add Item form (hidden while picking an item for an outfit) */}
        <form
          onSubmit={insertItem}
          className={`mt-6 bg-paper text-ink border border-dashed border-ink/40 rounded-[2px] p-5 grid gap-4 sm:grid-cols-2 ${pickSlot ? "hidden" : ""}`}
        >
          <div className="sm:col-span-2 font-utility text-xs uppercase tracking-wider text-denim">Add item</div>

          <label className="grid gap-1">
            <span className={labelCls}>Name</span>
            <input
              type="text"
              placeholder="e.g., Navy Polo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldCls}
            />
          </label>

          <label className="grid gap-1">
            <span className={labelCls}>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={fieldCls}>
              <option value="shirt">shirt</option>
              <option value="tee">tee</option>
              <option value="pants">pants</option>
              <option value="shorts">shorts</option>
              <option value="shoes">shoes</option>
              <option value="jacket">jacket</option>
              <option value="hoodie">hoodie</option>
              <option value="accessory">accessory</option>
            </select>
          </label>

          {/* Photo: Take Photo and Upload from Library are both offered */}
          <div className="sm:col-span-2 grid gap-2">
            <span className={labelCls}>Photo</span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={outlineBtn} onClick={() => cameraInputRef.current?.click()}>
                Take photo
              </button>
              <button type="button" className={outlineBtn} onClick={() => libraryInputRef.current?.click()}>
                Upload from library
              </button>
              {file && (
                <>
                  <span className="text-xs text-ink/70 truncate max-w-[14rem]">{file.name}</span>
                  <button
                    type="button"
                    className="font-utility text-[10px] uppercase tracking-wider text-ink/60 underline hover:text-ink"
                    onClick={() => {
                      choosePhoto(null);
                      if (cameraInputRef.current) cameraInputRef.current.value = "";
                      if (libraryInputRef.current) libraryInputRef.current.value = "";
                    }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
            {previewUrl && (
              <img src={previewUrl} alt="Selected photo" className="h-24 w-24 object-cover rounded-[2px] border border-ink/20" />
            )}
            {(suggesting || suggestNote) && (
              <div className="flex flex-wrap items-center gap-3" aria-live="polite">
                <span className="text-xs text-ink/70">
                  {suggesting ? "Looking at your photo…" : suggestNote}
                </span>
                {!suggesting && file && (
                  <button
                    type="button"
                    className="font-utility text-[10px] uppercase tracking-wider text-denim underline hover:text-ink"
                    onClick={() => void suggestFromPhoto(file)}
                  >
                    Suggest again
                  </button>
                )}
              </div>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>

          <label className="grid gap-1">
            <span className={labelCls}>Category</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory("");
              }}
              className={fieldCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          {category === "accessory" && (
            <label className="grid gap-1">
              <span className={labelCls}>Subcategory</span>
              <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={fieldCls}>
                <option value="">— subcategory —</option>
                {SUBCATEGORIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}

          <CheckGroup
            legend="Occasions"
            options={OCCASIONS}
            selected={occasions}
            onToggle={(o) => setOccasions(toggleValue(occasions, o))}
            className="sm:col-span-2"
          />
          <CheckGroup
            legend="Formality"
            options={FORMALITY}
            selected={formality}
            onToggle={(f) => setFormality(toggleValue(formality, f))}
            className="sm:col-span-2"
          />

          <div className="sm:col-span-2">
            <button type="submit" className={primaryBtn}>Add item</button>
          </div>
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
          {visibleItems.map((it) => (
            <div key={it.id} className="bg-paper text-ink border border-ink/20 rounded-[2px] p-4">
              {/* Thumbnail if present */}
              {it.image_url ? (
                <img
                  src={it.image_url}
                  alt={it.name}
                  className="w-full h-40 object-cover rounded-[2px] mb-3"
                />
              ) : (
                <div className="w-full h-40 bg-ink/5 rounded-[2px] mb-3 flex items-center justify-center text-ink/40 text-sm">
                  No image
                </div>
              )}

              <div className="font-semibold">{it.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink/60">
                <span>{it.type}</span>
                <span>·</span>
                <span>{new Date(it.created_at).toLocaleDateString()}</span>
              </div>
              {it.color_primary && <div className="text-sm">Color: {it.color_primary}</div>}
              {it.brand && <div className="text-sm">Brand: {it.brand}</div>}

              {editingId === it.id ? (
                <div className="mt-3 grid gap-2 border-t border-dashed border-ink/30 pt-3">
                  <select
                    value={editCategory}
                    onChange={(e) => {
                      setEditCategory(e.target.value);
                      setEditSubcategory("");
                    }}
                    className={fieldCls}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {editCategory === "accessory" && (
                    <select
                      value={editSubcategory}
                      onChange={(e) => setEditSubcategory(e.target.value)}
                      className={fieldCls}
                    >
                      <option value="">— subcategory —</option>
                      {SUBCATEGORIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}

                  <CheckGroup
                    legend="Occasions"
                    options={OCCASIONS}
                    selected={editOccasions}
                    onToggle={(o) => setEditOccasions(toggleValue(editOccasions, o))}
                  />
                  <CheckGroup
                    legend="Formality"
                    options={FORMALITY}
                    selected={editFormality}
                    onToggle={(f) => setEditFormality(toggleValue(editFormality, f))}
                  />

                  <div className="flex gap-2">
                    <button type="button" className={primaryBtn} onClick={() => saveEdit(it.id)}>
                      Save
                    </button>
                    <button type="button" className={outlineBtn} onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {it.category && (
                    <div className="mt-2 font-utility text-[10px] uppercase tracking-wider text-denim">
                      {it.category}{it.subcategory ? ` / ${it.subcategory}` : ""}
                    </div>
                  )}
                  {it.formality && it.formality.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {it.formality.map((f) => (
                        <span key={f} className={chipCls}>{pretty(f)}</span>
                      ))}
                    </div>
                  )}
                  {it.occasions && it.occasions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {it.occasions.map((o) => (
                        <span key={o} className={`${chipCls} border-brass text-brass`}>{pretty(o)}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {pickSlot ? (
                      <button className={primaryBtn} onClick={() => pickItem(it)} type="button">
                        Use this item
                      </button>
                    ) : (
                      <>
                        <button className={outlineBtn} onClick={() => onClickChangeImage(it.id)} type="button">
                          {it.image_url ? "Change image" : "Add image"}
                        </button>
                        <button className={outlineBtn} onClick={() => startEdit(it)} type="button">
                          Edit tags
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {visibleItems.length === 0 && !status && (
            <p className="text-paper/70 mt-4">
              {pickSlot ? `No ${pickSlot} items in your closet yet.` : "No items yet."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
