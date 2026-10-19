"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Icon, { type IconName } from "@/components/Icon";

type Tab = { href: string; label: string; icon: IconName };

// The bar at the bottom of every screen: four places, with Add in the middle.
export default function NavBar() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  // Show "You" instead of "Sign in" once logged in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const left: Tab[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/closet", label: "Closet", icon: "closet" },
  ];
  const right: Tab[] = [
    { href: "/outfit", label: "Outfits", icon: "outfit" },
    { href: "/auth", label: signedIn ? "You" : "Sign in", icon: "account" },
  ];

  const tab = ({ href, label, icon }: Tab) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-semibold transition ${
          active ? "text-coral" : "text-ink/50 hover:text-ink"
        }`}
      >
        <Icon name={icon} className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-md items-center rounded-[28px] bg-white px-2 py-2 shadow-[0_12px_32px_-10px_rgba(58,46,37,0.45)] ring-1 ring-ink/5">
        {left.map(tab)}
        <Link
          href="/closet?add=1"
          aria-label="Add an item"
          className="-mt-8 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-coral text-white shadow-[0_8px_18px_-6px_rgba(242,107,79,0.8)] ring-4 ring-cream transition active:scale-95"
        >
          <Icon name="add" className="h-7 w-7" strokeWidth={2.6} />
        </Link>
        {right.map(tab)}
      </div>
    </nav>
  );
}
