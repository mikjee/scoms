import { IUIDGenerator } from '@common/types/uid';
import { nanoid } from 'nanoid';

// ---

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// ---

export const uid = (prefix: string): IUIDGenerator => () => `${prefix}_${nanoid(8)}`;
