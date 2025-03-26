import { ICRMService } from '@common/types/crm';
import { IEventProducer } from '@common/types/events';
import { IInventoryService, TAllocationProposal } from '@common/types/inventory';
import { ILoggerService } from '@common/types/logger';
import { TOrderDraft, TOrderProposal } from '@common/types/order';
import { IPgService } from '@common/types/pg';
import { IUIDGenerator } from '@common/types/uid';

// ---

export interface IOrderStrategyHandler<Ret = any, OrderType = any> {
	(
		order: OrderType,

		db: IPgService,
		logger: ILoggerService,
		uid: IUIDGenerator,
		eventProducer: IEventProducer,

		inventoryService: IInventoryService,
		crmService: ICRMService,
	): Promise<Ret>
};

export type IOrderPricingStrategyHandler = IOrderStrategyHandler<{
	pricePerItem: Array<{
		productId: string,
		price: number,
		shippingCost: number,
		discount: number,
	}>,

	totalPrice: number,
	totalShippingCost: number,
	totalDiscount: number,
	totalCost: number,
}, TOrderProposal>;

export type IOrderShippingStrategyHandler = IOrderStrategyHandler<TAllocationProposal[], TOrderDraft>;

export type IOrderValidationStrategyHandler = IOrderStrategyHandler<boolean, TOrderProposal>;

