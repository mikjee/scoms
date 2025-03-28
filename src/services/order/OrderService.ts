import { ICRMService, TAddressId, TUserId } from '@common/types/crm';
import { EEventType, IEventProducer } from '@common/types/events';
import { IInventoryService, TAllocation, TAllocationProposal } from '@common/types/inventory';
import { ILoggerService } from '@common/types/logger';
import { EOrderStatus, IOrderService, TFinalizedOrder, TNewOrderParams, TOrderDraft, TOrderId, TOrderItem, TOrderProposal, TOrderStrategyId } from '@common/types/order';
import { IPgService } from '@common/types/pg';
import { IUIDGenerator } from '@common/types/uid';
import { IOrderPricingStrategyHandler, IOrderShippingStrategyHandler, IOrderStrategyHandler, IOrderValidationStrategyHandler } from './types';
import _ from 'lodash';

// ---

export class OrderService implements IOrderService {

	private readonly mapOrderStrategyToHandler: Record<TOrderStrategyId, IOrderStrategyHandler> = {};

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

	public registerStrategy(strategyId: TOrderStrategyId, handler: IOrderStrategyHandler): void {
		this.mapOrderStrategyToHandler[strategyId] = handler;
		this.logger.log(`Registered strategy ${strategyId}`);
	}

	public getStrategy(strategyId: TOrderStrategyId): IOrderStrategyHandler | false {
		return this.mapOrderStrategyToHandler[strategyId] || false;
	}

	// ---

	public async createDraftOrder(
		params: TNewOrderParams,
	): Promise<TOrderDraft | false> {
		const { query, commit } = await this.db.transact();

		try {
			const orderId = this.uid();

			// Insert main record
			const t1 = await query(`
				INSERT INTO scoms.orders (
					order_id, 
					external_customer_id, 
					address_id, 
					agent_id,
					pricing_strategy,
					shipping_strategy
				)
				VALUES (
					:orderId, 
					:externalCustomerId, 
					:addressId, 
					:agentId,
					:pricingStrategy,
					:shippingStrategy
				)
				RETURNING order_id, status, created_on;
			`, {
				orderId,
				externalCustomerId: params.externalCustomerId,
				addressId: params.addressId,
				agentId: params.agentId,
				pricingStrategy: params.pricingStrategy,
				shippingStrategy: params.shippingStrategy,
			});

			// Insert items
			let itemsQuery = `INSERT INTO scoms.order_items (order_id, product_id, quantity) VALUES`;
			const queryParams: Record<string, any> = {};

			const itemsQueryParts = params.items.map((item, i) => {
				const iStr = i.toString();
				queryParams[`product_id_${iStr}`] = item.productId;
				queryParams[`quantity_${iStr}`] = item.quantity;
				return ` (:orderId, :product_id_${iStr}, :quantity_${iStr}) `;
			});

			itemsQuery += itemsQueryParts.join(', ');
			itemsQuery += `RETURNING order_id, product_id, quantity;`;

			const t2 = await query(itemsQuery, {
				...queryParams,
				orderId,
			});

			// wait for all
			await Promise.all([t1, t2]);
			await commit();
				
			// Done
			return {
				orderId,

				externalCustomerId: params.externalCustomerId,
				addressId: params.addressId,
				agentId: params.agentId,

				items: params.items,

				pricingStrategy: params.pricingStrategy,
				shippingStrategy: params.shippingStrategy,
				validationStrategy: params.validationStrategy,
				
				status: t1.rows[0].status,
				createdOn: t1.rows[0].created_on,
			};

		}
		catch (error) {
			this.logger.error('Error creating order', { error });
			throw error;
		}
	}

