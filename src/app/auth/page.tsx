"use client";

import NavBar from "@/components/NavBar";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect, useState } from "react";
import { outlineBtn, pageCls, panelCls, primaryBtn } from "@/lib/ui";

export default function AuthPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setChecked(true);
    });

    const sub = supabase.auth.onAuthStateChange(async (event, session) => {
      setEmail(session?.user?.email ?? null);
      setChecked(true);
      if (event === "SIGNED_IN" && session?.user) {
        // Create your profile row tied to your auth user id. Only send a name if we
        // actually have one, so an existing name is never overwritten with nothing.
        const fullName = session.user.user_metadata?.full_name;
        await supabase.from("profiles").upsert({
          id: session.user.id,
          ...(fullName ? { full_name: fullName } : {}),
        });
      }
    });
    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className={pageCls}>
      <NavBar />
      <section className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display font-semibold text-3xl text-paper">
          {email ? "Account" : "Sign in"}
        </h1>

        {checked && email && (
          <div className={`${panelCls} mt-6`}>
            <p className="text-sm">
              Signed in as <span className="font-semibold">{email}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/closet" className={primaryBtn}>Open closet</Link>
              <Link href="/outfit" className={outlineBtn}>See outfits</Link>
              <button type="button" className={outlineBtn} onClick={() => supabase.auth.signOut()}>
                Sign out
              </button>
            </div>
          </div>
        )}

        {checked && !email && (
          <div className={`${panelCls} mt-6`}>
            <p className="mb-4 text-sm text-ink/70">
              Enter your email and we&apos;ll send you a link. No password needed.
            </p>
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: "#b08d57",
                      brandAccent: "#33475b",
                      brandButtonText: "#211f1c",
                      inputBackground: "#f6f3ec",
                      inputBorder: "#211f1c4d",
                      inputText: "#211f1c",
                      inputLabelText: "#211f1c99",
                      messageText: "#211f1c",
                    },
                    radii: { borderRadiusButton: "2px", buttonBorderRadius: "2px", inputBorderRadius: "2px" },
                    fonts: {
                      bodyFontFamily: "var(--font-inter), sans-serif",
                      buttonFontFamily: "var(--font-plex-mono), monospace",
                      labelFontFamily: "var(--font-plex-mono), monospace",
                      inputFontFamily: "var(--font-inter), sans-serif",
                    },
                  },
                },
              }}
              providers={[]}
              view="magic_link"
              showLinks={false}
              localization={{
                variables: {
                  magic_link: {
                    email_input_label: "Email address",
                    button_label: "Send magic link",
                  },
                },
              }}
              redirectTo={typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined}
            />
          </div>
        )}
      </section>
    </main>
  );
}
