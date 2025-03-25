export type TProductId = string;
export type TProductAttrId = string;
export type TWarehouseId = string;

export type TProduct = {
	productId: TProductId
	productName: string
	attributes: Record<string, {
		atributeId: TProductAttrId
		value: string | null
		meta?: any
	}>
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
	): Promise<void>

	setAttributes(params: {
		attribute_id?: string;
		product_id: string;
		attributes: { attribute: string; value: string | null; meta?: any }[];
	}): Promise<void>

	getProduct(idOrName: string): Promise<{
		product_id: string;
		product_name: string;
		attributes: { attribute: string; value: string | null; meta?: any }[];
	} | null>

	createWarehouse(data: {
		warehouse_id: string;
		warehouse_name: string;
		city: string;
		coords: { lat: number; lng: number };
	}): Promise<void>

	addInventory(
		warehouse_id: string,
		product_id: string,
		quantity: number
	): Promise<void>

	subtractInventory(
		warehouse_id: string,
		product_id: string,
		quantity: number
	): Promise<void>

	getInventory(
		warehouse_id: string,
		productidOrName: string
	): Promise<number>
	
	getNearestWarehouse(
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
	}[]>
}
