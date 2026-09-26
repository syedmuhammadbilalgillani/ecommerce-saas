-- 0002 standard product taxonomy (reference data used by every store, so it lives in migrations).
INSERT INTO "categories" ("id", "name", "full_name", "parent_id", "level") VALUES
  ('cat_apparel',   'Apparel & Accessories',     'Apparel & Accessories', NULL, 0),
  ('cat_clothing',  'Clothing',                  'Apparel & Accessories > Clothing', 'cat_apparel', 1),
  ('cat_tops',      'Shirts & Tops',             'Apparel & Accessories > Clothing > Shirts & Tops', 'cat_clothing', 2),
  ('cat_tshirts',   'T-Shirts',                  'Apparel & Accessories > Clothing > Shirts & Tops > T-Shirts', 'cat_tops', 3),
  ('cat_shirts',    'Button-Down Shirts',        'Apparel & Accessories > Clothing > Shirts & Tops > Button-Down Shirts', 'cat_tops', 3),
  ('cat_outerwear', 'Outerwear',                 'Apparel & Accessories > Clothing > Outerwear', 'cat_clothing', 2),
  ('cat_hoodies',   'Hoodies & Sweatshirts',     'Apparel & Accessories > Clothing > Outerwear > Hoodies & Sweatshirts', 'cat_outerwear', 3),
  ('cat_bottoms',   'Bottoms',                   'Apparel & Accessories > Clothing > Bottoms', 'cat_clothing', 2),
  ('cat_pants',     'Pants & Trousers',          'Apparel & Accessories > Clothing > Bottoms > Pants & Trousers', 'cat_bottoms', 3),
  ('cat_shoes',     'Shoes & Footwear',          'Apparel & Accessories > Shoes & Footwear', 'cat_apparel', 1),
  ('cat_sneakers',  'Sneakers & Athletic Shoes', 'Apparel & Accessories > Shoes & Footwear > Sneakers', 'cat_shoes', 2)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "full_name" = EXCLUDED."full_name",
  "parent_id" = EXCLUDED."parent_id",
  "level" = EXCLUDED."level";
