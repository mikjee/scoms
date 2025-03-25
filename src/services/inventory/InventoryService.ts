import { IInventoryService, TProduct, TProductAttribute, TProductAttrName, TProductId, TWarehouse, TWarehouseId } from '@common/inventory/types';
import { ConnectedService } from '@common/connectedService/ConnectedService';
import { PartialBy } from '@common/lib/util';

// ---

export class InventoryService extends ConnectedService implements IInventoryService {

	// ---

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

	public async setAttributes(
		productId: TProductId,
		attributes: Record<TProductAttrName, PartialBy<TProductAttribute, "attributeId">>,
	): Promise<boolean> {
		// Start transaction
		const { query, commit } = await this.db.transact();

		try {
			const valuesList: string[] = [];

			Object.entries(attributes).forEach(([attrName, { value, meta, attributeId }], i) => {
				const iStr = i.toString();
				const attrId = attributeId || this.uid();

				valuesList.push(`
					(
						:attribute_id_${iStr},
						:productId,
						:attribute_${iStr},
						:value_${iStr},
						:meta_${iStr}
					)
				`);
				
				// upsert
				query(`
					INSERT INTO scoms.product_attributes (
						attribute_id,
						product_id,
						attribute,
						value,
						meta
					)
					VALUES (
						:attribute_id_${iStr}, 
						:productId, 
						:attribute_${iStr}, 
						:value_${iStr}, 
						:meta_${iStr})
					ON CONFLICT (attribute_id) DO UPDATE SET
						product_id = EXCLUDED.product_id,
						attribute = EXCLUDED.attribute,
						value = EXCLUDED.value,
						meta = EXCLUDED.meta	
				`, {
					productId,
					attrId,
					attrName,
					value,
					meta: meta ?? {},
				});
			});

			await commit();
			return true;

		} catch (err) {
			this.error('setAttributes failed:', err);
			throw err;
		}
	}

	public async getProduct(idOrName: TProductId | string): Promise<TProduct | false> {
		const product = await this.db.query(`
			SELECT p.product_id, p.product_name, pa.attribute_id, pa.attribute, pa.value, pa.meta
			FROM scoms.products AS p
			LEFT JOIN scoms.product_attributes AS pa ON p.product_id = pa.product_id
			WHERE p.product_id = :idOrName OR p.product_name = :idOrName
			LIMIT 1
		`, { idOrName });

		if (!product) return false;
		const attributes: Record<TProductAttrName, TProductAttribute> = {};

		if (product.attribute_id) {
			attributes[product.attribute] = {
				attributeId: product.attribute_id,
				value: product.value,
				meta: product.meta,
			};
		}

		return {
			productId: product.product_id,
			productName: product.product_name,
			attributes,
		};
	}

	// ---

	public async createWarehouse(
		warehouseId: TWarehouseId,
		warehouseName: string,
		city: string,
		coords: { lat: number; lng: number },
	): Promise<TWarehouse> {

		try {
			const result = await this.db.query(`
				INSERT INTO scoms.warehouses (warehouse_id, warehouse_name, city, coords)
				VALUES (:warehouseId, :warehouseName, :city, POINT(:lat, :lng))
				RETURNING warehouse_id, warehouse_name, city, coords
			`, {
				warehouseId,
				warehouseName,
				city,
				lat: coords.lat,
				lng: coords.lng,
			});

			if (!result) {
				this.error('createWarehouse failed: No result returned');
				throw new Error("createWarehouse failed: No result returned");
			}

			return {
				warehouseId,
				warehouseName,
				city,
				coords,
			};
			
		} catch (err) {
			this.error('createWarehouse failed:', err);
			throw err;
		}

	}

	public async addInventory(
		warehouseId: TWarehouseId,
		productId: TProductId,
		quantity: number,
	): Promise<number | false> {
	
		try {
			const result = await this.db.query(`
				INSERT INTO scoms.inventory (warehouse_id, product_id, quantity)
				VALUES (:warehouseId, :productId, :quantity)
				ON CONFLICT (warehouse_id, product_id) DO UPDATE SET
					quantity = scoms.inventory.quantity + EXCLUDED.quantity
				RETURNING quantity
			`, {
				warehouseId,
				productId,
				quantity,
			});

			if (!result) {
				this.error('addInventory failed: No result returned');
				throw new Error("addInventory failed: No result returned");
			}

			return result?.quantity || false;
		} catch (err) {
			this.error('addInventory failed:', err);
			throw err;
		}
	}

