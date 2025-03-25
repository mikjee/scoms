import { nanoid } from 'nanoid';

export interface IUIDGenerator {
	(): string
}

// ------------------------------------------------------

export const uid = (prefix: string): IUIDGenerator => () => `${prefix}_${nanoid(8)}`;
