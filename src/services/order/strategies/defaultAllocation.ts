import { ICRMService } from '@common/types/crm';
import { IEventProducer } from '@common/types/events';
import { IInventoryService, TAllocationProposal } from '@common/types/inventory';
import { ILoggerService } from '@common/types/logger';
import { TOrderDraft, TOrderProposal } from '@common/types/order';
import { IPgService } from '@common/types/pg';
import { IUIDGenerator } from '@common/types/uid';
import { IOrderShippingStrategyHandler } from '@services/order/types';

// ---

export const defaultAllocation: IOrderShippingStrategyHandler = async (
	order: TOrderDraft,
	
	db: IPgService,
	logger: ILoggerService,
	uid: IUIDGenerator,
	eventProducer: IEventProducer,
	
	inventoryService: IInventoryService,
	crmService: ICRMService,
): Promise<TAllocationProposal[]> => {
	// This method will get a draft order
	// Then it will get the nearest warehouse for each item from InventoryService.getNearestWarehouses()

	// Get address coords
	const address = await crmService.getAddress(order.addressId);
	if (!address) {
		logger.error('Address not found for order ' + order.orderId, { addressId: order.addressId });
		throw `Address not found for order ${order.orderId}`;
	}

	// Get nearest warehouse for each item
	const allocPerProduct = await Promise.all(order.items.map(async (item) => {
		const warehouses = await inventoryService.getNearestWarehouses(
			item.productId,
			item.quantity,
			address.coords,
		);

		if (!warehouses || !warehouses.length) {
			logger.error('No warehouses can satisfy ' + item.productId, { orderId: order.orderId });
			throw `No warehouses can satisfy ${item.productId}`;
		}

		const allocations: TAllocationProposal[] = warehouses.map((alloc) => ({
			warehouseId: alloc.warehouse.warehouseId,
			productId: item.productId,
			quantity: item.quantity,
			distance: alloc.distance,
		}));

		return allocations;
	}));

	// Flatten the allocations array and assign to order
	return allocPerProduct.flat();

}