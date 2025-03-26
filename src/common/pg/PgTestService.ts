import { PGlite } from '@electric-sql/pglite';
import { pg as named } from 'yesql';
import { IPgService } from '@common/types/pg';

import fs from 'fs';
import path from 'path';

// ----------------------------------

type LiteQueryResult = {
	rows: any[];
	rowCount: number;
};

// ----------------------------------

export class PgTestService implements IPgService {
	private db: PGlite;

	constructor() {
		this.db = new PGlite();
	}

	public async initSchema(schemaSql: string) {
		await this.db.exec(schemaSql);
	}

	public async query(
		queryStr: string,
		dataPool: Record<string, any> = {},
		debugLog?: boolean
	): Promise<LiteQueryResult> {
		const q = named(queryStr)(dataPool);
		if (debugLog) console.log(q);
		const result = await this.db.query(q.text, q.values);
		return {
			rows: result.rows,
			rowCount: result.rows.length
		};
	}

	public async transact() {
		await this.db.query('BEGIN');

		const query = async (
			queryStr: string,
			dataPool: Record<string, any> = {},
			debugLog?: boolean
		) => this.query(queryStr, dataPool, debugLog);

		let err: any;

		const commit = async () => {
			try {
				return await this.db.query('COMMIT');
			} catch (e) {
				await this.db.query('ROLLBACK');
				err = e;
			} finally {
				if (err) throw err;
			}
		};

		return { query, commit };
	}
}

// ---

export const setupPgTestWithSchema = async (): Promise<PgTestService> => {
	const schemaSql = fs.readFileSync(
		path.join(process.cwd(), 'scripts', 'sql', 'create.sql'),
		'utf-8'
	);

	const svc = new PgTestService();
	await svc.initSchema(schemaSql);
	return svc;
}
