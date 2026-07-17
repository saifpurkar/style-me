"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import { v4 as uuidv4 } from "uuid";

export default function SelfiePage() {
  const [status, setStatus] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
      setStatus("No selfie set yet. Upload one below.");
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

    // Clear the input
    const inputEl = document.getElementById("selfie-input") as HTMLInputElement | null;
    if (inputEl) inputEl.value = "";
    setFile(null);

    setStatus("Selfie uploaded!");
    setTimeout(() => setStatus(""), 1500);
  }

  return (
    <main className="min-h-screen bg-white">
      <NavBar />
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">Selfie</h1>
        <p className="mt-2 text-slate-600">
          Upload a selfie (plain background works best). It stays private in your account.
        </p>

        {status && <p className="mt-4 text-sm">{status}</p>}

        <form onSubmit={uploadSelfie} className="mt-6 grid gap-3 sm:grid-cols-3">
          <input
            id="selfie-input"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="border rounded px-3 py-2"
          />
          <button
            type="submit"
            className="border rounded px-3 py-2 hover:bg-slate-50"
          >
            Upload Selfie
          </button>
        </form>

        <div className="mt-8">
          <h2 className="text-xl font-semibold">Current Selfie</h2>
          {selfieUrl ? (
            <img
              src={selfieUrl}
              alt="Your latest selfie"
              className="mt-3 w-full max-w-sm rounded-lg border"
            />
          ) : (
            <p className="mt-3 text-slate-600">No selfie yet. Upload one above.</p>
          )}
        </div>
      </section>
    </main>
  );
}
