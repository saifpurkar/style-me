-- Weather-based outfits: how warm each item is.
-- light = tees, shorts, sandals; medium = long-sleeve shirts, jeans, sneakers;
-- heavy = jackets, hoodies, boots. Null means "not set", which matches any weather.

alter table public.items add column if not exists warmth text;

alter table public.items
  add constraint items_warmth_check
  check (warmth is null or warmth in ('light', 'medium', 'heavy'));

-- Starting values for existing items, from the older `type` field. Editable in the app.
update public.items
set warmth = case type
  when 'tee' then 'light'
  when 'shorts' then 'light'
  when 'shirt' then 'medium'
  when 'pants' then 'medium'
  when 'shoes' then 'medium'
  when 'jacket' then 'heavy'
  when 'hoodie' then 'heavy'
end
where warmth is null;
