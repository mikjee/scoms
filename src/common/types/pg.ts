import pg from 'pg';

export interface IPgService {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	waitForReady(maxRetries?: number, delayMs?: number): Promise<void>

	query(
		queryStr: string,
		dataPool?: Record<string, any>,
		debugLog?: boolean,
		client?: any
	): Promise<pg.QueryResult>;

	transact(): Promise<{
		query: IPgService['query'];
		commit: () => Promise<any>;
		rollback: () => Promise<any>;
	}>;

	execFile(fileName: string): Promise<pg.QueryResult<any>>
}

export interface IPgConnectionArgs {
	user?: string;
	password?: string;
	host?: string;
	port?: number;
	database?: string;
};