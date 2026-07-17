"use client";

import NavBar from "@/components/NavBar";
import { supabase } from "@/lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect } from "react";

export default function AuthPage() {
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // Create or update your profile row tied to your auth user id
        await supabase.from("profiles").upsert({
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name ?? null,
        });
      }
    });
    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <NavBar />
      <section className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          view="magic_link"
          showLinks={false}
          localization={{
            variables: {
              sign_in: {
                email_label: "Email for magic link",
                button_label: "Send magic link",
              },
            },
          }}
         redirectTo={
  typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined}
        />
      </section>
    </main>
  );
}
