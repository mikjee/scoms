import { PartialBy } from '@common/lib/util';

export type TProductId = string;
export type TProductAttrId = string;
export type TProductAttrName = string;
export type TWarehouseId = string;

// ---

export type TProductAttribute = {
	attributeId: TProductAttrId
	value: string | null
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

// ---

export interface IInventoryService {
	createProduct(
		productName: TProduct['productName'],
		attributes: TProduct['attributes'],
	): Promise<TProduct>

	setAttributes(
		productId: TProductId,
		attributes: Record<TProductAttrName, PartialBy<TProductAttribute, "attributeId">>,
	): Promise<boolean>

	getProduct(idOrName: TProductId | string): Promise<TProduct | false>

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
