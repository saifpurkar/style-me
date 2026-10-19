-- Rain-aware outfits: is the item waterproof / water-resistant (rain jackets, trench coats,
-- waterproof boots)? Defaults to false for existing items.

alter table public.items
  add column if not exists rain_ready boolean not null default false;
