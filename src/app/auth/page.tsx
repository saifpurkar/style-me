"use client";

import NavBar from "@/components/NavBar";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { containerCls, h1Cls, mutedCls, outlineBtn, pageCls, panelCls, primaryBtn } from "@/lib/ui";

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
      <div className={containerCls}>
        <h1 className={h1Cls}>{email ? "You" : "Welcome to Style Me"}</h1>
        {!email && checked && <p className={`${mutedCls} mt-0.5`}>Sign in to keep your closet safe and in sync.</p>}

        {checked && email && (
          <div className={`${panelCls} mt-6`}>
            <p className="flex items-center gap-3 text-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-peach text-peach-ink">
                <Icon name="account" className="h-5 w-5" />
              </span>
              <span>
                Signed in as <span className="font-bold">{email}</span>
              </span>
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
            <p className="mb-4 text-sm text-ink/60">
              Enter your email and we&apos;ll send you a link. No password needed.
            </p>
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: "#f26b4f",
                      brandAccent: "#d9563b",
                      brandButtonText: "#ffffff",
                      inputBackground: "#ffffff",
                      inputBorder: "#3a2e2526",
                      inputText: "#3a2e25",
                      inputLabelText: "#3a2e2599",
                      messageText: "#3a2e25",
                    },
                    radii: { borderRadiusButton: "999px", buttonBorderRadius: "999px", inputBorderRadius: "16px" },
                    fonts: {
                      bodyFontFamily: "var(--font-jakarta), sans-serif",
                      buttonFontFamily: "var(--font-jakarta), sans-serif",
                      labelFontFamily: "var(--font-jakarta), sans-serif",
                      inputFontFamily: "var(--font-jakarta), sans-serif",
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
      </div>
      <NavBar />
    </main>
  );
}
