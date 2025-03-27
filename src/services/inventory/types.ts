import { TWarehouse } from '@common/types/inventory';

export type TNearestWarehouse = {
	warehouse: TWarehouse	
	stock: number
	allocation: number
	distance: number
};