"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import { useRouter } from "next/navigation";
import { uploadItemPhoto } from "@/lib/photos";
import BulkUpload from "@/components/BulkUpload";
import { isSlot, slotOf, type Slot } from "@/lib/outfit";
import { shrinkToJpegBase64 } from "@/lib/image";
import type { TagSuggestion } from "@/lib/tagging";
import { chipCls, containerCls, fieldCls, h1Cls, h2Cls, labelCls, linkBtn, mutedCls, outlineBtn, pageCls, panelCls, primaryBtn } from "@/lib/ui";
import { WARMTH_LEVELS } from "@/lib/weather";
import { TONES, categoryTone, formalityTone, label, occasionTone, type Tone } from "@/lib/labels";
import Icon, { iconFor } from "@/components/Icon";

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
  warmth: string | null;
  rain_ready: boolean;
};

type ItemWithUrl = Item & { image_url?: string | null };

const CATEGORIES = ["top", "bottom", "footwear", "accessory"] as const;
const SUBCATEGORIES = ["headgear", "eyewear", "watch", "bracelet", "belt", "bag", "socks", "other"] as const;
const OCCASIONS = ["work", "wfh", "dining", "date", "casual_hangout", "special_event", "travel", "outdoor", "gym"] as const;
const FORMALITY = ["casual", "smart_casual", "business_casual", "formal"] as const;

