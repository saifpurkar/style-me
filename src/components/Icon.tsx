// Thin line icons (1.5px stroke, square caps) to match the stitched, sharp-cornered look.
// They use currentColor, so they take the colour of the text around them.

const PATHS: Record<string, React.ReactNode> = {
  // Wardrobe: two doors with handles
  closet: (
    <>
      <rect x="4" y="3" width="16" height="18" />
      <path d="M12 3v18M9.5 11v2M14.5 11v2" />
    </>
  ),
  // Hanger
  outfit: (
    <>
      <path d="M12 7V6a2 2 0 1 1 2 2" />
      <path d="M12 7 3 15.5a1 1 0 0 0 .7 1.7h16.6a1 1 0 0 0 .7-1.7L12 7Z" />
    </>
  ),
  // Mirror
  tryon: (
    <>
      <rect x="6" y="3" width="12" height="15" rx="6" />
      <path d="M12 18v3M9 21h6M9.5 8.5l2-2" />
    </>
  ),
  // Camera
  selfie: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  // Person
  account: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
  // Shirt
  top: <path d="M8 4 3 7l2 4 2-1v10h10V10l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4Z" />,
  // Trousers
  bottom: <path d="M7 3h10l1 18h-4.5L12 9l-1.5 12H6L7 3Z" />,
  // Shoe
  footwear: <path d="M3 16v-3l4 .5L10 9l2 2c1.5 1 3.5 1.5 6 2 2 .5 3 1.5 3 3v1H3v-1Z" />,
  // Watch / accessories
  accessory: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M9.5 8 10 3h4l.5 5M9.5 16l.5 5h4l.5-5M12 10v2l1.5 1" />
    </>
  ),
  // Everything
  all: (
    <>
      <rect x="4" y="4" width="7" height="7" />
      <rect x="13" y="4" width="7" height="7" />
      <rect x="4" y="13" width="7" height="7" />
      <rect x="13" y="13" width="7" height="7" />
    </>
  ),
  upload: <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" />,
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <circle cx="7.5" cy="8.5" r="1" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="6" width="14" height="14" />
      <path d="M7 6V3h14v14h-4M3 16l4-4 4 4 3-3 3 3" />
    </>
  ),
  weather: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M9 3v1.5M3 9h1.5M4.8 4.8l1 1M13.2 4.8l-1 1" />
      <path d="M8 19a3.5 3.5 0 0 1 .5-7 4.5 4.5 0 0 1 8.7 1A3 3 0 0 1 17 19H8Z" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function iconFor(name: string | null | undefined): IconName | null {
  return name && name in PATHS ? (name as IconName) : null;
}

export default function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
