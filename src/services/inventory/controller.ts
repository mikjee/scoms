import { IInventoryService } from '../../common/inventory/types';

// ---

export class InventoryService implements IInventoryService {
	async createProduct(product, attributes = []) {
		// Insert product into DB, optionally with attributes
	}

	async setAttributes({ attribute_id, product_id, attributes }) {
		// Insert or update attributes for the product
	}

	async getProduct(idOrName) {
		// Fetch product and its attributes
	}

	async createWarehouse(data) {
		// Insert warehouse row with city, coords, etc.
	}

	async addInventory(warehouse_id, product_id, quantity) {
		// Upsert inventory quantity
	}

	async subtractInventory(warehouse_id, product_id, quantity) {
		// Atomically decrement inventory or fail
	}

	async getInventory(warehouse_id, productidOrName) {
		// Return quantity from inventory table
	}

	async getNearestWarehouse(product_id, quantity, destinationCoords) {
		// Run geospatial + inventory query to return optimal warehouses
	}
};