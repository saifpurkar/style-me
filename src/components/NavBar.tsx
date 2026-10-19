"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NavBar() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  // Show "Account" instead of "Sign in" once logged in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const links = [
    { href: "/closet", label: "Closet" },
    { href: "/outfit", label: "Outfit" },
    { href: "/try-on", label: "Try-On" },
    { href: "/selfie", label: "Selfie" },
    { href: "/auth", label: signedIn ? "Account" : "Sign in" },
  ];

  return (
    <header className="w-full border-b border-paper/15 bg-charcoal sticky top-0 z-50">
      {/* On a phone the links drop under the logo; from sm up they sit beside it. */}
      <nav className="mx-auto max-w-6xl flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Logo + App Name */}
        <Link href="/" className="font-display font-semibold text-xl text-paper whitespace-nowrap">
          Style Me
        </Link>

        {/* Navigation Links */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-utility text-xs uppercase tracking-wider whitespace-nowrap">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "text-brass border-b border-brass pb-0.5"
                    : "text-paper/80 hover:text-brass"
                }
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
