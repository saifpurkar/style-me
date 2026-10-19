"use client";

import { useEffect } from "react";

// Registers the minimal service worker (public/sw.js) so the app can be installed.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installing as an app is optional; the site works fine without it.
      });
    }
  }, []);
  return null;
}
