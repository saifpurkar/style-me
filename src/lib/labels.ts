// Readable names for the stored values (which stay lowercase with underscores in the database).
// "wfh" -> "WFH", "casual_hangout" -> "Casual Hangout", "top" -> "Top".

const SPECIAL: Record<string, string> = {
  wfh: "WFH",
};

export function label(value: string): string {
  if (SPECIAL[value]) return SPECIAL[value];
  return value
    .split("_")
    .filter(Boolean)
    .map((w) => SPECIAL[w] ?? w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// Soft pastel colours so tags and categories are easy to tell apart at a glance.
// (Full class names so Tailwind can see them.)
export const TONES = {
  sky: { soft: "bg-sky text-sky-ink", solid: "bg-sky-ink text-white" },
  lilac: { soft: "bg-lilac text-lilac-ink", solid: "bg-lilac-ink text-white" },
  peach: { soft: "bg-peach text-peach-ink", solid: "bg-peach-ink text-white" },
  mint: { soft: "bg-mint text-mint-ink", solid: "bg-mint-ink text-white" },
  sand: { soft: "bg-sand text-sand-ink", solid: "bg-sand-ink text-white" },
  plain: { soft: "bg-ink/8 text-ink/70", solid: "bg-ink text-white" },
} as const;
export type Tone = keyof typeof TONES;

const OCCASION_TONE: Record<string, Tone> = {
  work: "sky",
  wfh: "sky",
  dining: "peach",
  date: "peach",
  casual_hangout: "mint",
  travel: "mint",
  outdoor: "mint",
  special_event: "sand",
  gym: "lilac",
};
const CATEGORY_TONE: Record<string, Tone> = { top: "sky", bottom: "lilac", footwear: "peach", accessory: "mint" };

export const occasionTone = (value: string): Tone => OCCASION_TONE[value] ?? "plain";
export const categoryTone = (value: string | null | undefined): Tone => (value && CATEGORY_TONE[value]) || "plain";
export const formalityTone: Tone = "plain";
