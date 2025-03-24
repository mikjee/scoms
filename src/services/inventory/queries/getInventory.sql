/*
  @name getInventory
*/
SELECT
  i.warehouse_id,
  i.quantity,
  w.city,
  w.coords
FROM scoms.inventory i
JOIN scoms.warehouses w ON w.warehouse_id = i.warehouse_id
WHERE i.product_id = :productId;