import { IInventoryService, TProduct } from '../../common/inventory/types';
import { ConnectedService } from '../../common/connectedService/ConnectedService';

// ---

export class InventoryService extends ConnectedService implements IInventoryService  {

	constructor() {
		super('inventory', 'inv');
	}

	// ---

	public async createProduct(
		productName: TProduct['productName'],
		attributes: TProduct['attributes'] = {},
	): Promise<void> {
		const productId = this.uid();
		const { query, commit } = await this.db.transact();

		try {
			const insertProductSQL = `
				INSERT INTO scoms.products (product_id, product_name)
				VALUES (:productId, :productName);
			`;

			await query(insertProductSQL, {
				productId,
				productName,
			});

			const attrEntries = Object.entries(attributes);
			if (attrEntries.length) {
				const valuesList: string[] = [];
				const paramObject: Record<string, any> = { productId };

				attrEntries.forEach(([attr, { value, meta }], i) => {
					const iStr = String(i);
					const attrId = this.uid();

					valuesList.push(`
						(
							:attribute_id_${iStr},
							:productId,
							:attribute_${iStr},
							:value_${iStr},
							:meta_${iStr}
						)
					`);

					paramObject[`attribute_id_${iStr}`] = attrId;
					paramObject[`attribute_${iStr}`] = attr;
					paramObject[`value_${iStr}`] = value;
					paramObject[`meta_${iStr}`] = meta ?? {};
				});

				const insertAttrsSQL = `
					INSERT INTO scoms.product_attributes (
						attribute_id,
						product_id,
						attribute,
						value,
						meta
					)
					VALUES ${valuesList.join(',\n')};
				`;

				await query(insertAttrsSQL, paramObject);
			}

			// Commit transaction
			await commit();

		} catch (err) {
			console.error('createProduct failed:', err);
			throw err;
		}
	}

	public async setAttributes(params: {
		attribute_id?: string;
		product_id: string;
		attributes: { attribute: string; value: string | null; meta?: any }[];
	}): Promise<void> {
		
	}

	public async getProduct(idOrName: string): Promise<{
		product_id: string;
		product_name: string;
		attributes: { attribute: string; value: string | null; meta?: any }[];
	} | null> {
		
	}

	public async createWarehouse(data: {
		warehouse_id: string;
		warehouse_name: string;
		city: string;
		coords: { lat: number; lng: number };
	}): Promise<void> {
		
	}

	public async addInventory(
		warehouse_id: string,
		product_id: string,
		quantity: number
	): Promise<void> {
		
	}

	public async subtractInventory(
		warehouse_id: string,
		product_id: string,
		quantity: number
	): Promise<void> {
		
	}

	public async getInventory(
		warehouse_id: string,
		productidOrName: string
	): Promise<number> {
		
	}
	
	public async getNearestWarehouse(
		product_id: string,
		quantity: number,
		destinationCoords: { lat: number; lng: number }
	): Promise<{
		warehouse_id: string;
		city: string;
		coords: { lat: number; lng: number };
		available_quantity: number;
		distance_km: number;
		estimated_shipping_cost: number;
	}[]> {
		
	}

};