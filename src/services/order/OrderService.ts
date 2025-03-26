import { ICRMService, TAddressId, TUserId } from '@common/types/crm';
import { EEventType, IEventProducer } from '@common/types/events';
import { IInventoryService } from '@common/types/inventory';
import { ILoggerService } from '@common/types/logger';
import { EOrderStatus, IOrderService, TOrder, TOrderAllocation, TOrderId, TOrderItem, TOrderPriceBreakdown, TOrderPricing } from '@common/types/order';
import { IPgService } from '@common/types/pg';
import { IUIDGenerator } from '@common/types/uid';

// ---

export class OrderService implements IOrderService {

	constructor (
		private readonly db: IPgService,
		private readonly logger: ILoggerService,
		private readonly uid: IUIDGenerator,
		private readonly eventProducer: IEventProducer,

		private readonly inventoryService: IInventoryService,
		private readonly crmService: ICRMService,
	) {
		this.logger.log("Initialize");
	}

	// ---

	public async createOrder(
		externalCustomerId: TUserId,
		addressId: TAddressId,
		agentId: TUserId,
		items: TOrderItem[],
	): Promise<TOrder | false> {
		const { query, commit } = await this.db.transact();

		try {
			const orderId = this.uid();

			// Insert main record
			const t1 = await query(`
				INSERT INTO orders (order_id, external_customer_id, address_id, agent_id)
				VALUES (:orderId, :externalCustomerId, :addressId, :agentId)
				ON CONFLICT (order_id) DO NOTHING
				RETURNING order_id, external_customer_id, address_id, agent_id;
			`, {
				orderId,
				externalCustomerId,
				addressId,
				agentId,
			});

			// Insert items
			let itemsQuery = `
				INSERT INTO order_items (order_id, product_id, quantity)
			`;
			const params: Record<string, any> = {};

			const itemsQueryParts = items.map((item, i) => {
				const iStr = i.toString();
				params[`product_id_${iStr}`] = item.productId;
				params[`quantity_${iStr}`] = item.quantity;

				return `(:orderId, :product_id_${iStr}, quantity_${iStr})`;
			});

			itemsQuery += itemsQueryParts.join(', ');
			itemsQuery += `
				ON CONFLICT (order_id, product_id) DO NOTHING
				RETURNING order_id, product_id, quantity;
			`;

			const t2 = await query(itemsQuery, {
				...params,
				orderId,
			});

			// wait for all
			await Promise.all([t1, t2]);
			await commit();
				
			// Done
			return {
				orderId: t1.rows[0].order_id,
				externalCustomerId: t1.rows[0].external_customer_id,
				address: t1.rows[0].address_id,
				agentId: t1.rows[0].agent_id,
				status: 'draft',
				items,
				pricing: [],
				allocations: [],
			} as TOrder;
		}
		catch (error) {
			this.logger.error('Error creating order', { error });
			throw error;
		}
	}

	public async updateDraftOrder(
		orderId: TOrderId,
		items: TOrderItem[],
		addressId: TAddressId,
	): Promise<Partial<TOrder> | false> {
		const { query, commit } = await this.db.transact();

		try {
			// Update main record
			const t1 = await query(`
				UPDATE orders
				SET address_id = :addressId
				WHERE order_id = :orderId
				RETURNING order_id, address_id;
			`, {
				orderId,
				addressId,
			});

			// Update items
			let itemsQuery = `
				UPDATE order_items
				SET quantity = CASE product_id
			`;
			const params: Record<string, any> = {};

			const itemsQueryParts = items.map((item, i) => {
				const iStr = i.toString();
				params[`product_id_${iStr}`] = item.productId;
				params[`quantity_${iStr}`] = item.quantity;

				return `WHEN :product_id_${iStr} THEN :quantity_${iStr}`;
			});

			itemsQuery += itemsQueryParts.join(' ');
			itemsQuery += `END WHERE order_id = :orderId;`;

			const t2 = await query(itemsQuery, {
				...params,
				orderId,
			});

			// wait for all
			await Promise.all([t1, t2]);
			await commit();

			return {
				orderId: t1.rows[0].order_id,
				address: t1.rows[0].address_id,
				status: EOrderStatus.draft,
				items,
			};
		}
		catch (error) {
			this.logger.error('Error updating draft order', { error });
			throw error;
		}
	}

