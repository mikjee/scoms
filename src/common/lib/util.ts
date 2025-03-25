import { nanoid } from 'nanoid';

export interface IUIDGenerator {
	(): string
}

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export const uid = (prefix: string): IUIDGenerator => () => `${prefix}_${nanoid(8)}`;