	public async subtractInventory(
		warehouseId: TWarehouseId,
		productId: TProductId,
		quantity: number,
	): Promise<number | false> {
		// subtract only if enough available - check using query for safety
		try {
			const result = await this.db.query(`
				UPDATE scoms.inventory
				SET quantity = quantity - :quantity
				WHERE warehouse_id = :warehouseId AND product_id = :productId AND quantity >= :quantity
				RETURNING quantity
			`, {
				warehouseId,
				productId,
				quantity,
			});

			if (!result) {
				this.error('subtractInventory failed: No result returned');
				throw new Error("subtractInventory failed: No result returned");
			}

			return result?.quantity || false;
		}
		catch (err) {
			this.error('subtractInventory failed:', err);
			throw err;
		}
		
	}

	public async getInventory(
		warehouseId: TWarehouseId,
		productidOrName: TProductId | string,
	): Promise<number | false> {
		try {
			const result = await this.db.query(`
				SELECT i.quantity
				FROM scoms.inventory AS i
				LEFT JOIN scoms.products AS p ON i.product_id = p.product_id
				WHERE i.warehouse_id = :warehouseId AND (p.product_id = :productidOrName OR p.product_name = :productidOrName)
				LIMIT 1
			`, {
				warehouseId,
				productidOrName,
			});

			if (!result) return false;
			return result.quantity || false;
		} catch (err) {
			this.error('getInventory failed:', err);
			throw err;
		}
	}

	// ---
	
	public async getNearestWarehouses(
		productId: TProductId,
		quantity: number,
		destinationCoords: { lat: number; lng: number }
	): Promise<{
		warehouse: TWarehouse
		stock: number
		allocation: number
		distance: number
	}[]> {
		// This will perform geospatial query to get nearest warehouse with positive stock
		// The idea is to get 10 nearest warehouses and in the sorted order of increasing distance
		// then try subtract stock from each until we reach the required quantity
		// or run out of warehouses, if stock is not satisfied and we run out of warehouses, we query next 10 warehouses
		// and repeat until we reach the required quantity or run out of warehouses
		// The query will use PostGIS extension for geospatial queries

		try {

			const queryHelper = async (start: number) => {
				const result = await this.db.query(`
					SELECT w.warehouse_id, w.warehouse_name, w.city, w.coords, i.quantity,
						ROUND(ST_Distance(ST_MakePoint(w.coords), ST_MakePoint(:lat, :lng))::numeric, 2) AS distance
					FROM scoms.warehouses AS w
					LEFT JOIN scoms.inventory AS i ON w.warehouse_id = i.warehouse_id AND i.product_id = :productId
					WHERE i.quantity > 0
					ORDER BY distance ASC
					LIMIT 10 STARTING AT :start
				`, {
					productId,
					lat: destinationCoords.lat,
					lng: destinationCoords.lng,
					start,
				});

				if (!result || !result.length) return [];

				const wares = result.map((row: any) => ({
					warehouse: {
						warehouseId: row.warehouse_id,
						warehouseName: row.warehouse_name,
						city: row.city,
						coords: {
							lat: row.coords[1],
							lng: row.coords[0],
						},
					},
					stock: row.quantity,
					distance: row.distance,
				}));

				return wares;
			};

			let flag = true;
			let start = 0;
			let totalAllocated = 0;
			let warehouses: {
				warehouse: TWarehouse
				stock: number
				allocation: number
				distance: number
			}[] = [];

			while (flag) {
				const wares = await queryHelper(start);
				if (!wares.length) break;

				for (const w of wares) {
					const alloc = Math.min(w.stock, quantity - totalAllocated);
					totalAllocated += alloc;
					w.allocation = alloc;
					warehouses.push(w);

					if (totalAllocated >= quantity) {
						flag = false;
						break;
					}
				}

				start += 10;
			}

			return warehouses;
		}
		catch (err) {
			this.error('getNearestWarehouse failed:', err);
			throw err;
		}

	}

};