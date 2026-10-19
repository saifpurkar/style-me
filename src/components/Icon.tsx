import type { ComponentType } from "react";
import {
  Briefcase, Camera, Check, CloudRain, CloudSun, Coffee, Dumbbell, Heart, House, Images, LayoutGrid,
  Laptop, MirrorRound, PartyPopper, Pencil, Plane, Plus, RefreshCw, Search, Shirt, SportShoe, Sparkles,
  Tag, Trash2, TreePine, Upload, UserRound, Utensils, Watch, X,
} from "lucide-react";

// Friendly rounded icons. Lucide supplies most; the hanger and trousers are drawn here
// because Lucide has no clothing hanger or pants.
type Drawn = ComponentType<{ className?: string; strokeWidth?: number }>;

function custom(children: React.ReactNode): Drawn {
  return function CustomIcon({ className, strokeWidth = 2 }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {children}
      </svg>
    );
  };
}

const Hanger = custom(
  <>
    <path d="M12 8V7a2.5 2.5 0 1 1 2.5 2.5" />
    <path d="M12 9 3.3 15.6A1.5 1.5 0 0 0 4.2 18h15.6a1.5 1.5 0 0 0 .9-2.4L12 9Z" />
  </>,
);
const Pants = custom(<path d="M7 3h10l1.5 18h-5L12 10l-1.5 11h-5L7 3Z M7 8h10" />);

const ICONS = {
  home: House,
  closet: Hanger,
  outfit: Sparkles,
  tryon: MirrorRound,
  selfie: Camera,
  account: UserRound,
  add: Plus,
  top: Shirt,
  bottom: Pants,
  footwear: SportShoe,
  accessory: Watch,
  all: LayoutGrid,
  upload: Upload,
  tag: Tag,
  images: Images,
  weather: CloudSun,
  rain: CloudRain,
  refresh: RefreshCw,
  x: X,
  check: Check,
  trash: Trash2,
  edit: Pencil,
  search: Search,
  // occasions
  work: Briefcase,
  wfh: Laptop,
  dining: Utensils,
  date: Heart,
  casual_hangout: Coffee,
  special_event: PartyPopper,
  travel: Plane,
  outdoor: TreePine,
  gym: Dumbbell,
} as const;

export type IconName = keyof typeof ICONS;

export function iconFor(name: string | null | undefined): IconName | null {
  return name && name in ICONS ? (name as IconName) : null;
}

export default function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  const Glyph = ICONS[name] as Drawn;
  return <Glyph className={`shrink-0 ${className}`} strokeWidth={strokeWidth} />;
}
