"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import NavBar from "@/components/NavBar";
import { v4 as uuidv4 } from "uuid";
import { containerCls, h1Cls, h2Cls, linkBtn, mutedCls, pageCls, panelCls, primaryBtn } from "@/lib/ui";

const tile =
  "flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-ink/15 bg-cream px-3 py-5 text-xs font-semibold text-ink/70 transition hover:border-coral hover:text-coral";

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
      <div className={containerCls}>
        <h1 className={h1Cls}>Your selfie</h1>
        <p className={`${mutedCls} mt-0.5`}>
          A full-length photo on a plain background works best. It stays private in your account.
        </p>

        {status && (
          <p className="mt-4 rounded-2xl bg-sand px-4 py-2.5 text-sm font-medium text-sand-ink" role="status">
            {status}
          </p>
        )}

        <form onSubmit={uploadSelfie} className={`${panelCls} mt-6 grid gap-3`}>
          <div className="flex gap-3">
            <button type="button" className={tile} onClick={() => cameraRef.current?.click()}>
              <Icon name="selfie" className="h-6 w-6" />
              Take selfie
            </button>
            <button type="button" className={tile} onClick={() => libraryRef.current?.click()}>
              <Icon name="upload" className="h-6 w-6" />
              Upload from library
            </button>
          </div>
          {file && (
            <div className="flex items-center gap-3 text-sm">
              <span className="max-w-[14rem] truncate text-ink/70">{file.name}</span>
              <button type="button" className={linkBtn} onClick={clearChosen}>
                Remove
              </button>
            </div>
          )}
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
          <h2 className={h2Cls}>Current selfie</h2>
          {selfieUrl ? (
            <div className="mirror-frame mt-3 w-full max-w-xs">
              <div className="mirror-glass">
                <img src={selfieUrl} alt="Your latest selfie" className="w-full" />
              </div>
            </div>
          ) : (
            <p className={`${mutedCls} mt-2`}>No selfie yet. Add one above.</p>
          )}
        </div>
      </div>
      <NavBar />
    </main>
  );
}
