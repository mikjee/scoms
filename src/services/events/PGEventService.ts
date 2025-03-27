import { IUIDGenerator } from '@common/types/uid';
import { EEventType, IEventConsumer, IEventHandler, IEventProducer, TEvent, TEventId } from '@common/types/events';
import { ILoggerService } from '@common/types/logger';
import { IPgService } from '@common/types/pg';
import { EEventStatus, TEventModel } from '@services/events/model';

// ---

type IEventService = IEventConsumer & IEventProducer;

// ---

// TODO: fault tolerance - when handler fails to process and event, mark that event as failed and retry later
// TODO: add counter to both event and handler to retry a certain number of times before failing permanently
export class PGEventService implements IEventService {

	private readonly mapEventTypeToHandlers: Partial<Record<EEventType, IEventHandler[]>> = {};
	private pollingSwitch: boolean = false;

	public get isPolling(): boolean {
		return this.pollingSwitch;
	}

	constructor(
		private readonly db: IPgService,
		private readonly logger: ILoggerService,
		private readonly uid: IUIDGenerator,
		private readonly pollInterval: number = 1000,
	) {
		this.logger.log("Initialize");
	}

	// ---

	public async emit(event: Omit<TEvent, "eventId">): Promise<TEvent | false> {
		try {
			const eventId = this.uid();

			const result = await this.db.query(`
				INSERT INTO scoms.events 
					(event_id, event_type, payload, created_on)
				VALUES 
					(:eventId, :eventType, :payload, :createdOn)
				RETURNING 
					event_id, event_type, created_on, payload;
			`, {
				eventId,
				eventType: event.eventType,
				payload: JSON.stringify(event.payload),
				createdOn: event.createdOn || new Date().toISOString(),
			});

			if (!result.rowCount) {
				this.logger.error('Could not push event!', { event });
				return false;
			}

			return {
				eventId: result.rows[0].event_id,
				eventType: result.rows[0].event_type,
				createdOn: result.rows[0].created_on,
				payload: result.rows[0].payload,
			} as TEvent;
		}
		catch (error) {
			this.logger.error('Error pushing event!', { error });
			throw error;
		}
	}

	public async subscribe(eventType: EEventType, handler: IEventHandler): Promise<void> {
		if (!this.mapEventTypeToHandlers[eventType]) this.mapEventTypeToHandlers[eventType] = [];
		this.mapEventTypeToHandlers[eventType]!.push(handler);
	}

	public start(): void {
		this.pollingSwitch = true;
		this.pollEvents();
		this.logger.log('Polling Started!');
	}

	public stop(): void {
		this.pollingSwitch = false;
		this.logger.warn('Polling stopped manually!');
	}

	// ---

	private async getNextPendingEvent(topics: string[]): Promise<TEventModel | false>{
		try {
			const result = await this.db.query(`
				WITH selected AS (
					SELECT 
						event_id
					FROM 
						scoms.events
					WHERE 
						event_type = ANY(:topics)
						AND status = :statusPending
						AND created_on < now()
					ORDER BY 
						created_on ASC
					LIMIT 1
					FOR UPDATE SKIP LOCKED
				)
				UPDATE scoms.events e
				SET status = :statusProcessing
				FROM selected
				WHERE e.event_id = selected.event_id
				RETURNING 
					e.event_id, e.event_type, e.created_on, e.payload, e.status;
			`, {
				statusProcessing: EEventStatus.PROCESSING,
				statusPending: EEventStatus.PENDING,
				topics,
			});

			if (!result.rowCount) return false;
			return result.rows[0] as TEventModel;
		}
		catch (error) {
			this.pollingSwitch = false;
			this.logger.error('Error getting next pending event!', { error });
			throw error;
		}
	}

	private async eventDelivered(eventId: TEventId): Promise<void> {
		try {
			await this.db.query(`
				UPDATE 
					scoms.events
				SET 
					status = :statusDelivered
				WHERE 
					event_id = :eventId AND 
					status = :statusProcessing;
			`, {
				eventId,
				statusDelivered: EEventStatus.DELIVERED,
				statusProcessing: EEventStatus.PROCESSING,
			});
		}
		catch (error) {
			this.pollingSwitch = false;
			this.logger.error('Error setting event as delivered!', { error });
			throw error;
		}
	}

	private async eventFailed(eventId: string): Promise<void> {
		try {
			await this.db.query(`
				UPDATE 
					scoms.events
				SET 
					status = :statusFailed
				WHERE 
					event_id = :eventId AND 
					status = :statusProcessing;
			`, {
				eventId,
				statusFailed: EEventStatus.FAILED,
				statusProcessing: EEventStatus.PROCESSING,
			});
		}
		catch (error) {
			this.pollingSwitch = false;
			this.logger.error('Error setting event as failed!', { error });
			throw error;
		}
	}

	private async pollEvents(): Promise<void> {

		if (!this.pollingSwitch) {
			this.logger.warn('Polling is disabled, stopping pollEvents()');
			return;
		};

		// Helpers
		const nextPoll = (immediate?: boolean) => {
			setTimeout(
				() => this.pollEvents(), 
				immediate ? 1 : this.pollInterval
			);
		};

		// Actual Logic
		const topics = (Object.keys(this.mapEventTypeToHandlers) as EEventType[])
			.filter(topic => this.mapEventTypeToHandlers[topic]!.length > 0); // Only poll topics that have a handler
		if (!topics.length) return nextPoll();

		const event = await this.getNextPendingEvent(topics);
		if (!event) return nextPoll();

		const eventType = event.event_type as EEventType;
		const handlers = this.mapEventTypeToHandlers[eventType] || [];
		if (!handlers.length) throw `No handlers for event type ${eventType}, yet we polled for it!`;

		// Randomly select a handler to process the event
		// TODO: implement round-robin or other strategy
		const index = Math.floor(Math.random() * handlers.length);
		const handler = handlers[index];

		try {
			this.logger.log(`Processing event ${event.event_id}`, { event });
			await handler({
				eventType: event.event_type,
				createdOn: event.created_on,
				payload: event.payload,
			});

			this.logger.log(`Event ${event.event_id} processed successfully`, { event });
			await this.eventDelivered(event.event_id);
		}
		catch (error) {
			this.logger.error(`Error processing event ${event.event_id}`, { error });
			await this.eventFailed(event.event_id);
		}
		finally {
			nextPoll(true);
		}

	}
	
}
