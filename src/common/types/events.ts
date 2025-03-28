export type TEventId = string;

export enum EEventType {
	ORDER_PROCESSING = 'ORDER_PROCESSING',
	INVENTORY_ALLOC_FAILED = 'INVENTORY_ALLOC_FAILED',
	INVENTORY_ALLOC_CONFIRMED = 'INVENTORY_ALLOC_CONFIRMED',
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
	emit(event: Omit<TEvent, "eventId" | "createdOn">): Promise<TEvent | false>;
}