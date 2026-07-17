"use client";

import Link from "next/link";

export default function NavBar() {
  return (
    <header className="w-full border-b bg-white sticky top-0 z-50">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        {/* Logo + App Name */}
        <Link href="/" className="font-semibold text-xl">
          Style Me
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6 text-sm">
          <Link href="/closet" className="hover:opacity-80">Closet</Link>
          <Link href="/outfit" className="hover:opacity-80">Outfit</Link>
          <Link href="/try-on" className="hover:opacity-80">Try-On</Link>
          <Link href="/selfie" className="hover:opacity-80">Selfie</Link>
          <Link href="/auth" className="hover:opacity-80">Sign in</Link>
        </div>
      </nav>
    </header>
  );
}
