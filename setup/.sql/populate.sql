-- Insert product
INSERT INTO scoms.products (product_id, product_name)
VALUES ('station_p1_pro', 'SCOS Station P1 Pro');

-- Insert product attributes (with unique IDs)
INSERT INTO scoms.product_attributes (attribute_id, product_id, attribute, value)
VALUES 
  ('attr_001', 'station_p1_pro', 'weight', '365'),
  ('attr_002', 'station_p1_pro', 'price_per_unit', '150');

-- Insert warehouses
INSERT INTO scoms.warehouses (warehouse_id, warehouse_name, city, coords)
VALUES
  ('wh_lax', 'Warehouse LAX', 'Los Angeles', POINT(-118.408056, 33.9425)),
  ('wh_jfk', 'Warehouse JFK', 'New York', POINT(-73.778889, 40.639722)),
  ('wh_gru', 'Warehouse GRU', 'São Paulo', POINT(-46.473056, -23.435556)),
  ('wh_cdg', 'Warehouse CDG', 'Paris', POINT(2.547778, 49.009722)),
  ('wh_waw', 'Warehouse WAW', 'Warsaw', POINT(20.967222, 52.165833)),
  ('wh_hkg', 'Warehouse HKG', 'Hong Kong', POINT(113.914444, 22.308889));

-- Insert inventory
INSERT INTO scoms.inventory (warehouse_id, product_id, quantity)
VALUES
  ('wh_lax', 'station_p1_pro', 355),
  ('wh_jfk', 'station_p1_pro', 578),
  ('wh_gru', 'station_p1_pro', 265),
  ('wh_cdg', 'station_p1_pro', 694),
  ('wh_waw', 'station_p1_pro', 245),
  ('wh_hkg', 'station_p1_pro', 419);

-- Insert sample addresses
INSERT INTO scoms.addresses (address_id, coords, external_customer_id, meta)
VALUES
  ('addr_bkk_01', POINT(100.5018, 13.7563), 'cust_thai_001', '{}'),  -- Bangkok
  ('addr_nyc_01', POINT(-73.9855, 40.7580), 'cust_us_001', '{}'),    -- New York
  ('addr_par_01', POINT(2.3522, 48.8566), 'cust_fr_001', '{}');      -- Paris