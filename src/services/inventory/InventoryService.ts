import { IEventProducer } from '@common/types/events';
import { EAllocationStatus, IInventoryService, TAllocation, TAllocationProposal, TProduct, TProductAttribute, TProductAttrName, TProductId, TWarehouse, TWarehouseId } from '@common/types/inventory';
import { PartialBy } from '@common/lib/util';
import { IPgService } from '@common/types/pg';
import { ILoggerService } from '@common/types/logger';
import { IUIDGenerator } from '@common/types/uid';
import { TOrderId } from '@common/types/order';
import { TNearestWarehouse } from '@services/inventory/types';

// ---

export class InventoryService implements IInventoryService {

	constructor (
		private readonly db: IPgService,
		private readonly logger: ILoggerService,
		private readonly uid: IUIDGenerator,
		private readonly eventProducer: IEventProducer,
	) {
		this.logger.log("Initialize");
	}

	// ---

	public async getAllProducts(): Promise<Omit<TProduct, "attributes">[]> {
		try {
			const result = await this.db.query(`
				SELECT 
					product_id, 
					product_name
				FROM scoms.products;
			`);

			if (!result) {
				this.logger.error('getAllProducts failed: No result returned');
				throw new Error("getAllProducts failed: No result returned");
			}

			const products: Omit<TProduct, "attributes">[] = result.rows.map((row: any) => ({
				productId: row.product_id,
				productName: row.product_name,
			}));

			return products;
		}
		catch (err) {
			this.logger.error('getAllProducts failed:', err);
			throw err;
		}
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
			this.logger.error('createProduct failed:', err);
			throw err;
		}
	}

	public async dangerouslySetAttributes(
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
			this.logger.error('setAttributes failed:', err);
			throw err;
		}
	}

	public async getProduct(idOrName: TProductId | string): Promise<TProduct | false> {
		const prdResult = await this.db.query(`
			SELECT 
				product_id, 
				product_name
			FROM scoms.products
			WHERE product_id = :idOrName OR product_name = :idOrName
			LIMIT 1;
		`, { idOrName });

		if (!prdResult || !prdResult.rowCount) return false;
		
		const attrResult = await this.db.query(`
			SELECT
				*
			FROM scoms.product_attributes
			WHERE product_id = :productId;
		`, { productId: prdResult.rows[0].product_id });

		const attributes: Record<TProductAttrName, TProductAttribute> = {};

		attrResult.rows.forEach((row: any) => {
			attributes[row.attribute] = {
				attributeId: row.attribute_id,
				value: row.value,
				meta: row.meta,
			};
		});

		return {
			productId: prdResult.rows[0].product_id,
			productName: prdResult.rows[0].product_name,
			attributes,
		};
	}

	// ---

	public async getAllWarehouses(): Promise<TWarehouse[]> {
		try {
			const result = await this.db.query(`
				SELECT 
					warehouse_id, 
					warehouse_name, 
					city, 
					coords[0] AS lat,
					coords[1] AS lng
				FROM scoms.warehouses;
			`);

			if (!result) {
				this.logger.error('getAllWarehouses failed: No result returned');
				throw new Error("getAllWarehouses failed: No result returned");
			}

			const warehouses: TWarehouse[] = result.rows.map((row: any) => ({
				warehouseId: row.warehouse_id,
				warehouseName: row.warehouse_name,
				city: row.city,
				coords: {
					lat: row.lat,
					lng: row.lng,
				},
			}));

			return warehouses;
		}
		catch (err) {
			this.logger.error('getAllWarehouses failed:', err);
			throw err;
		}
	}

	public async getWarehouse(warehouseId: TWarehouseId): Promise<TWarehouse | false> {
		try {
			const result = await this.db.query(`
				SELECT 
					warehouse_id, 
					warehouse_name, 
					city, 
					coords[0] AS lat,
					coords[1] AS lng
				FROM scoms.warehouses
				WHERE warehouse_id = :warehouseId;
			`, { warehouseId });

			if (!result || !result.rowCount) return false;

			return {
				warehouseId: result.rows[0].warehouse_id,
				warehouseName: result.rows[0].warehouse_name,
				city: result.rows[0].city,
				coords: {
					lat: result.rows[0].lat,
					lng: result.rows[0].lng,
				},
			};
		}
		catch (err) {
			this.logger.error('getWarehouse failed:', err);
			throw err;
		}
	}

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
				this.logger.error('createWarehouse failed: No result returned');
				throw new Error("createWarehouse failed: No result returned");
			}

			return {
				warehouseId,
				warehouseName,
				city,
				coords,
			};
			
		} catch (err) {
			this.logger.error('createWarehouse failed:', err);
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
				INSERT INTO 
					scoms.inventory (warehouse_id, product_id, quantity)
				VALUES 
					(:warehouseId, :productId, :quantity)
				ON CONFLICT 
					(warehouse_id, product_id) DO UPDATE SET
						quantity = scoms.inventory.quantity + EXCLUDED.quantity
				RETURNING quantity
			`, {
				warehouseId,
				productId,
				quantity,
			});

			if (!result) {
				this.logger.error('addInventory failed: No result returned');
				throw new Error("addInventory failed: No result returned");
			}

			return result.rows[0].quantity || false;
		} catch (err) {
			this.logger.error('addInventory failed:', err);
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
				WHERE 
					warehouse_id = :warehouseId AND 
					product_id = :productId AND 
					quantity >= :quantity
				RETURNING quantity;
			`, {
				warehouseId,
				productId,
				quantity,
			});

			if (!result || !result.rowCount) {
				this.logger.error('subtractInventory failed: No result returned');
				throw new Error("subtractInventory failed: No result returned");
			}

			return result.rows[0].quantity || false;
		}
		catch (err) {
			this.logger.error('subtractInventory failed:', err);
			throw err;
		}
		
	}

	public async getAllInventory(
		warehouseId: TWarehouseId
	): Promise<{
		productId: TProductId
		productName: string
		quantity: number
	}[]> {
		try {
			const result = await this.db.query(`
				SELECT 
					i.product_id, 
					p.product_name, 
					i.quantity
				FROM scoms.inventory AS i
				LEFT JOIN scoms.products AS p ON i.product_id = p.product_id
				WHERE i.warehouse_id = :warehouseId;
			`, { warehouseId });

			if (!result) {
				this.logger.error('getAllInventory failed: No result returned');
				throw new Error("getAllInventory failed: No result returned");
			}

			return result.rows.map((row: any) => ({
				productId: row.product_id,
				productName: row.product_name,
				quantity: row.quantity,
			}));
		} catch (err) {
			this.logger.error('getAllInventory failed:', err);
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
				LEFT JOIN scoms.products AS p 
					ON i.product_id = p.product_id
				WHERE 
					i.warehouse_id = :warehouseId AND 
					(p.product_id = :productidOrName OR p.product_name = :productidOrName)
				LIMIT 1;
			`, {
				warehouseId,
				productidOrName,
			});

			if (!result || !result.rowCount) return false;
			return result.rows[0].quantity || false;
		} catch (err) {
			this.logger.error('getInventory failed:', err);
			throw err;
		}
	}

	// ---

	public async isAllocationValid(
		allocations: TAllocationProposal[],
	): Promise<boolean> {
		// This will try to allocate stock from the warehouse, and check if it is possible
		// It will run an allocation and then rollback the transaction

		const { query, rollback } = await this.db.transact();
		const orderId = this.uid();
		let flag = true;

		try {
			await Promise.all(allocations.map(async ({ warehouseId, productId, quantity }) => {
				const updQuery = query(`
						UPDATE scoms.inventory
						SET quantity = quantity - :quantity
						WHERE 
							warehouse_id = :warehouseId AND 
							product_id = :productId AND 
							quantity >= :quantity
						RETURNING quantity;
					`,
					{ warehouseId, productId, quantity }
				);

				const allocQuery = query(`
					INSERT INTO scoms.allocations (
						allocation_id,
						order_id, 
						warehouse_id, 
						product_id, 
						quantity, 
						status
					)
					VALUES (
						:allocationId,
						:orderId, 
						:warehouseId, 
						:productId, 
						:quantity, 
						:status
					)
				`, {
					allocationId: this.uid(),
					orderId,
					warehouseId,
					productId,
					quantity,
					status: EAllocationStatus.PENDING,
				});

				const [updResult, allocResult] = await Promise.all([updQuery, allocQuery]);

				if (!updResult || !allocResult) flag = false;
				if (!updResult.rowCount || !allocResult.rowCount) flag = false;
			}));
		}
		catch (err) {
			this.logger.error('isAllocationValid failed:', err);
			flag = false;
		}
		finally {
			await rollback();
		}

		return flag;
	}
	
	public async allocateStock(
		orderId: TOrderId,
		allocations: TAllocationProposal[],
	): Promise<boolean> {
		// This will create allocation record with status set to pending
		// This will NOT deduct any stocks from the warehouse

		try {
			let allocQuery = `
				INSERT INTO scoms.allocations (
					allocation_id,
					order_id, 
					warehouse_id, 
					product_id, 
					quantity, 
					status
				)
				VALUES 
			`;

			const paramObject: Record<string, string | number | null> = {};

			allocations.forEach(({ warehouseId, productId, quantity }, i) => {
				const iStr = i.toString();
				const allocId = this.uid();
				
				paramObject[`allocation_id_${iStr}`] = allocId;
				paramObject[`warehouse_id_${iStr}`] = warehouseId;
				paramObject[`product_id_${iStr}`] = productId;
				paramObject[`quantity_${iStr}`] = quantity;

				allocQuery += `(
					:allocation_id_${iStr}, 
					:orderId, 
					:warehouse_id_${iStr}, 
					:product_id_${iStr}, 
					:quantity_${iStr}, 
					:status
				)`;

				if (i < allocations.length - 1) allocQuery += ',';
			});
			
			const result = await this.db.query(allocQuery, {
				...paramObject,
				status: EAllocationStatus.PENDING,
				orderId,
			});

			if (!result || !result.rowCount) {
				this.logger.error('allocateInventory failed: No result returned');
				return false;
			}
			
			return true;
		} catch (err) {
			this.logger.error('allocateInventory failed:', err);
			return false;
		}
	}

	public async confirmAllocation(
		orderId: TOrderId,
	): Promise<boolean> {
		// This will set the status of the allocation to confirmed, and remove the stock from the warehouse

		const allocations = await this.getAllocatedStock(orderId);

		if (!allocations.length) {
			this.logger.error('confirmAllocation failed: No allocations found for orderId', orderId);
			return false;
		}

		if (allocations.some((a) => a.status !== EAllocationStatus.PENDING)) {
			this.logger.error('confirmAllocation failed: Some allocations are not in pending state!', orderId);
			return false;
		}

		const { query, commit, rollback } = await this.db.transact();
		try {

			const invResults = await Promise.all(allocations.map(async ({ warehouseId, productId, quantity }) => {				
				const invQuery = await query(`
						UPDATE scoms.inventory
						SET quantity = quantity - :quantity
						WHERE 
							warehouse_id = :warehouseId AND 
							product_id = :productId AND 
							quantity >= :quantity
						RETURNING quantity;
					`,
					{ warehouseId, productId, quantity }
				);

				if (!invQuery || !invQuery.rowCount) {
					this.logger.error('confirmAllocation failed: No result returned', warehouseId, productId);
					return false;
				}

				if (!invQuery.rows[0]?.quantity || invQuery.rows[0].quantity < 0) {
					this.logger.error('confirmAllocation failed: Not enough stock', warehouseId, productId);
					return false;
				}

				return true;
			}));

			if (invResults.some((r) => !r)) {
				this.logger.error('confirmAllocation failed: Some inventory updates failed', orderId);
				await rollback();
				return false;
			}

			const allocQuery = await query(`
				UPDATE scoms.allocations
					SET status = :statusConfirmed
				WHERE 
					order_id = :orderId AND 
					status = :statusPending;
			`, { 
				orderId,
				statusPending: EAllocationStatus.PENDING,
				statusConfirmed: EAllocationStatus.CONFIRMED,
			});

			if (!allocQuery || !allocQuery.rowCount) {
				this.logger.error('Failed to update allocation status', orderId);
				await rollback();
				return false;
			}

			await commit();
			return true;
		}
		catch (err) {
			this.logger.error('confirmAllocation failed:', err);
			await query('ROLLBACK');
			return false;
		}
	}
	
	public async cancelAllocation(
		orderId: TOrderId
	): Promise<boolean> {
		// This will set the status of the allocation to cancelled, and add the stock back to the warehouse

		const { query, commit, rollback } = await this.db.transact();
		try {
			const allocResult = await query(`
				UPDATE scoms.allocations
					SET status = 'CANCELLED'
				WHERE 
					order_id = :orderId AND 
					status IN ('CONFIRMED', 'PENDING');
				`,
				{ orderId }
			);

			if (!allocResult || !allocResult.rowCount) {
				this.logger.error('cancelAllocation failed: No result returned');
				rollback();
				return false;
			}

			const updResult = await query(`
				UPDATE scoms.inventory AS i
				SET quantity = i.quantity + a.quantity
				FROM scoms.allocations AS a
				WHERE 
					a.order_id = :orderId AND 
					a.status = 'CANCELLED' AND 
					i.warehouse_id = a.warehouse_id AND 
					i.product_id = a.product_id
			`, { orderId });

			if (!updResult || !updResult.rowCount) {
				this.logger.error('cancelAllocation failed: No result returned');
				await rollback();
				return false;
			}

			await commit();
			return true;
		}
		catch (err) {
			this.logger.error('cancelAllocation failed:', err);
			await query('ROLLBACK');
			return false;
		}
	}

	public async getAllocatedStock(
		orderId: TOrderId
	): Promise<TAllocation[]> {
		// This will get all allocations for the order, and return them as a list of warehouse-product pairs
		try {
			const result = await this.db.query(`
				SELECT 
					warehouse_id, 
					product_id, 
					quantity, 
					status
				FROM scoms.allocations
				WHERE order_id = :orderId;
			`, { orderId });

			return result.rows.map((row: any) => ({
				warehouseId: row.warehouse_id,
				productId: row.product_id,
				quantity: row.quantity,
				status: row.status,
			}));
		}
		catch (err) {
			this.logger.error('getAllocatedStock failed:', err);
			throw err;
		}
	}

	// ---

	public async getNearestWarehouses(
		productId: TProductId,
		quantity: number,
		destinationCoords: { lat: number; lng: number }
	): Promise<TNearestWarehouse[]> {
		// This will perform geospatial query to get nearest warehouse with positive stock
		// The idea is to get 10 nearest warehouses and in the sorted order of increasing distance
		// then try subtract stock from each until we reach the required quantity
		// or run out of warehouses, if stock is not satisfied and we run out of warehouses, we query next 10 warehouses
		// and repeat until we reach the required quantity or run out of warehouses
		// The query will use PostGIS extension for geospatial queries

		try {

			const queryHelper = async (start: number) => {
				const result = await this.db.query(`
					SELECT 
						w.warehouse_id, 
						w.warehouse_name, 
						w.city, 
						w.coords[0] AS lat,
						w.coords[1] AS lng, 
						i.quantity,

						ROUND(ST_Distance(
							w.coords::geometry,
							ST_MakePoint(:lat, :lng)::geometry
						)::numeric, 2) AS distance

					FROM scoms.warehouses AS w
					LEFT JOIN scoms.inventory AS i ON w.warehouse_id = i.warehouse_id AND i.product_id = :productId
					WHERE i.quantity > 0
					ORDER BY distance ASC
					LIMIT 10 OFFSET :start
				`, {
					productId,
					lat: destinationCoords.lat,
					lng: destinationCoords.lng,
					start,
				}, true);

				if (!result || !result.rowCount) return [];

				const wares: TNearestWarehouse[] = result.rows.map((row: any) => ({
					warehouse: {
						warehouseId: row.warehouse_id,
						warehouseName: row.warehouse_name,
						city: row.city,
						coords: {
							lat: row.lat,
							lng: row.lng,
						},
					},

					stock: row.quantity,
					distance: row.distance,
					allocation: 0,
				}));

				return wares;
			};

			let flag = true;
			let start = 0;
			let totalAllocated = 0;
			let warehouses: TNearestWarehouse[] = [];

			// until we reach the required quantity or run out of warehouses
			// we will keep querying the next 10 warehouses and try to allocate stock from them
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
			this.logger.error('getNearestWarehouse failed:', err);
			throw err;
		}

	}

};