import { ICRMService } from '@common/types/crm';
import { IEventConsumer, IEventProducer } from '@common/types/events';
import { IInventoryService } from '@common/types/inventory';
import { ILoggerService } from '@common/types/logger';
import { IOrderService } from '@common/types/order';
import { IUIDGenerator } from '@common/types/uid';

// ---

export class Orchestrator {

	constructor (
		private readonly logger: ILoggerService,
		private readonly uid: IUIDGenerator,

		private readonly eventConsumer: IEventConsumer,
		private readonly eventProducer: IEventProducer,

		private readonly orderService: IOrderService,
		private readonly crmService: ICRMService,
		private readonly inventoryService: IInventoryService,
	) {

	}

	// ---

	public start(): void {
		this.logger.log("Start Orchestrator!");
	}
	

}
