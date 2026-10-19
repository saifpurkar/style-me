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

// Tag colours, grouped by feel, so a card's chips are easy to tell apart at a glance.
// (Full class names so Tailwind can see them.)
const TONES = {
  denim: "border-denim/50 bg-denim/10 text-denim",
  terracotta: "border-terracotta/50 bg-terracotta/10 text-terracotta",
  sage: "border-sage/50 bg-sage/10 text-sage",
  brass: "border-brass/60 bg-brass/10 text-[#7d5f33]",
  plum: "border-plum/50 bg-plum/10 text-plum",
  plain: "border-ink/25 bg-ink/5 text-ink/80",
};

const OCCASION_TONE: Record<string, keyof typeof TONES> = {
  work: "denim",
  wfh: "denim",
  dining: "terracotta",
  date: "terracotta",
  casual_hangout: "sage",
  travel: "sage",
  outdoor: "sage",
  special_event: "brass",
  gym: "plum",
};

export function occasionTone(value: string): string {
  return TONES[OCCASION_TONE[value] ?? "plain"];
}

export const formalityTone = TONES.plain;