	// ---

	public async previewOrder(
		orderId: TOrderId,
	): Promise<TOrder | false> {
		// This method will get a draft order
		// Then it will get the nearest warehouse for each item from InventoryService.getNearestWarehouses()
		// Then it will calculateOrderPricing() after assigning the allocations to the order
		// Then it will return the order with the pricing and allocations

		try {
			const order = await this.getOrderById(orderId);
			if (!order) {
				this.logger.error('Order not found', { orderId });
				return false;
			}

			// Get nearest warehouse for each item
			const allocPerProduct = await Promise.all(order.items.map(async (item) => {
				const res = await this.inventoryService.getNearestWarehouses(
					item.productId,
					item.quantity,
					order.address.coords,
				);

				const allocations: TOrderAllocation[] = res.map((alloc) => ({
					warehouseId: alloc.warehouse.warehouseId,
					productId: item.productId,
					quantity: item.quantity,
					distance: alloc.distance,
				}));

				return allocations;
			}));

			// Flatten the allocations array and assign to order
			order.allocations = allocPerProduct.flat();

			// Calculate pricing
			const pricing = await this.calculateOrderPricing(order);
			if (!pricing) {
				this.logger.error('Error calculating order pricing', { orderId });
				return false;
			}

			// Assign pricing to order
			order.pricing = pricing;

			// Done
			return order;
		}
		catch (error) {
			this.logger.error('Error previewing order', { orderId, error });
			throw error;
		}
	}

	private async calculateOrderPricing(
		order: TOrder
	): Promise<TOrderPricing | false> {
		// This method will get price for each item using InventoryService.getProduct().attributes.price
		// Then it will calculate the price per item and total price
		// Price per item is calculated as shipping distance * price per km * quantity, for each warehouse
		// Total price is as follows:
		// (sum of all items prices) - (volume discounts) + (shipping cost)
		// Then it will return the pricing object, with accurate breakdown of the pricing, including discount and shipping cost

		// First get price and weight for all products in the order
		let products = await Promise.all(order.items.map(async (item) => {
			const product = await this.inventoryService.getProduct(item.productId);

			if (!product) {
				this.logger.error('Product not found', { productId: item.productId });
				throw `Product not found: ${item.productId}`;
			}

			return {
				productId: product.productId,
				price: parseInt(product.attributes.price!.value!),
				weight: parseInt(product.attributes.weight!.value!),
				volumeDiscount: parseInt(product.attributes.volumeDiscount!.value!),
			};
		}));

		// Calculate price per item = item order quantity * product price, volume discount
		const pricePerItem: TOrderPriceBreakdown[] = products.map((product, i) => {
			return {
				productId: product.productId,
				price: product.price * order.items[i].quantity,
				shippingCost: 0,
				discount: product.volumeDiscount * order.items[i].quantity,
			};
		});

		// Calculate shipping cost = s $0.01 per kilogram per kilometer
		order.allocations.forEach((alloc) => {
			const product = products.find((p) => p.productId === alloc.productId);
			const priceBreakdown = pricePerItem.find((p) => p.productId === alloc.productId);

			if (!product || !priceBreakdown) {
				this.logger.error('Product not found for allocation', { productId: alloc.productId });
				throw `Product not found for allocation: ${alloc.productId}`;
			}

			const shippingCost = alloc.distance * 0.01 * product.weight * alloc.quantity;
			priceBreakdown.shippingCost += shippingCost;
		});

		// all done
		return pricePerItem;

	}

