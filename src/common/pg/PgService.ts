import * as pg from 'pg';
import { pg as named } from 'yesql';
import { injectable } from 'tsyringe';

// ----------------------------------------------

export interface IPGConnectionArgs {
	user?: string;
	password?: string;
	host?: string;
	port?: number;
	database?: string;
};

const { Pool } = pg;

// ----------------------------------------------

@injectable()
export class PgService {

	private _pool: pg.Pool | null = null;
	get pool() { return this._pool; }
	private set pool(value: pg.Pool | null) { this._pool = value; }

	// ---

	constructor(
		public readonly connectionArgs: IPGConnectionArgs = {
			user: process.env.PGUSER,
			password: process.env.PGPASSWORD,
			host: process.env.PGHOST,
			port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
			database: process.env.PGDATABASE,
		},
	) {
		this.connect();
	}

	public async connect() {
		if (this.pool) await this.disconnect();
		this.pool = new Pool(this.connectionArgs);

		this.pool.on('error', (err) => {
			console.error('PostgreSQL connection error!', err);
		});

		this.pool.on('connect', () => {
			console.log('PostgreSQL connection established!');
		});

		this.pool.on('remove', () => {
			console.log('PostgreSQL connection removed!');
		});

		// return this.pool.connect();  // TODO: incorrect
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
				if (debugLog) console.log(q);
				return q;
			})(),

			(err, res) => {
				if (err) {
					console.log(err);
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