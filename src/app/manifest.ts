import type { MetadataRoute } from "next";

// Lets a phone install Style Me like an app (Chrome: menu > Install app).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Style Me",
    short_name: "Style Me",
    description: "Your AI wardrobe assistant: catalog your clothes and get outfits for any occasion.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#33302b",
    theme_color: "#33302b",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