	public async validateOrder(
		order: TOrder
	): Promise<true | string> {
		// This method will check if the given order is valid and sane.
		// Validity is based on following:
		// 1. The order object provided should be draft and contain all necessary fields
		// 2. The pricing for the order will be recalculated and compared to the order pricing
		// 3. The order item allocations will be checked if they are in stock and the quantity is available at respective warehouses
		// 4. The pricing should not be more than 15% of shipping cost - hardcoded check on the order shipping cost
		// if all succeeds, return true
		// else return reason why the order is invalid

		// 1. Check if order is draft and contains all necessary fields
		if (order.status !== EOrderStatus.draft) {
			return 'Order is not draft';
		}
		if (!order.items || !order.items.length) {
			return 'Order does not contain any items';
		}
		if (!order.allocations || !order.allocations.length) {
			return 'Order does not contain warehouse allocations';
		}
		if (!order.pricing || !order.pricing.length) {
			return 'Order does not contain pricing breakdown';
		}

		// 2. Check if pricing is valid
		const pricing = await this.calculateOrderPricing(order);
		if (!pricing) {
			return 'Error calculating order pricing';
		}
		
		const isPricingValid = order.pricing.every((item, i) => {
			const priceBreakdown = pricing.find((p) => p.productId === item.productId);
			if (!priceBreakdown) return false;
			return item.price === priceBreakdown.price && item.shippingCost === priceBreakdown.shippingCost && item.discount === priceBreakdown.discount;
		});
		
		if (!isPricingValid) {
			return 'Order pricing is not valid';
		}

		// 3. Check if allocations are valid
		const allocationsValid = await Promise.all(order.allocations.map(async (alloc) => {
			const stock = await this.inventoryService.getInventory(alloc.warehouseId, alloc.productId);
			if (!stock) return false;
			return stock >= alloc.quantity;
		}));

		if (allocationsValid.some((valid) => !valid)) {
			return 'Order allocations are not valid';
		}

		// 4. Check if pricing is valid
		const totalPrice = order.pricing.reduce((acc, item) => acc + item.price, 0);
		const totalShippingCost = order.pricing.reduce((acc, item) => acc + item.shippingCost, 0);
		const totalDiscount = order.pricing.reduce((acc, item) => acc + item.discount, 0);
		const totalCost = totalPrice - totalDiscount + totalShippingCost;
		const maxShippingCost = totalShippingCost * 0.15;
		if (totalCost > maxShippingCost) {
			return 'Order pricing is more than 15% of shipping cost';
		}

		// All checks passed
		return true;
	}

	public async confirmOrder(
		orderId: TOrderId,
		order: TOrder,
	): Promise<TOrderId | false> {
		// This will first validate the order object using validateOrder()
		// If valid:
		// 1. This will confirm the order and set the status to confirmed
		// 2. It will also update the order in the database with the allocations and pricing
		// - the first two steps will be done paralell using transaction -
		// 3. It will also send the order to the event producer for further processing
		// 4. It will return the orderId
		// else it will return the reason why the order is invalid

		// 1. Validate the order
		const validationResult = await this.validateOrder(order);
		if (validationResult !== true) {
			this.logger.error('Order is not valid', { orderId, validationResult });
			return false;
		}

		this.logger.log('Order is valid', { orderId });
		// 2. Confirm the order and set the status to confirmed
		const { query, commit } = await this.db.transact();
		try {

			// Update the order status to processing
			const t1 = await query(`
				UPDATE orders
				SET status = :statusProcessing
				WHERE order_id = :orderId & & status = :statusDraft
				RETURNING order_id, status;
			`, {
				orderId,
				statusProcessing: EOrderStatus.processing,
				statusDraft: EOrderStatus.draft,
			});

			// Update the order items with the allocations
			let q2 = `
				UPDATE order_items
				SET quantity = CASE product_id
			`;
			const params: Record<string, any> = {};

			const itemsQueryParts = order.items.map((item, i) => {
				const iStr = i.toString();
				params[`product_id_${iStr}`] = item.productId;
				params[`quantity_${iStr}`] = item.quantity;

				return `WHEN :product_id_${iStr} THEN :quantity_${iStr}`;
			});

			q2 += itemsQueryParts.join(' ');
			q2 += `END WHERE order_id = :orderId;`;

			const t2 = await query(q2, {
				...params,
				orderId,
			});

			// Try committing the transaction
			await Promise.all([t1, t2]);
			await commit();

			// 3. Send the order to the event producer for further processing
			this.eventProducer.emit({
				eventType: EEventType.ORDER_PROCESSING,
				payload: {
					orderId: t1.rows[0].order_id,
				},
			});

			// Done
			return t1.rows[0].order_id;
			
		}
		catch (error) {
			this.logger.error('Error confirming order', { orderId, error });
			throw error;
		}

	}