	public async updateDraftOrder(
		orderId: TOrderId,
		params: Partial<TNewOrderParams>,
	): Promise<boolean> {
		const { query, commit } = await this.db.transact();

		try {
			// Update main record - construct query based on which params are provided
			const t1 = await query(`
				UPDATE orders
				SET 
					external_customer_id = COALESCE(:externalCustomerId, external_customer_id),
					address_id = COALESCE(:addressId, address_id),
					agent_id = COALESCE(:agentId, agent_id),
					pricing_strategy = COALESCE(:pricingStrategy, pricing_strategy),
					shipping_strategy = COALESCE(:shippingStrategy, shipping_strategy)
				WHERE order_id = :orderId AND status = :statusDraft
				RETURNING order_id;
			`, {
				orderId,
				statusDraft: EOrderStatus.DRAFT,

				external_customer_id: params.externalCustomerId,
				addressId: params.addressId,
				agentId: params.agentId,
				pricingStrategy: params.pricingStrategy,
				shippingStrategy: params.shippingStrategy,
			});

			// Update items // TODO: delete old items, insert new items! IMPORTANT!
			let itemsQuery = `
				UPDATE order_items
				SET quantity = CASE product_id
			`;
			const queryParams: Record<string, any> = {};

			const itemsQueryParts = params.items?.map((item, i) => {
				const iStr = i.toString();
				queryParams[`product_id_${iStr}`] = item.productId;
				queryParams[`quantity_${iStr}`] = item.quantity;
				return `WHEN :product_id_${iStr} THEN :quantity_${iStr}`;
			}) || [];

			itemsQuery += itemsQueryParts.join(' ');
			itemsQuery += `END WHERE order_id = :orderId;`;

			const t2 = await params.items?.length ? query(itemsQuery, {
				...queryParams,
				orderId,
			}) : true;

			// wait for all
			await Promise.all([t1, t2]);
			await commit();

			// Done
			return true;
		}
		catch (error) {
			this.logger.error('Error updating draft order', { error });
			throw error;
		}
	}

	// ---

	public async createOrderProposal(
		orderId: TOrderId,
	): Promise<TOrderProposal | false> {
		// This method will get a draft order
		// Then it will assign allocations to the order using calculateOrderAllocations()
		// Then it will calculateOrderPricing() after assigning the allocations to the order
		// Then it will return the order with the pricing and allocations

		try {
			const order = await this.getOrder(orderId);

			if (!order) {
				this.logger.error('Order not found', { orderId });
				return false;
			}
			
			const proposedOrder = {...order } as TOrderProposal;
			proposedOrder.allocations = await this.calculateOrderAllocations(proposedOrder);
			proposedOrder.pricing = await this.calculateOrderPricing(proposedOrder);;

			return proposedOrder;
		}
		catch (error) {
			this.logger.error('Error previewing order', { orderId, error });
			throw error;
		}
	}

	private async calculateOrderAllocations(
		order: TOrderDraft | TOrderProposal,
	): Promise<TAllocationProposal[]> {
		const handler = this.getStrategy(order.shippingStrategy) as IOrderShippingStrategyHandler | false;

		if (!handler) {
			this.logger.error('No shipping strategy found', { orderId: order.orderId });
			throw `No shipping strategy found for order ${order.orderId}`;
		}

		return handler(
			order,

			this.db,
			this.logger,
			this.uid,
			this.eventProducer,

			this.inventoryService,
			this.crmService,
		);
	}

	private async calculateOrderPricing(
		order: TOrderProposal,
	): Promise<any> {
		const handler = this.getStrategy(order.pricingStrategy) as IOrderPricingStrategyHandler | false;

		if (!handler) {
			this.logger.error('No pricing strategy found', { orderId: order.orderId });
			return false;
		}

		return handler(
			order,

			this.db,
			this.logger,
			this.uid,
			this.eventProducer,

			this.inventoryService,
			this.crmService,
		);
	}

	public async validateOrderProposal(
		order: TOrderProposal,
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
		if (order.status !== EOrderStatus.DRAFT) return 'Order is not draft';
		if (!order.items || !order.items.length) return 'Order does not contain any items';
		if (!order.allocations || !order.allocations.length) return 'Order does not contain warehouse allocations';
		if (!order.pricing) return 'Order does not contain pricing breakdown';

		// 2. Check if pricing is valid
		const pricing = await this.calculateOrderPricing(order);
		if (!pricing) return 'Error calculating order pricing';
		
		const isPricingValid = _.isEqual(pricing, order.pricing);
		if (!isPricingValid) return 'Order pricing is not valid';
		
		// 3. Check if allocations are valid
		const allocationsValid = await this.inventoryService.isAllocationValid(order.allocations);
		if (allocationsValid === false) {
			this.logger.error('Allocations cannot be satisfied', { orderId: order.orderId });
			return 'Allocations cannot be satisfied';
		}

		// 4. Check if pricing is valid
		const handler = this.getStrategy(order.validationStrategy) as IOrderValidationStrategyHandler | false;
		if (!handler) {
			this.logger.error(`Validation strategy (${order.validationStrategy}) is not registered!`, { orderId: order.orderId });
			return `Validation strategy (${order.validationStrategy}) is not registered!`;
		}

		const validity = await handler(
			order,
			this.db,
			this.logger,
			this.uid,
			this.eventProducer,

			this.inventoryService,
			this.crmService,
		);
		if (!validity) return `Order validation strategy (${order.validationStrategy}) returned false - order is invalid!`;

		// All checks passed
		return true;
	}

