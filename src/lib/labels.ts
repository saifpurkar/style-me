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