	public async setOrderStatus(
		orderId: TOrderId,
		status: EOrderStatus,
	): Promise<boolean> {
		// This is used to set oprder status according to rules
		// 1. A draft order can be set to processing
		// 2. A processing order can be set to fulfilled or cancelled 

		const expectedStatus = status === EOrderStatus.draft ? EOrderStatus.draft : EOrderStatus.processing;

		try {
			const result = await this.db.query(`
				UPDATE orders
				SET status = :status
				WHERE order_id = :orderId AND status = :expectedStatus
			`, {
				orderId,
				status,
				expectedStatus,
			});

			if (!result.rowCount) {
				this.logger.error('Could not set order status', { orderId, status });
				return false;
			}

			return true;
		}
		catch (error) {
			this.logger.error('Error setting order status', { orderId, status, error });
			throw error;
		}
	};

	// ---

	public async getOrderById(
		orderId: TOrderId,
	): Promise<TOrder | false> {
		try {

			// Fetch main order record
			const resOrder = await this.db.query(`
				SELECT *
				FROM orders
				WHERE orders.order_id = :orderId
			`, {
				orderId
			});

			if (!resOrder.rowCount) {
				this.logger.error('Order not found', { orderId });
				return false;
			}

			// fetch meta records
			const qItems = this.db.query(`
				SELECT *
				FROM order_items
				WHERE order_items.order_id = :orderId
			`, {
				orderId
			});

			const qPricing = this.db.query(`
				SELECT *
				FROM order_pricing
				WHERE order_pricing.order_id = :orderId
				LIMIT 1
			`, {
				orderId
			});

			const qAlloc = this.db.query(`
				SELECT *
				FROM order_allocations
				WHERE order_allocations.order_id = :orderId
			`, {
				orderId
			});

			const qAddr = this.crmService.getAddress(resOrder.rows[0].address_id);

			const [
				resItems,
				resPricing,
				resAllocations,
				resAddr,
			] = await Promise.all([qItems, qPricing, qAlloc, qAddr]);

			if (!resAddr) {
				this.logger.error('Address not found', { addressId: resOrder.rows[0].address_id });
				return false;
			}

			// All done
			return {
				orderId: resOrder.rows[0].order_id,
				externalCustomerId: resOrder.rows[0].external_customer_id,
				address: resAddr,
				agentId: resOrder.rows[0].agent_id,
				status: resOrder.rows[0].status,

				items: resItems.rows.map((row: any) => ({
					productId: row.product_id,
					quantity: row.quantity,
				})) as TOrderItem[],

				pricing: resPricing.rows?.map((row: any) => ({
					productId: row.product_id,
					price: row.price,
					shippingCost: row.shipping_cost,
					discount: row.discount,
				}) as TOrderPriceBreakdown) || [],

				allocations: resAllocations.rows?.map((row: any) => ({
					warehouseId: row.warehouse_id,
					productId: row.product_id,
					quantity: row.quantity,
				}) as TOrderAllocation) || [],

			};
		}
		catch (error) {
			this.logger.error('Error getting order by ID', { orderId, error });
			throw error;
		}
	}

	public async getOrdersByCustomerId(
		customerId: TUserId,
	): Promise<TOrderId[]> {
		try {
			const result = await this.db.query(`
				SELECT order_id
				FROM orders
				WHERE external_customer_id = :customerId
			`, {
				customerId,
			});

			return result.rows.map((row: any) => row.order_id);
		}
		catch (error) {
			this.logger.error('Error getting orders by customer ID', { customerId, error });
			throw error;
		}
	}

	public async getOrdersByAddressId(
		addressId: TAddressId,
	): Promise<TOrderId[]> {
		try {
			const result = await this.db.query(`
				SELECT order_id
				FROM orders
				WHERE address_id = :addressId
			`, {
				addressId,
			});

			return result.rows.map((row: any) => row.order_id);
		}
		catch (error) {
			this.logger.error('Error getting orders by address ID', { addressId, error });
			throw error;
		}
	}

	public async getOrdersByAgentId(
		agentId: TUserId,
	): Promise<TOrderId[]> {
		try {
			const result = await this.db.query(`
				SELECT order_id
				FROM orders
				WHERE agent_id = :agentId
			`, {
				agentId,
			});

			return result.rows.map((row: any) => row.order_id);
		}
		catch (error) {
			this.logger.error('Error getting orders by agent ID', { agentId, error });
			throw error;
		}
	}

}
