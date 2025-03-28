import { PartialBy } from '@common/lib/util';
import { TOrderId } from '@common/types/order';

export type TProductId = string;
export type TProductAttrId = string;
export type TProductAttrName = string;
export type TWarehouseId = string;

// ---

export type TProductAttribute = {
	attributeId: TProductAttrId
	value: string | number | null
	meta?: any
};

export type TProduct = {
	productId: TProductId
	productName: string
	attributes: Record<TProductAttrName, TProductAttribute>
};

export type TWarehouse = {
	warehouseId: TWarehouseId
	warehouseName: string
	city: string
	coords: { lat: number; lng: number }
};

export enum EAllocationStatus {
	PENDING = "pending",
	CONFIRMED = "confirmed",
	FULFILLED = "fulfilled",
	CANCELLED = "cancelled",
};

export type TAllocation = {
	warehouseId: TWarehouseId;
	productId: TProductId;
	quantity: number;
	status: EAllocationStatus;
};

export type TAllocationProposal = (Omit<TAllocation, "status"> & {
	distance: number
});

// ---

export interface IInventoryService {

	createProduct(
		productName: TProduct['productName'],
		attributes: Record<string, Omit<TProductAttribute, "attributeId">>,
	): Promise<TProduct>

	// Products & attributes should be immutable!
	dangerouslySetAttributes(
		productId: TProductId,
		attributes: Record<TProductAttrName, Omit<TProductAttribute, "attributeId">>,
	): Promise<boolean>

	getProduct(idOrName: TProductId | string): Promise<TProduct | false>

	// ---

	createWarehouse(
		warehouseId: TWarehouseId,
		warehouseName: string,
		city: string,
		coords: { lat: number; lng: number },
	): Promise<TWarehouse>

	addInventory(
		warehouseId: TWarehouseId,
		productId: TProductId,
		quantity: number,
	): Promise<number | false>

	subtractInventory(
		warehouseId: TWarehouseId,
		productId: TProductId,
		quantity: number,
	): Promise<number | false>

	getInventory(
		warehouseId: TWarehouseId,
		productidOrName: TProductId | string,
	): Promise<number | false>

	// ---

	isAllocationValid(
		allocations: TAllocationProposal[],
	): Promise<boolean>

	allocateStock(
		orderId: TOrderId,
		allocations: TAllocationProposal[],
	): Promise<boolean>

	confirmAllocation(
		orderId: TOrderId,
	): Promise<boolean>

	cancelAllocation(
		orderId: TOrderId,
	): Promise<boolean>

	getAllocatedStock(
		orderId: TOrderId,
	): Promise<TAllocation[]>

	// ---
	
	getNearestWarehouses(
		productId: TProductId,
		quantity: number,
		destinationCoords: { lat: number; lng: number }
	): Promise<{
		warehouse: TWarehouse
		stock: number
		allocation: number
		distance: number
	}[]>
}
