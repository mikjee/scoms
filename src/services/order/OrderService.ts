import { IEventProducer } from '@common/types/events';
import { ILoggerService } from '@common/types/logger';
import { IOrderService } from '@common/types/order';
import { IPgService } from '@common/types/pg';
import { IUIDGenerator } from '@common/types/uid';

// ---

export class OrderService implements IOrderService {

	constructor (
		private readonly db: IPgService,
		private readonly logger: ILoggerService,
		private readonly uid: IUIDGenerator,
		private readonly eventProducer: IEventProducer,
	) {
		this.logger.log("Initialize");
	}

	// ---


}
