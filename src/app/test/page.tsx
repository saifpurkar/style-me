"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";

export default function TestInsertPage() {
  const [status, setStatus] = useState<string>("");

  const insertItem = async () => {
    setStatus("Working...");

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      setStatus("Not signed in. Go to /auth, send magic link, then come back.");
      return;
    }

    const { error } = await supabase.from("items").insert({
      user_id: user.id,
      name: "Blue Oxford Shirt",
      type: "shirt",
      color_primary: "blue",
      colors: ["blue", "white"],
      season: ["spring", "summer"],
      occasions: ["formal", "casual"],
      brand: "Test Brand",
      notes: "Test insert from /test page",
      image_path: null
    });

    if (error) {
      setStatus("Insert failed: " + error.message);
    } else {
      setStatus("Success! Check Supabase → Table Editor → items.");
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <NavBar />
      <section className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Test Insert</h1>
        <p className="text-slate-600 mt-2">
          Click the button to insert a sample clothing item into your <code>items</code> table.
        </p>
        <button
          onClick={insertItem}
          className="mt-4 rounded-lg border px-4 py-2 hover:bg-slate-50"
        >
          Insert Test Item
        </button>
        <p className="mt-3 text-sm">{status}</p>
      </section>
    </main>
  );
}
