export interface IPgService {
	query(
		queryStr: string,
		dataPool?: Record<string, any>,
		debugLog?: boolean,
		client?: any
	): Promise<any>;

	transact(): Promise<{
		query: IPgService['query'];
		commit: () => Promise<any>;
	}>;
}