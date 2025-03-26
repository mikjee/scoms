import { TAddressId, TUserId } from '@common/types/crm';
import { TAllocation, TAllocationProposal, TProductId } from '@common/types/inventory';

// ---

export type TOrderId = string;

export enum EOrderStatus {
	DRAFT = 'draft',
	PROCESSING = 'processing',
	CONFIRMED = 'confirmed',
	FULFILLED = 'fulfilled',
	CANCELLED = 'cancelled',
};

export type TOrderStrategyId = string;

// ---

export type TNewOrderParams = {
	externalCustomerId: TUserId,
	addressId: TAddressId,
	agentId: TUserId,

	items: TOrderItem[],

	pricingStrategy: TOrderStrategyId,
	shippingStrategy: TOrderStrategyId,
	validationStrategy: TOrderStrategyId,
};

export type TOrderDraft = TNewOrderParams & {
	orderId: TOrderId;
	
	status: EOrderStatus.DRAFT;
	createdOn: Date;
};

export type TOrderProposal = TOrderDraft & {
	pricing: any,
	allocations: TAllocationProposal[];
	
	status: EOrderStatus.DRAFT;
};

export type TFinalizedOrder = TOrderDraft & {
	pricing: any,
	allocations: TAllocation[];
	
	status: Exclude<EOrderStatus, EOrderStatus.DRAFT>;
};

export type TOrderItem = {
	productId: TProductId;
	quantity: number;
};

// ---

export interface IOrderService {

	createDraftOrder(
		params: TNewOrderParams
	): Promise<TOrderDraft | false>;

	updateDraftOrder(
		orderId: TOrderId,
		params: Partial<TNewOrderParams>,
	): Promise<boolean>;

	// ---

	createOrderProposal(
		orderId: TOrderId,
	): Promise<TOrderProposal | false>;

	validateOrderProposal(
		order: TOrderProposal
	): Promise<true | string>

	finalizeOrder(
		orderId: TOrderId,
		order: TOrderProposal,
	): Promise<TOrderId | false>;

	setOrderStatus(
		orderId: TOrderId,
		status: EOrderStatus,
	): Promise<boolean>;

	// ---

	getOrderById(
		orderId: TOrderId,
	): Promise<TOrderDraft | TFinalizedOrder | false>;

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
