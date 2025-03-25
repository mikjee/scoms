TRUNCATE TABLE
	scoms.order_allocation,
	scoms.order_pricing,
	scoms.order_items,
	scoms.orders,
	scoms.events,
	scoms.inventory,
	scoms.product_attributes,
	scoms.products,
	scoms.warehouses,
	scoms.addresses
RESTART IDENTITY CASCADE;