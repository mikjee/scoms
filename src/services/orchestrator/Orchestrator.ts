import { ICRMService } from '@common/types/crm';
import { IEventConsumer, IEventProducer } from '@common/types/events';
import { IInventoryService } from '@common/types/inventory';
import { ILoggerService } from '@common/types/logger';
import { IOrchestrator } from '@common/types/orchestrator';
import { IOrderService } from '@common/types/order';

// ---

export class Orchestrator implements IOrchestrator{

	constructor (
		private readonly logger: ILoggerService,

		private readonly eventConsumer: IEventConsumer,
		private readonly eventProducer: IEventProducer,

		private readonly orderService: IOrderService,
		private readonly crmService: ICRMService,
		private readonly inventoryService: IInventoryService,
	) {
		this.logger.log("Initialize");
	}

	// ---

	public start(): void {
		this.logger.log("Started!");
	}

}