function toggleValue(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

const filterPill = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold soft-shadow transition";
const iconBtn = "flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink/70 transition hover:bg-ink hover:text-white";

// An item still needs tagging if the outfit logic can't fully use it yet.
function needsTags(it: Item): boolean {
  if (!it.category || !it.occasions?.length || !it.formality?.length) return true;
  if (it.category === "accessory") return !it.subcategory;
  return !it.warmth;
}


// A group of tap-to-select pills (instead of tiny checkboxes).
function PillGroup({
  legend,
  options,
  selected,
  onToggle,
  toneOf,
  withIcons = false,
  className = "",
}: {
  legend: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  toneOf?: (value: string) => Tone;
  withIcons?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className={`${labelCls} mb-2`}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          const tone = TONES[toneOf ? toneOf(o) : "plain"];
          const glyph = withIcons ? iconFor(o) : null;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? tone.solid : "bg-cream text-ink/70 hover:text-ink"}`}
            >
              {glyph && <Icon name={glyph} className="h-3.5 w-3.5" />}
              {label(o)}
            </button>
          );
        })}
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

  // Closet filters, and the "add many photos" panel
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | (typeof CATEGORIES)[number]>("all");
  const [onlyNeedsTags, setOnlyNeedsTags] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // The + button in the tab bar comes here as /closet?add=1 to open the Add form.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add") === "1") setShowForm(true);
  }, []);

  const [name, setName] = useState("");
  const [type, setType] = useState("shirt");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("top");
  const [subcategory, setSubcategory] = useState<string>("");
  const [occasions, setOccasions] = useState<string[]>([]);
  const [formality, setFormality] = useState<string[]>([]);
  const [warmth, setWarmth] = useState<string>("");
  const [rainReady, setRainReady] = useState(false);

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editWarmth, setEditWarmth] = useState<string>("");
  const [editRainReady, setEditRainReady] = useState(false);

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
      setWarmth(s.warmth ?? "");
      setRainReady(s.rain_ready);
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
      .select("id,name,type,color_primary,brand,created_at,image_path,category,subcategory,occasions,formality,warmth,rain_ready")
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

  // Upload a (shrunken) photo to wardrobe/<userId>/<uuid>.<ext>
  const uploadImageForUser = uploadItemPhoto;

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
      warmth: warmth || null,
      rain_ready: rainReady,
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
      setWarmth("");
      setRainReady(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
      setStatus("Added!");
      setShowForm(false);
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

  // In pick mode only show items that belong in the slot being filled; the filters narrow it further.
  const needle = query.trim().toLowerCase();
  const slotItems = pickSlot ? items.filter((it) => slotOf(it) === pickSlot) : items;
  const visibleItems = slotItems.filter((it) => {
    if (needle && !it.name.toLowerCase().includes(needle)) return false;
    if (!pickSlot && categoryFilter !== "all" && it.category !== categoryFilter) return false;
    if (onlyNeedsTags && !needsTags(it)) return false;
    return true;
  });
  const needsTagsCount = slotItems.filter(needsTags).length;
  const filtering = needle !== "" || (!pickSlot && categoryFilter !== "all") || onlyNeedsTags;

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
    setEditWarmth(it.warmth || "");
    setEditRainReady(!!it.rain_ready);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  // Delete an item and its photo. Two taps (Delete, then "Yes, delete") so it can't happen by accident.
  const deleteItem = async (it: ItemWithUrl) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus("Please sign in at /auth, then return here.");
      return;
    }
    const { error } = await supabase.from("items").delete().eq("id", it.id).eq("user_id", user.id);
    if (error) {
      setStatus("Delete failed: " + error.message);
      return;
    }
    if (it.image_path) {
      // Best effort: a leftover photo is harmless, so a failure here is not shown.
      await supabase.storage.from("wardrobe").remove([it.image_path]);
    }
    setConfirmDeleteId(null);
    setStatus(`Deleted "${it.name}".`);
    await loadItems();
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
        warmth: editWarmth || null,
        rain_ready: editRainReady,
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


  const addPhotoTile =
    "flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-ink/15 bg-cream px-3 py-4 text-xs font-semibold text-ink/70 transition hover:border-coral hover:text-coral";

  return (
    <main className={pageCls}>
      <div className={containerCls}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className={h1Cls}>{pickSlot ? `Choose a ${label(pickSlot).toLowerCase()}` : "My closet"}</h1>
            <p className={`${mutedCls} mt-0.5`}>
              {pickSlot ? (
                <>
                  Pick one for your outfit, or <a href="/outfit" className="font-semibold text-coral underline">go back</a>.
                </>
              ) : (
                `${items.length} ${items.length === 1 ? "piece" : "pieces"}`
              )}
            </p>
          </div>
          {!pickSlot && (
            <div className="flex shrink-0 gap-2">
              <button type="button" className={outlineBtn} onClick={() => setShowBulk((v) => !v)} aria-expanded={showBulk}>
                <Icon name="images" className="h-4 w-4" />
                Bulk
              </button>
              <button type="button" className={primaryBtn} onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
                <Icon name={showForm ? "x" : "add"} className="h-4 w-4" strokeWidth={2.6} />
                {showForm ? "Close" : "Add"}
              </button>
            </div>
          )}
        </div>

        {/* Status / messages */}
        {status && (
          <p className="mt-4 rounded-2xl bg-sand px-4 py-2.5 text-sm font-medium text-sand-ink" role="status">
            {status}
          </p>
        )}

        {/* Add many photos at once (not while picking an item for an outfit) */}
        {!pickSlot && showBulk && <BulkUpload onDone={loadItems} />}

        {/* Add Item form (hidden while picking an item for an outfit) */}
        {!pickSlot && showForm && (
          <form onSubmit={insertItem} className={`${panelCls} mt-5 grid gap-4 sm:grid-cols-2`}>
            <h2 className={`${h2Cls} sm:col-span-2`}>Add a piece</h2>

            {/* Photo: Take Photo and Upload from Library are both offered */}
            <div className="grid gap-2 sm:col-span-2">
              <div className="flex gap-3">
                <button type="button" className={addPhotoTile} onClick={() => cameraInputRef.current?.click()}>
                  <Icon name="selfie" className="h-6 w-6" />
                  Take photo
                </button>
                <button type="button" className={addPhotoTile} onClick={() => libraryInputRef.current?.click()}>
                  <Icon name="upload" className="h-6 w-6" />
                  Upload from library
                </button>
              </div>
              {previewUrl && (
                <div className="flex items-center gap-3">
                  <img src={previewUrl} alt="Selected photo" className="h-20 w-20 rounded-2xl object-cover" />
                  <div className="grid gap-1">
                    <span className="max-w-[14rem] truncate text-xs text-ink/60">{file?.name}</span>
                    <button
                      type="button"
                      className={`${linkBtn} text-left text-xs`}
                      onClick={() => {
                        choosePhoto(null);
                        if (cameraInputRef.current) cameraInputRef.current.value = "";
                        if (libraryInputRef.current) libraryInputRef.current.value = "";
                      }}
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              )}
              {(suggesting || suggestNote) && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-mint px-4 py-2.5 text-sm text-mint-ink" aria-live="polite">
                  <Icon name="outfit" className="h-4 w-4" />
                  <span>{suggesting ? "Looking at your photo…" : suggestNote}</span>
                  {!suggesting && file && (
                    <button type="button" className="font-semibold underline" onClick={() => void suggestFromPhoto(file)}>
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
                {["shirt", "tee", "pants", "shorts", "shoes", "jacket", "hoodie", "accessory"].map((t) => (
                  <option key={t} value={t}>{label(t)}</option>
                ))}
              </select>
            </label>

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
                  <option key={c} value={c}>{label(c)}</option>
                ))}
              </select>
            </label>

            {category === "accessory" ? (
              <label className="grid gap-1">
                <span className={labelCls}>Accessory kind</span>
                <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={fieldCls}>
                  <option value="">Choose one</option>
                  {SUBCATEGORIES.map((s) => (
                    <option key={s} value={s}>{label(s)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-1">
                <span className={labelCls}>Warmth</span>
                <select value={warmth} onChange={(e) => setWarmth(e.target.value)} className={fieldCls}>
                  <option value="">Not set</option>
                  {WARMTH_LEVELS.map((w) => (
                    <option key={w} value={w}>{label(w)}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-coral" checked={rainReady} onChange={(e) => setRainReady(e.target.checked)} />
              Rain-ready (waterproof)
            </label>

            <PillGroup
              legend="Where would you wear it?"
              options={OCCASIONS}
              selected={occasions}
              onToggle={(o) => setOccasions(toggleValue(occasions, o))}
              toneOf={occasionTone}
              withIcons
              className="sm:col-span-2"
            />
            <PillGroup
              legend="How dressed up?"
              options={FORMALITY}
              selected={formality}
              onToggle={(f) => setFormality(toggleValue(formality, f))}
              className="sm:col-span-2"
            />

            <div className="sm:col-span-2">
              <button type="submit" className={`${primaryBtn} w-full sm:w-auto`}>Add to closet</button>
            </div>
          </form>
        )}

        {/* Hidden input used for per-item "Change photo" */}
        <input
          ref={hiddenFileRef}
          type="file"
          accept="image/*"
          onChange={onFileChosenForItem}
          className="hidden"
        />

        {/* Filters */}
        {items.length > 0 && (
          <div className="mt-6 grid gap-3">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your closet"
                aria-label="Search by name"
                className={`${fieldCls} pl-11`}
              />
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {!pickSlot &&
                (["all", ...CATEGORIES] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={categoryFilter === c}
                    onClick={() => setCategoryFilter(c)}
                    className={`${filterPill} ${categoryFilter === c ? "bg-ink text-white" : "bg-white text-ink/70 hover:text-ink"}`}
                  >
                    <Icon name={iconFor(c) ?? "all"} className="h-4 w-4" />
                    {c === "all" ? "All" : label(c)}
                  </button>
                ))}
              <button
                type="button"
                aria-pressed={onlyNeedsTags}
                onClick={() => setOnlyNeedsTags((v) => !v)}
                className={`${filterPill} ${onlyNeedsTags ? "bg-coral text-white" : "bg-white text-ink/70 hover:text-ink"}`}
              >
                <Icon name="tag" className="h-4 w-4" />
                Needs details ({needsTagsCount})
              </button>
            </div>
            {filtering && (
              <p className="text-xs text-ink/50">
                Showing {visibleItems.length} of {slotItems.length}
              </p>
            )}
          </div>
        )}

        {/* Items grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((it) => {
            const tone = categoryTone(it.category);
            const editing = editingId === it.id;
            return (
              <div key={it.id} className={`flex flex-col overflow-hidden rounded-3xl bg-white soft-shadow ${editing ? "col-span-2 sm:col-span-3 lg:col-span-2" : ""}`}>
                <div className={`relative ${editing ? "aspect-[16/9]" : "aspect-[4/5]"} bg-cream`}>
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full flex-col items-center justify-center gap-1.5 ${TONES[tone].soft}`}>
                      <Icon name={iconFor(it.category) ?? "closet"} className="h-10 w-10 opacity-80" />
                      <span className="text-xs font-semibold opacity-70">No photo yet</span>
                    </div>
                  )}
                  {it.category && (
                    <span className={`absolute left-2 top-2 ${chipCls} ${TONES[tone].soft}`}>
                      <Icon name={iconFor(it.category) ?? "all"} className="h-3 w-3" />
                      {label(it.category)}
                    </span>
                  )}
                  {needsTags(it) && (
                    <span className={`absolute right-2 top-2 ${chipCls} ${TONES.sand.soft}`}>Needs details</span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <div className="truncate text-sm font-bold">{it.name}</div>
                  <div className="mt-0.5 truncate text-xs text-ink/55">
                    {[label(it.type), it.subcategory ? label(it.subcategory) : null, it.warmth ? label(it.warmth) : null, it.rain_ready ? "Rain-ready" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>

                  {editing ? (
                    <div className="mt-3 grid gap-3 border-t border-line pt-3">
                      <select
                        value={editCategory}
                        onChange={(e) => {
                          setEditCategory(e.target.value);
                          setEditSubcategory("");
                        }}
                        className={fieldCls}
                        aria-label="Category"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{label(c)}</option>
                        ))}
                      </select>

                      {editCategory === "accessory" && (
                        <select
                          value={editSubcategory}
                          onChange={(e) => setEditSubcategory(e.target.value)}
                          className={fieldCls}
                          aria-label="Accessory kind"
                        >
                          <option value="">Accessory kind</option>
                          {SUBCATEGORIES.map((s) => (
                            <option key={s} value={s}>{label(s)}</option>
                          ))}
                        </select>
                      )}

                      <select value={editWarmth} onChange={(e) => setEditWarmth(e.target.value)} className={fieldCls} aria-label="Warmth">
                        <option value="">Warmth not set</option>
                        {WARMTH_LEVELS.map((w) => (
                          <option key={w} value={w}>{label(w)}</option>
                        ))}
                      </select>

                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-coral"
                          checked={editRainReady}
                          onChange={(e) => setEditRainReady(e.target.checked)}
                        />
                        Rain-ready (waterproof)
                      </label>

                      <PillGroup
                        legend="Where would you wear it?"
                        options={OCCASIONS}
                        selected={editOccasions}
                        onToggle={(o) => setEditOccasions(toggleValue(editOccasions, o))}
                        toneOf={occasionTone}
                        withIcons
                      />
                      <PillGroup
                        legend="How dressed up?"
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
                      {((it.occasions && it.occasions.length > 0) || (it.formality && it.formality.length > 0)) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(it.occasions ?? []).map((o) => (
                            <span key={o} className={`${chipCls} ${TONES[occasionTone(o)].soft}`}>{label(o)}</span>
                          ))}
                          {(it.formality ?? []).map((f) => (
                            <span key={f} className={`${chipCls} ${TONES[formalityTone].soft}`}>{label(f)}</span>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                        {pickSlot ? (
                          <button className={`${primaryBtn} w-full`} onClick={() => pickItem(it)} type="button">
                            Use this
                          </button>
                        ) : confirmDeleteId === it.id ? (
                          <>
                            <span className="text-xs font-semibold text-ink/70">Delete this?</span>
                            <button className={`${primaryBtn} px-4 py-2 text-xs`} onClick={() => deleteItem(it)} type="button">
                              Yes, delete
                            </button>
                            <button className={`${outlineBtn} px-4 py-2 text-xs`} onClick={() => setConfirmDeleteId(null)} type="button">
                              Keep
                            </button>
                          </>
                        ) : (
                          <>
                            <button className={iconBtn} onClick={() => onClickChangeImage(it.id)} type="button" aria-label={it.image_url ? "Change photo" : "Add photo"} title={it.image_url ? "Change photo" : "Add photo"}>
                              <Icon name="selfie" className="h-4 w-4" />
                            </button>
                            <button className={iconBtn} onClick={() => startEdit(it)} type="button" aria-label="Edit details" title="Edit details">
                              <Icon name="edit" className="h-4 w-4" />
                            </button>
                            <button className={`${iconBtn} ml-auto hover:!bg-peach hover:!text-peach-ink`} onClick={() => setConfirmDeleteId(it.id)} type="button" aria-label="Delete" title="Delete">
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visibleItems.length === 0 && !status && (
          items.length === 0 && !pickSlot ? (
            <div className="wardrobe mt-6" key="empty">
              <div className="wardrobe-door door-left" aria-hidden="true" />
              <div className="wardrobe-door door-right" aria-hidden="true" />
              <div className="wardrobe-inside text-center">
                <p className="text-lg font-bold">Your closet is empty</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-white/70">Add your first piece and Style Me will start putting outfits together.</p>
                <button type="button" className={`${primaryBtn} mt-4`} onClick={() => setShowForm(true)}>
                  <Icon name="add" className="h-4 w-4" strokeWidth={2.6} />
                  Add a piece
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-ink/60">
              {filtering
                ? "Nothing matches those filters."
                : pickSlot
                  ? `No ${label(pickSlot).toLowerCase()} items in your closet yet.`
                  : "No items yet."}
            </p>
          )
        )}
      </div>
      <NavBar />
    </main>
  );
}