	public async finalizeOrder(
		orderId: TOrderId,
		order: TOrderProposal,
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
		const validationResult = await this.validateOrderProposal(order);
		if (validationResult !== true) {
			this.logger.error('Order is not valid', { orderId, validationResult });
			return false;
		}
		else this.logger.log('Order is valid', { orderId });

		// 2. Confirm the order and set the status to confirmed
		try {

			// Update the order status to processing, add pricing
			const t1 = await this.db.query(`
				UPDATE scoms.orders
				SET 
					status = :statusProcessing,
					pricing = :pricing
				WHERE 
					order_id = :orderId AND 
					status = :statusDraft
				RETURNING 
					order_id, status;
			`, {
				orderId,
				statusProcessing: EOrderStatus.PROCESSING,
				statusDraft: EOrderStatus.DRAFT,
				pricing: order.pricing,
			});

			if (!t1.rowCount) {
				this.logger.error('Could not confirm order', { orderId });
				// TODO: generate rollback/cancel event
				return false;
			}

			// Update the order with the allocations
			const allocResult = await this.inventoryService.allocateStock(
				orderId, 
				order.allocations
			);

			if (!allocResult) {
				this.logger.error('Could not allocate stock', { orderId });
				// TODO: generate rollback/cancel event
				return false;
			}

			// 3. Send the order to the event producer for further processing
			// TODO: emit event for order processing
			// this.eventProducer.emit({
			// 	eventType: EEventType.ORDER_PROCESSING,
			// 	payload: {
			// 		orderId: t1.rows[0].order_id,
			// 	},
			// });

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
		// 2. A processing order can be set to confirmed or cancelled 
		// 3. A confirmed order can be set to fulfilled or cancelled

		const expectedStatus = (() => {
			switch (status) {
				case EOrderStatus.PROCESSING:
					return EOrderStatus.DRAFT;
				case EOrderStatus.CONFIRMED:
					return EOrderStatus.PROCESSING;
				case EOrderStatus.FULFILLED:
					return EOrderStatus.CONFIRMED;
				case EOrderStatus.CANCELLED:
					return [EOrderStatus.PROCESSING, EOrderStatus.CONFIRMED];
			}
		})();

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

	public async getOrder(
		orderId: TOrderId,
	): Promise<TOrderDraft | TFinalizedOrder | false> {
		try {

			// Fetch main order record
			const resOrder = await this.db.query(`
				SELECT *
				FROM scoms.orders
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
				FROM scoms.order_items
				WHERE order_items.order_id = :orderId
			`, {
				orderId
			});

			const qAlloc = this.inventoryService.getAllocatedStock(orderId);

			const [
				resItems,
				resAllocations,
			] = await Promise.all([qItems, qAlloc]);

			// All done
			return {
				orderId: resOrder.rows[0].order_id,

				externalCustomerId: resOrder.rows[0].external_customer_id,
				addressId: resOrder.rows[0].address_id,
				agentId: resOrder.rows[0].agent_id,

				status: resOrder.rows[0].status,
				createdOn: resOrder.rows[0].created_on,

				pricingStrategy: resOrder.rows[0].pricing_strategy,
				shippingStrategy: resOrder.rows[0].shipping_strategy,
				validationStrategy: resOrder.rows[0].validation_strategy,

				items: resItems.rows.map((row: any) => ({
					productId: row.product_id,
					quantity: row.quantity,
				})) as TOrderItem[],

				//@ts-ignore
				pricing: resOrder.rows[0].pricing,
				allocations: resAllocations,
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
				FROM scoms.orders
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
				FROM scoms.orders
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
				FROM scoms.orders
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
