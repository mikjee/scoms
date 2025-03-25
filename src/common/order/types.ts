import { TAddress, TUserId } from '@common/crm/types';
import { TProductId, TWarehouseId } from '@common/inventory/types';

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
	pricing: TOrderPricing[];
	allocations: TOrderAllocation[];
};

export type TOrderItem = {
	orderId: TOrderId;
	productId: TProductId;
	quantity: number;
};

export type TOrderPricing = {
	breakdownId: TOrderPricingId;
	orderId: TOrderId;
	stackIndex: number;
	meta?: any;
};

export type TOrderAllocation = {
	allocationId: TOrderAllocationId;
	orderId: TOrderId;
	warehouseId: TWarehouseId;
	productId: TProductId;
	quantity: number;
	isManual: boolean;
};
