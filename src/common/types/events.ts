export type TEventId = string;

export enum EEventType {
	ORDER_PROCESSING = 'ORDER_PROCESSING',
	ORDER_EXECUTED = 'ORDER_EXECUTED',
	ORDER_FAILED = 'ORDER_FAILED',
	ORDER_RETRY = 'ORDER_RETRY',

	INVENTORY_ALLOC_FAILED = 'INVENTORY_ALLOC_FAILED',
};

export type TEvent = {
	eventType: EEventType;
	createdOn?: string; // ISO 8601 timestamp (TIMESTAMPTZ)
	payload?: any;
};

// ---

export interface IEventHandler {
	(event: TEvent): Promise<void>;
}

export interface IEventConsumer {
	subscribe(eventType: EEventType, handler: IEventHandler): Promise<void>;
}

export interface IEventProducer {
	emit(event: Omit<TEvent, "eventId" | "createdOn" | "publisher">): Promise<TEvent | false>;
}