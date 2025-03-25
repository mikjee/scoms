import { IInventoryService, TProduct, TProductAttribute, TProductAttrName } from '@common/inventory/types';
import { ConnectedService } from '@common/connectedService/ConnectedService';

// ---

export class InventoryService extends ConnectedService implements IInventoryService {

	test() {
		this.log('test', this.svcName, this.svcPrefix);
	}

	public async createProduct(
		productName: TProduct['productName'],
		attributes: Record<TProductAttrName, Omit<TProductAttribute, "attributeId">> = {},
	): Promise<TProduct> {
		
		// Start transaction
		const { query, commit } = await this.db.transact();

		try {

			// Insert main product
			const productId = this.uid();
			
			const t1 = query(`
				INSERT INTO scoms.products (product_id, product_name)
				VALUES (:productId, :productName)
			`, {
				productId,
				productName,
			});

			// Insert attributes
			let t2: Promise<any> | null = null;
			const attrEntries = Object.entries(attributes);
			const prdAttributes: TProduct["attributes"] = {};

			if (attrEntries.length) {
				const valuesList: string[] = [];
				const paramObject: Record<string, string | number | null> = { productId };

				attrEntries.forEach(([attrName, { value, meta }], i) => {
					const iStr = i.toString();
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
					paramObject[`attribute_${iStr}`] = attrName;
					paramObject[`value_${iStr}`] = value;
					paramObject[`meta_${iStr}`] = meta ?? {};

					prdAttributes[attrName] = {
						attributeId: attrId,
						value,
						meta,
					};
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

				t2 = query(insertAttrsSQL, paramObject);
			}

			// Commit?
			await Promise.all([t1, t2]);
			await commit();

			// Done
			return {
				productId,
				productName,
				attributes: prdAttributes,
			};

		} catch (err) {
			this.error('createProduct failed:', err);
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
		return null;
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
		return 0;
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
		return [];
	}

};