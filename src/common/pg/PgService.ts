import { IPgService } from '@common/pg/types';
import pg from 'pg';
import { pg as named } from 'yesql';

// ---

export interface IPGConnArgs {
	user?: string;
	password?: string;
	host?: string;
	port?: number;
	database?: string;
};

// ---

export class PgService implements IPgService {

	private _pool: pg.Pool | null = null;
	get pool() { return this._pool; }
	private set pool(value: pg.Pool | null) { this._pool = value; }

	// ---

	constructor(
		protected readonly connectionArgs: IPGConnArgs = {
			user: process.env.PGUSER,
			password: process.env.PGPASSWORD,
			host: process.env.PGHOST,
			port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
			database: process.env.PGDATABASE,
		},

		protected log: typeof console.log = console.log,
		protected error: typeof console.error = console.error,
		protected warn: typeof console.warn = console.warn,
	) {
		this.connect();
	}

	public async connect() {
		if (this.pool) await this.disconnect();
		this.pool = new pg.Pool(this.connectionArgs);

		this.pool.on('error', (err) => {
			this.error('PostgreSQL connection error!', err);
		});

		this.pool.on('connect', () => {
			this.log('PostgreSQL connection established!');
		});

		this.pool.on('remove', () => {
			this.log('PostgreSQL connection removed!');
		});
	}

	public async disconnect() {
		if (this.pool) {
			await this.pool.end();
			this.pool = null;
		}
	}

	public async testConnection() {
		if (!this.pool) throw new Error('No connection pool available!');

		const client = await this.pool.connect();
		const result = await client.query('SELECT NOW() AS now');
		client.release();
		return result.rows[0].now;
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
				if (debugLog) this.log(q);
				return q;
			})(),

			(err, res) => {
				if (err) {
					this.error(err);
					reject(err);
				} 
				else resolve(res);
			}
		));
	}

	public async transact() {
		if (!this.pool) throw new Error('No connection pool available!');
		const client = await this.pool.connect();

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

		let err: any;
		const commit = async () => {
			try {
				const res = await client.query('COMMIT');
				return res;
			} 
			catch (e) {
				await client.query('ROLLBACK');
				err = e;
			}
			finally {
				client.release();
				if (err) throw err;
			}
		};

		await client.query('BEGIN');
		return { query, commit };
	}

}