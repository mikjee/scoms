// `products` table
export interface IProductModel {
  product_id: string;          // TEXT PRIMARY KEY
  product_name: string;        // TEXT NOT NULL
}

// `product_attributes` table
export interface IProductAttributeModel {
  attribute_id: string;        // TEXT PRIMARY KEY
  product_id: string;          // TEXT NOT NULL, FK -> products.product_id
  attribute: string;           // TEXT NOT NULL
  value: string | null;        // TEXT DEFAULT NULL
  meta: Record<string, any>;   // JSONB DEFAULT '{}'
}

// `warehouses` table
export interface IWarehouseModel {
  warehouse_id: string;        // TEXT PRIMARY KEY
  warehouse_name: string;      // VARCHAR(64) NOT NULL
  city: string;                // TEXT NOT NULL
  coords: [number, number];    // PostgreSQL POINT, mapped as [x, y]
}

// `inventory` table
export interface IInventoryModel {
  warehouse_id: string;        // TEXT NOT NULL, FK -> warehouses.warehouse_id
  product_id: string;          // TEXT NOT NULL, FK -> products.product_id
  quantity: number;            // INTEGER NOT NULL CHECK (>= 0)
}