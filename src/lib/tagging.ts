// What the AI is asked to return for a photo of one clothing item, and the
// rules that make sure whatever comes back is safe to put in the Add Item form.
import { z } from "zod";
import { FORMALITY, OCCASIONS } from "@/lib/outfit";
import { WARMTH_LEVELS } from "@/lib/weather";

// "type" is the older free-form field on items; these are the choices on the form.
export const ITEM_TYPES = ["shirt", "tee", "pants", "shorts", "shoes", "jacket", "hoodie", "accessory"] as const;
export const ITEM_CATEGORIES = ["top", "bottom", "footwear", "accessory"] as const;
export const ITEM_SUBCATEGORIES = ["headgear", "eyewear", "watch", "bracelet", "belt", "bag", "socks", "other"] as const;

export const TagSuggestionSchema = z.object({
  name: z.string().describe("Short item name, colour first, at most 4 words, e.g. 'Navy Polo' or 'White Leather Sneakers'"),
  type: z.enum(ITEM_TYPES),
  category: z.enum(ITEM_CATEGORIES),
  subcategory: z.enum(ITEM_SUBCATEGORIES).nullable().describe("Only for accessories; null for tops, bottoms and footwear"),
  occasions: z.array(z.enum(OCCASIONS)).describe("Every occasion this item would realistically be worn for"),
  formality: z.array(z.enum(FORMALITY)).describe("Every formality level this item suits"),
  warmth: z.enum(WARMTH_LEVELS).nullable().describe("How warm the item is to wear; null for accessories where it doesn't apply"),
  rain_ready: z.boolean().describe("True only if the item looks waterproof or water-resistant: rain jackets, trench coats, waterproof or rubber boots"),
});

export type TagSuggestion = z.infer<typeof TagSuggestionSchema>;

export const TAGGING_SYSTEM_PROMPT = `You tag clothing photos for a personal wardrobe app. The photo shows ONE item (or one item worn or laid out). Ignore the background, hangers, people and anything that is not the item.

Return the item's details using exactly these rules.

category:
- top: shirts, tees, polos, sweaters, hoodies, jackets, coats, vests
- bottom: pants, jeans, chinos, shorts, skirts
- footwear: any shoes, boots, sneakers, sandals
- accessory: hats and caps, eyewear, watches, bracelets, belts, bags, socks and anything else worn as an extra

subcategory: only for accessories (headgear, eyewear, watch, bracelet, belt, bag, socks, other). Use null for everything else.

type: the closest of shirt, tee, pants, shorts, shoes, jacket, hoodie. Use accessory for accessories.

occasions: choose every occasion the item would realistically be worn for, from work, wfh, dining, date, casual_hangout, special_event, travel, outdoor, gym. Use gym only for athletic or workout wear. Be selective: a few honest choices beat listing everything.

formality: choose every level the item suits, from casual, smart_casual, business_casual, formal. A plain tee is casual. An oxford shirt is casual and smart_casual. A suit jacket is business_casual and formal.

warmth: how warm the item is to wear.
- light: short sleeves, thin fabric, shorts, sandals, canvas or mesh shoes
- medium: long-sleeve shirts, light sweaters, jeans and trousers, sneakers, loafers
- heavy: jackets, coats, hoodies, thick knits, boots, lined or insulated pieces
Use null only for accessories where warmth doesn't apply (a watch, belt, sunglasses). Hats, scarves and gloves can be light, medium or heavy.

rain_ready: true only when the item is clearly meant to keep water out, such as a rain jacket, windbreaker with a hood, trench coat, waterproof or rubber boots, or a waterproof bag. Ordinary jackets, canvas sneakers, suede and knitwear are false. When unsure, use false.

name: a short, plain name with the colour first, at most 4 words. Do not include brand names unless clearly visible.

If the photo is unclear, still give your best honest answer rather than leaving fields empty.`;

const TYPES_BY_CATEGORY: Record<(typeof ITEM_CATEGORIES)[number], readonly (typeof ITEM_TYPES)[number][]> = {
  top: ["shirt", "tee", "jacket", "hoodie"],
  bottom: ["pants", "shorts"],
  footwear: ["shoes"],
  accessory: ["accessory"],
};

// Make sure a suggestion can't produce a combination the database or the form
// would reject (a subcategory on a top, a "shoes" type on a bottom), and drop duplicates.
export function cleanSuggestion(s: TagSuggestion): TagSuggestion {
  const isAccessory = s.category === "accessory";
  const allowedTypes = TYPES_BY_CATEGORY[s.category];
  return {
    name: s.name.trim().slice(0, 60),
    type: allowedTypes.includes(s.type) ? s.type : allowedTypes[0],
    category: s.category,
    subcategory: isAccessory ? s.subcategory ?? "other" : null,
    occasions: Array.from(new Set(s.occasions)),
    formality: Array.from(new Set(s.formality)),
    // The main garments always get a warmth so weather outfits can use them.
    warmth: s.warmth ?? (isAccessory ? null : "medium"),
    // Outfits only look at rain-readiness for tops and footwear; bottoms are always false.
    rain_ready: s.rain_ready && (s.category !== "bottom"),
  };
}
