"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import NavBar from "@/components/NavBar";
import { v4 as uuidv4 } from "uuid";
import { outlineBtn, pageCls, panelCls, primaryBtn } from "@/lib/ui";

export default function SelfiePage() {
  const [status, setStatus] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Please go to /auth and sign in, then return here.");
        return;
      }
      setUserId(user.id);
      await loadSelfieFromProfile(user.id);
    })();
  }, []);

  async function loadSelfieFromProfile(uid: string) {
    setStatus("Loading your current selfie...");
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("selfie_path")
      .eq("id", uid)
      .single();

    if (error) {
      setStatus("Could not load profile: " + error.message);
      setSelfieUrl(null);
      return;
    }

    if (!profile?.selfie_path) {
      setStatus("No selfie set yet. Add one below.");
      setSelfieUrl(null);
      return;
    }

    const { data: signed, error: urlErr } = await supabase.storage
      .from("wardrobe")
      .createSignedUrl(profile.selfie_path, 60 * 60); // 1 hour

    if (urlErr) {
      setStatus("Failed to create display URL: " + urlErr.message);
      setSelfieUrl(null);
      return;
    }

    setSelfieUrl(signed?.signedUrl ?? null);
    setStatus("");
  }

  function clearChosen() {
    setFile(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  }

  async function uploadSelfie(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setStatus("Please sign in at /auth first.");
      return;
    }
    if (!file) {
      setStatus("Please choose a selfie image first.");
      return;
    }

    setStatus("Uploading selfie...");

    // Upload to wardrobe/<userId>/selfie/<uuid>.<ext> (virtual folders auto-create)
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const newName = `${uuidv4()}.${ext}`;
    const storagePath = `${userId}/selfie/${newName}`;

    const { error: upErr } = await supabase.storage
      .from("wardrobe")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (upErr) {
      setStatus("Upload failed: " + upErr.message);
      return;
    }

    // Save the path on your profile (so the whole app can find your latest selfie)
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ selfie_path: storagePath })
      .eq("id", userId);

    if (updErr) {
      setStatus("Saved file, but failed to update profile: " + updErr.message);
      return;
    }

    // Refresh preview from profile
    await loadSelfieFromProfile(userId);
    clearChosen();

    setStatus("Selfie uploaded!");
    setTimeout(() => setStatus(""), 1500);
  }

  return (
    <main className={pageCls}>
      <NavBar />
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display font-semibold text-3xl text-paper">Selfie</h1>
        <p className="mt-2 text-paper/70">
          Add a selfie (a plain background works best). It stays private in your account.
        </p>

        {status && <p className="mt-4 text-sm text-paper/80">{status}</p>}

        <form onSubmit={uploadSelfie} className={`${panelCls} mt-6 grid gap-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${outlineBtn} inline-flex items-center gap-1.5`} onClick={() => cameraRef.current?.click()}>
              <Icon name="selfie" className="h-3.5 w-3.5" />
              Take selfie
            </button>
            <button type="button" className={`${outlineBtn} inline-flex items-center gap-1.5`} onClick={() => libraryRef.current?.click()}>
              <Icon name="upload" className="h-3.5 w-3.5" />
              Upload from library
            </button>
            {file && (
              <>
                <span className="text-xs text-ink/70 truncate max-w-[14rem]">{file.name}</span>
                <button
                  type="button"
                  className="font-utility text-[10px] uppercase tracking-wider text-ink/60 underline hover:text-ink"
                  onClick={clearChosen}
                >
                  Remove
                </button>
              </>
            )}
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <div>
            <button type="submit" className={primaryBtn} disabled={!file}>
              Save selfie
            </button>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="font-display font-semibold text-xl">Current selfie</h2>
          {selfieUrl ? (
            <img
              src={selfieUrl}
              alt="Your latest selfie"
              className="mt-3 w-full max-w-sm rounded-[2px] border border-paper/20"
            />
          ) : (
            <p className="mt-3 text-paper/70">No selfie yet. Add one above.</p>
          )}
        </div>
      </section>
    </main>
  );
}
