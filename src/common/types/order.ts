import { TAddress, TAddressId, TUserId } from '@common/types/crm';
import { TProductId, TWarehouseId } from '@common/types/inventory';

export type TOrderId = string;
export enum EOrderStatus {
	'draft' = 'draft',
	'processing' = 'processing',
	'fulfilled' = 'fulfilled',
	'cancelled' = 'cancelled',
};
export type TOrderPricingId = string;
export type TOrderAllocationId = string;

export type TOrder = {
	orderId: TOrderId;
	externalCustomerId: TUserId;
	address: TAddress;
	agentId: TUserId;
	status: EOrderStatus;

	items: TOrderItem[];
	pricing: TOrderPricing;
	allocations: TOrderAllocation[];
};

export type TOrderItem = {
	productId: TProductId;
	quantity: number;
};

export type TOrderPriceBreakdown = {
	productId: TProductId,
	price: number,
	shippingCost: number,
	discount: number,
};

export type TOrderPricing = TOrderPriceBreakdown[];

export type TOrderAllocation = {
	warehouseId: TWarehouseId;
	productId: TProductId;
	quantity: number;
	distance: number;
};

// ---

export interface IOrderService {

	createOrder(
		externalCustomerId: TUserId,
		addressId: TAddressId,
		agentId: TUserId,
		items: TOrderItem[],
	): Promise<TOrder | false>;

	updateDraftOrder(
		orderId: TOrderId,
		items: TOrderItem[],
		addressId: TAddressId,
	): Promise<Partial<TOrder> | false>;

	// ---

	previewOrder(
		orderId: TOrderId,
	): Promise<TOrder | false>;

	validateOrder(
		order: TOrder
	): Promise<true | string>

	confirmOrder(
		orderId: TOrderId,
		order: TOrder,
	): Promise<TOrderId | false>;

	setOrderStatus(
		orderId: TOrderId,
		status: EOrderStatus,
	): Promise<boolean>;

	// ---

	getOrderById(
		orderId: TOrderId,
	): Promise<TOrder | false>;

	getOrdersByCustomerId(
		customerId: TUserId,
	): Promise<TOrderId[]>;

	getOrdersByAddressId(
		addressId: TAddressId,
	): Promise<TOrderId[]>;

	getOrdersByAgentId(
		agentId: TUserId,
	): Promise<TOrderId[]>;

};
