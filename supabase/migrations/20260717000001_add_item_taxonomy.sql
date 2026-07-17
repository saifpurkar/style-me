-- Step 1 (Build Session 1): add category/subcategory/formality taxonomy to items,
-- constrain the existing occasions column, and backfill category for existing rows.

-- category: enum('top','bottom','footwear','accessory')
-- Implemented as text + CHECK rather than a native Postgres enum type, to keep
-- future value changes to a simple constraint edit instead of ALTER TYPE.
alter table items
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists formality text[];

alter table items
  add constraint items_category_check
  check (category in ('top', 'bottom', 'footwear', 'accessory'));

-- subcategory is only meaningful when category = 'accessory'
alter table items
  add constraint items_subcategory_check
  check (
    subcategory is null
    or subcategory in ('headgear', 'eyewear', 'watch', 'bracelet', 'belt', 'bag', 'socks', 'other')
  );

alter table items
  add constraint items_subcategory_only_for_accessory_check
  check (subcategory is null or category = 'accessory');

-- occasions column already exists (used as text[] by the app) — just constrain its values
alter table items
  add constraint items_occasions_check
  check (
    occasions is null
    or occasions <@ array['work', 'wfh', 'dining', 'date', 'casual_hangout', 'special_event', 'travel', 'outdoor', 'gym']::text[]
  );

alter table items
  add constraint items_formality_check
  check (
    formality is null
    or formality <@ array['casual', 'smart_casual', 'business_casual', 'formal']::text[]
  );

-- Backfill category from the existing `type` field
-- (dropdown values today: shirt, tee, pants, shorts, shoes, jacket, hoodie)
update items set category = 'top'
  where category is null and type in ('shirt', 'tee', 'jacket', 'hoodie');

update items set category = 'bottom'
  where category is null and type in ('pants', 'shorts');

update items set category = 'footwear'
  where category is null and type in ('shoes');
