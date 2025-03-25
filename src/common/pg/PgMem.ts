import { newDb } from 'pg-mem';
import { pg as named } from 'yesql';
import { Client, QueryResult } from 'pg';
import { IPgService } from '@common/pg/types';

import fs from 'fs';
import path from 'path';

// ---

export class PgMemService implements IPgService {
	private client: Client;

	constructor(schemaSql?: string) {
		const db = newDb();
		if (schemaSql) db.public.none(schemaSql);
		this.client = db.adapters.createPg().Client();
	}

	public async connect() {
		await this.client.connect();
	}

	public async disconnect() {
		await this.client.end();
	}

	public async testConnection() {
		const result = await this.client.query('SELECT NOW() AS now');
		return result.rows[0].now;
	}

	public async query(
		queryStr: string,
		dataPool: Record<string, any> = {},
		debugLog?: boolean
	): Promise<QueryResult> {
		const q = named(queryStr)(dataPool);
		if (debugLog) console.log(q);
		return this.client.query(q);
	}

	public async transact() {
		await this.client.query('BEGIN');

		const query = async (
			queryStr: string,
			dataPool: Record<string, any> = {},
			debugLog?: boolean
		) => this.query(queryStr, dataPool, debugLog);

		let err: any;

		const commit = async () => {
			try {
				return await this.client.query('COMMIT');
			} catch (e) {
				await this.client.query('ROLLBACK');
				err = e;
			} finally {
				await this.disconnect();
				if (err) throw err;
			}
		};

		return { query, commit };
	}
}

// ---

export function setupTestDb(): PgMemService {
	const schemaSql = fs.readFileSync(
		path.join(process.cwd(), 'scripts', 'sql', 'create.sql'),
		'utf-8'
	);
	return new PgMemService(schemaSql);
}
