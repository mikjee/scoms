import { EEventPublisher, EEventType } from '@common/types/events'

export enum EEventStatus {
	PENDING = 'pending',
	PROCESSING = 'processing',
	DELIVERED = 'delivered',
	FAILED = 'failed',
};

export type TEventModel = {
	event_id: string,
	event_type: EEventType,
	publisher: EEventPublisher,
	created_on: string, // ISO 8601 timestamp (TIMESTAMPTZ)
	payload?: any,
	meta?: any,
	status: EEventStatus,
};