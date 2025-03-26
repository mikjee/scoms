CREATE SCHEMA IF NOT EXISTS scoms;

-- -------------------

CREATE TABLE IF NOT EXISTS scoms.products (
	product_id TEXT PRIMARY KEY,
	product_name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scoms_product_name
	ON scoms.products (product_name);

CREATE TABLE IF NOT EXISTS scoms.product_attributes (
	attribute_id TEXT PRIMARY KEY,
	product_id TEXT NOT NULL REFERENCES scoms.products(product_id),
	attribute TEXT NOT NULL,
	value TEXT DEFAULT NULL,
	meta JSONB DEFAULT '{}'::jsonb,

	CONSTRAINT fkey_scoms_product_attributes_product
		FOREIGN KEY (product_id)
		REFERENCES scoms.products(product_id)
		DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_scoms_product_attributes_product_id
	ON scoms.product_attributes (product_id);

CREATE INDEX IF NOT EXISTS idx_scoms_product_attributes_attr
	ON scoms.product_attributes (attribute);

-- -------------------

CREATE TABLE IF NOT EXISTS scoms.warehouses (
	warehouse_id TEXT PRIMARY KEY,
	warehouse_name VARCHAR(64) NOT NULL,
	city TEXT NOT NULL,
	coords POINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scoms_warehouses_coords
	ON scoms.warehouses
	USING gist (coords);

CREATE TABLE IF NOT EXISTS scoms.inventory (
	warehouse_id TEXT NOT NULL REFERENCES scoms.warehouses(warehouse_id),
	product_id TEXT NOT NULL REFERENCES scoms.products(product_id),
	quantity INTEGER NOT NULL CHECK (quantity >= 0),

	PRIMARY KEY (warehouse_id, product_id),

	CONSTRAINT fkey_scoms_inventory_warehouse
		FOREIGN KEY (warehouse_id)
		REFERENCES scoms.warehouses(warehouse_id)
		DEFERRABLE INITIALLY DEFERRED,

	CONSTRAINT fkey_scoms_inventory_product
		FOREIGN KEY (product_id)
		REFERENCES scoms.products(product_id)
		DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_scoms_inventory_product_id
	ON scoms.inventory (product_id);

-- -------------------

CREATE TABLE IF NOT EXISTS scoms.addresses (
	address_id TEXT PRIMARY KEY,
	coords POINT NOT NULL,
	external_customer_id TEXT DEFAULT NULL,
	meta JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_scoms_addresses_customer_id
	ON scoms.addresses (external_customer_id);

-- --------------------

CREATE TYPE scoms.order_status AS ENUM ('draft', 'processing', 'fulfilled', 'cancelled');

CREATE TABLE IF NOT EXISTS scoms.orders (
	order_id TEXT PRIMARY KEY,
	external_customer_id TEXT NOT NULL,
	address_id TEXT NOT NULL,
	agent_id TEXT NOT NULL,
	status scoms.order_status NOT NULL DEFAULT 'draft',
	created_on TIMESTAMPTZ NOT NULL DEFAULT now(),

	CONSTRAINT fkey_scoms_orders_address
		FOREIGN KEY (address_id)
			REFERENCES scoms.addresses(address_id)
			DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_scoms_orders_customer_id
	ON scoms.orders (external_customer_id);

CREATE INDEX IF NOT EXISTS idx_scoms_orders_agent_id
	ON scoms.orders (agent_id);

CREATE TABLE IF NOT EXISTS scoms.order_items (
	order_id TEXT NOT NULL,
	product_id TEXT NOT NULL,
	quantity INTEGER NOT NULL CHECK (quantity > 0),

	PRIMARY KEY (order_id, product_id),

	CONSTRAINT fkey_scoms_order_items_order
		FOREIGN KEY (order_id)
		REFERENCES scoms.orders(order_id)
		DEFERRABLE INITIALLY DEFERRED,

	CONSTRAINT fkey_scoms_order_items_product
		FOREIGN KEY (product_id)
		REFERENCES scoms.products(product_id)
		DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS scoms.order_pricing (
	order_id TEXT PRIMARY KEY,
	meta JSONB DEFAULT '{}'::jsonb,

	CONSTRAINT fkey_scoms_order_pricing_order
		FOREIGN KEY (order_id)
		REFERENCES scoms.orders(order_id)
		DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS scoms.order_allocation (
	allocation_id TEXT PRIMARY KEY,
	order_id TEXT NOT NULL,
	warehouse_id TEXT NOT NULL,
	product_id TEXT NOT NULL,
	quantity INTEGER NOT NULL CHECK (quantity > 0),
	distance INTEGER NOT NULL CHECK (distance >= 0),

	CONSTRAINT fkey_scoms_order_allocation_order
		FOREIGN KEY (order_id)
		REFERENCES scoms.orders(order_id)
		DEFERRABLE INITIALLY DEFERRED,

	CONSTRAINT fkey_scoms_order_allocation_warehouse
		FOREIGN KEY (warehouse_id)
		REFERENCES scoms.warehouses(warehouse_id)
		DEFERRABLE INITIALLY DEFERRED,

	CONSTRAINT fkey_scoms_order_allocation_product
		FOREIGN KEY (product_id)
		REFERENCES scoms.products(product_id)
		DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_scoms_order_allocation_order_id
	ON scoms.order_allocation (order_id);

-- --------------------

CREATE TYPE scoms.event_status AS ENUM ('pending', 'processing', 'delivered', 'failed');

CREATE TABLE IF NOT EXISTS scoms.events (
	event_id TEXT PRIMARY KEY,
	event_type TEXT NOT NULL,
	created_on TIMESTAMPTZ NOT NULL,
	payload JSONB,
	status scoms.event_status NOT NULL DEFAULT 'pending',
);

CREATE INDEX IF NOT EXISTS idx_scoms_events_event_type
	ON scoms.events (event_type);

CREATE INDEX IF NOT EXISTS idx_scoms_events_created_on
	ON scoms.events (created_on);






