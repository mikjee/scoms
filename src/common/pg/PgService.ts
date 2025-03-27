import { ILoggerService } from '@common/types/logger';
import { IPgConnectionArgs as IPGConnectionArgs, IPgService } from '@common/types/pg';
import pg from 'pg';
import { pg as named } from 'yesql';
import fs from 'fs';
import path from 'path';

// ---

export class PgService implements IPgService {

	private _pool: pg.Pool | null = null;
	get pool() { return this._pool; }
	private set pool(value: pg.Pool | null) { this._pool = value; }

	// ---

	constructor(
		protected readonly connectionArgs: IPGConnectionArgs,
		private readonly logger: ILoggerService,
	) {
		this.connect();
	}

	public async connect() {
		if (this.pool) await this.disconnect();
		this.pool = new pg.Pool(this.connectionArgs);

		this.pool.on('error', (err) => {
			this.logger.error('PostgreSQL connection error!', err);
		});
	}

	public async disconnect() {
		if (this.pool) {
			await this.pool.end();
			this.pool = null;
		}
	}

	public async waitForReady(maxRetries = 20, delayMs = 500): Promise<void> {
		this.logger.log(`Waiting for PostgreSQL to be ready (max retries = ${maxRetries})...`);

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const client = new pg.Client(this.connectionArgs);
				await client.connect();
				await client.end();

				this.logger.log('PostgreSQL is ready!');
				return;
			} catch (err) {
				if (attempt === maxRetries) {
					this.logger.error('PostgreSQL not ready after max retries', err);
					throw new Error(`PostgreSQL not ready after ${maxRetries} attempts`);
				}
				await new Promise(res => setTimeout(res, delayMs));
			}
		}
	}

	// ---

	public async query(
		queryStr: string,
		dataPool: Record<string, any> = {},
		debugLog?: boolean,
		client?: pg.PoolClient,
	): Promise<pg.QueryResult> {
		if (!this.pool && !client) throw new Error('No connection pool available!');

		return new Promise((resolve, reject) =>	(client || this.pool)!.query(
			(() => {
				const q = named(queryStr)(dataPool);
				if (debugLog) this.logger.log("query logged", q);
				return q;
			})(),

			(err, res) => {
				if (err) {
					this.logger.error("error", err);
					reject(err);
				} 
				else resolve(res);
			}
		));
	}

	public async execFile(fileName: string) {
		if (!this.pool) throw new Error('No connection pool available!');

		const schemaSql = await fs.promises.readFile(
			path.join(process.cwd(), 'scripts', 'sql', fileName),
			'utf-8'
		);

		return this.query(schemaSql);
	}

	public async transact() {
		if (!this.pool) throw new Error('No connection pool available!');
		const client = await this.pool.connect();
		let err: any;

		const query = async (
			queryStr: string, 
			dataPool = {}, 
			debugLog?: boolean
		) => this.query(
			queryStr,
			dataPool,
			debugLog,
			client
		);

		const commit = async () => {
			try {
				const res = await client.query('COMMIT');
				return res;
			} 
			catch (e) {
				this.logger.error('Transaction commit error', e);
				await client.query('ROLLBACK');
				err = e;
			}
			finally {
				client.release();
				if (err) throw err;
			}
		};

		const rollback = async () => {
			try {
				await client.query('ROLLBACK');
			}
			catch (e) {
				this.logger.error('Rollback error', e);
			}
			finally {
				client.release();
			}
		};

		await client.query('BEGIN');
		return { query, commit, rollback };
	}

}