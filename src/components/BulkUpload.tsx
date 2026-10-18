"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadItemPhoto } from "@/lib/photos";
import { shrinkToJpegBase64 } from "@/lib/image";
import type { TagSuggestion } from "@/lib/tagging";
import { outlineBtn, panelCls, primaryBtn } from "@/lib/ui";

type RowStatus = "queued" | "working" | "done" | "needs-tags" | "failed";
type Row = { id: number; file: File; status: RowStatus; note: string };

const MAX_FILES = 200;
const PARALLEL = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// "IMG_2041.jpg" -> "IMG 2041", used only when the AI can't name the item.
function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (base || "New item").slice(0, 60);
}

type SuggestResult = { suggestion?: TagSuggestion; why?: string; systemic?: boolean };

async function suggest(file: File, token: string): Promise<SuggestResult> {
  let image: string;
  try {
    image = await shrinkToJpegBase64(file);
  } catch {
    return { why: "This photo couldn't be read for suggestions." };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch("/api/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image, mediaType: "image/jpeg" }),
      });
    } catch {
      return { why: "Couldn't reach the AI service." };
    }
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { suggestion: json.suggestion as TagSuggestion };
    if (res.status === 429 && attempt === 0) {
      await sleep(4000); // busy: wait a moment and try once more
      continue;
    }
    // 401/503 mean the AI side is unavailable for everyone, so stop asking for the rest.
    return { why: json.error ?? "AI suggestions failed.", systemic: res.status === 401 || res.status === 503 };
  }
  return { why: "AI suggestions were busy." };
}

const STATUS_LABEL: Record<RowStatus, string> = {
  queued: "Waiting",
  working: "Working",
  done: "Saved",
  "needs-tags": "Saved, needs tags",
  failed: "Not saved",
};

export default function BulkUpload({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const aiUnavailable = useRef<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const update = (id: number, patch: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const images = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const room = Math.max(0, MAX_FILES - rows.length);
    const start = rows.length ? rows[rows.length - 1].id + 1 : 0;
    const added = images.slice(0, room).map((file, i): Row => ({ id: start + i, file, status: "queued", note: "" }));
    setRows([...rows, ...added]);
    setMessage(
      images.length > room
        ? `Added the first ${room}. Do the rest in another batch.`
        : images.length < list.length
          ? "Some files weren't photos and were skipped."
          : ""
    );
    if (inputRef.current) inputRef.current.value = "";
  }

  async function processRow(row: Row, userId: string, token: string) {
    update(row.id, { status: "working", note: "Looking at the photo…" });

    let suggestion: TagSuggestion | undefined;
    let why = "";
    if (aiUnavailable.current) {
      why = aiUnavailable.current;
    } else {
      const result = await suggest(row.file, token);
      suggestion = result.suggestion;
      why = result.why ?? "";
      if (result.systemic) aiUnavailable.current = why;
    }

    update(row.id, { note: "Saving…" });
    let imagePath: string;
    try {
      imagePath = await uploadItemPhoto(userId, row.file);
    } catch (err) {
      update(row.id, { status: "failed", note: err instanceof Error ? err.message : "Upload failed." });
      return;
    }

    const { error } = await supabase.from("items").insert({
      user_id: userId,
      name: suggestion?.name ?? nameFromFile(row.file.name),
      type: suggestion?.type ?? "other",
      color_primary: null,
      brand: null,
      colors: null,
      notes: null,
      image_path: imagePath,
      season: null,
      category: suggestion?.category ?? null,
      subcategory: suggestion?.subcategory ?? null,
      occasions: suggestion?.occasions.length ? suggestion.occasions : null,
      formality: suggestion?.formality.length ? suggestion.formality : null,
      warmth: suggestion?.warmth ?? null,
    });

    if (error) {
      // Don't leave an orphaned photo behind.
      await supabase.storage.from("wardrobe").remove([imagePath]);
      update(row.id, { status: "failed", note: error.message });
      return;
    }

    if (suggestion) {
      update(row.id, { status: "done", note: `${suggestion.name} · ${suggestion.category}` });
    } else {
      update(row.id, { status: "needs-tags", note: why || "No suggestion. Add tags in the closet." });
    }
  }

  async function start() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMessage("Please sign in first.");
      return;
    }
    const queue = rows.filter((r) => r.status === "queued");
    if (queue.length === 0) return;

    setRunning(true);
    setMessage("");
    aiUnavailable.current = "";

    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const row = queue[next++];
        try {
          await processRow(row, session.user.id, session.access_token);
        } catch (err) {
          update(row.id, { status: "failed", note: err instanceof Error ? err.message : "Something went wrong." });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));

    setRunning(false);
    onDone();
  }

  const finished = rows.filter((r) => r.status === "done" || r.status === "needs-tags" || r.status === "failed").length;
  const queued = rows.filter((r) => r.status === "queued").length;
  const needTags = rows.filter((r) => r.status === "needs-tags").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <div className={`${panelCls} mt-6 grid gap-3`}>
      <div className="font-utility text-xs uppercase tracking-wider text-denim">Add many photos</div>
      <p className="text-sm text-ink/70">
        Choose as many photos as you like, one item per photo. Each is tagged by AI and saved to your closet. If the AI
        can&apos;t tag one, it is still saved and marked so you can find it with the &quot;Needs tags&quot; filter.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={outlineBtn} onClick={() => inputRef.current?.click()} disabled={running}>
          Choose photos
        </button>
        <button type="button" className={primaryBtn} onClick={start} disabled={running || queued === 0}>
          {running ? "Working…" : queued > 0 ? `Save ${queued} ${queued === 1 ? "photo" : "photos"}` : "Save photos"}
        </button>
        {!running && rows.length > 0 && (
          <button type="button" className={outlineBtn} onClick={() => setRows([])}>
            Clear list
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {message && <p className="text-xs text-ink/70">{message}</p>}

      {rows.length > 0 && (
        <>
          <p className="text-xs text-ink/70" aria-live="polite">
            {finished} of {rows.length} done
            {needTags > 0 ? ` · ${needTags} need tags` : ""}
            {failed > 0 ? ` · ${failed} not saved` : ""}
          </p>
          <ul className="max-h-64 overflow-y-auto grid gap-1">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 py-1 text-xs">
                <span className="truncate max-w-[16rem]">{r.file.name}</span>
                <span className={r.status === "failed" ? "text-red-700" : r.status === "needs-tags" ? "text-brass" : "text-ink/70"}>
                  {STATUS_LABEL[r.status]}
                  {r.note ? ` — ${r.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
