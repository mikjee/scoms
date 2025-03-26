import { ICRMService } from '@common/types/crm';
import { IEventProducer } from '@common/types/events';
import { IInventoryService } from '@common/types/inventory';
import { ILoggerService } from '@common/types/logger';
import { TOrderProposal } from '@common/types/order';
import { IPgService } from '@common/types/pg';
import { IUIDGenerator } from '@common/types/uid';
import { IOrderValidationStrategyHandler } from '@services/order/types';

// ---

export const defaultValidation: IOrderValidationStrategyHandler = async (
	order: TOrderProposal,
	
	db: IPgService,
	logger: ILoggerService,
	uid: IUIDGenerator,
	eventProducer: IEventProducer,
	
	inventoryService: IInventoryService,
	crmService: ICRMService,
): Promise<boolean> => {
	const maxShippingCost = order.pricing.totalCost * 0.15;
	if (order.pricing.totalShippingCost > maxShippingCost) return false;
	return true;
};