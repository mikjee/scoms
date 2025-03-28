import { ICRMService, TAddress, TAddressId, TUserId } from '@common/types/crm';
import { ILoggerService } from '@common/types/logger';
import { IPgService } from '@common/types/pg';
import { IUIDGenerator } from '@common/types/uid';

// ---

export class CRMService implements ICRMService {

	constructor (
		private readonly db: IPgService,
		private readonly logger: ILoggerService,
		private readonly uid: IUIDGenerator,
	) {
		this.logger.log("Initialize");
	}

	// ---

	public async getAllCustomers(): Promise<TUserId[]> {
		try {
			const result = await this.db.query(`
				SELECT DISTINCT external_customer_id
				FROM scoms.addresses;
			`);

			return result.rows.map((row: any) => row.external_customer_id);
		}
		catch (error) {
			this.logger.error('Error getting all customers', { error });
			throw error;
		}
	}

	// ---

	public async createAddress(
		externalCustomerId: TUserId,
		coords: { lat: number; lng: number },
		meta?: any,
	): Promise<TAddress> {
		try {
			const addressId = this.uid();

			const result = await this.db.query(`
				INSERT INTO scoms.addresses 
					(address_id, external_customer_id, coords, meta)
				VALUES 
					(:addressId, :externalCustomerId, point(:x, :y), :meta)
				RETURNING 
					address_id, external_customer_id, coords, meta;
			`, {
				addressId,
				externalCustomerId,
				x: coords.lat,
				y: coords.lng,
				meta,
			});

			if (!result.rowCount) {
				this.logger.error('Address already exists', { externalCustomerId, coords, meta });
				throw new Error('Address already exists');
			}

			return {
				addressId: result.rows[0].address_id,
				externalCustomerId: result.rows[0].external_customer_id,
				coords: {
					lat: result.rows[0].coords.y,
					lng: result.rows[0].coords.x,
				},
				meta: result.rows[0].meta,
			};
		}
		catch (error) {
			this.logger.error('Error creating address', { externalCustomerId, coords, meta, error });
			throw error;
		}
	};

	public async getAllAddressesByCustomerId(externalCustomerId: TUserId): Promise<TAddress[]> {
		try {
			const result = await this.db.query(`
				SELECT address_id, external_customer_id, coords, meta
				FROM scoms.addresses
				WHERE external_customer_id = :externalCustomerId
			`, {externalCustomerId});

			return result.rows.map((row: any) => ({
				addressId: row.address_id,
				externalCustomerId: row.external_customer_id,
				coords: {
					lat: row.coords.y,
					lng: row.coords.x,
				},
				meta: row.meta,
			}));
		}
		catch (error) {
			this.logger.error('Error getting all addresses by customer ID', { externalCustomerId, error });
			throw error;
		}
	}

	public async getAddress(addressId: TAddressId): Promise<TAddress | false> {
		try {
			const result = await this.db.query(`
				SELECT 
					address_id, 
					external_customer_id, 
					coords[0] AS lat,
					coords[1] AS lng, 
					meta
				FROM scoms.addresses
				WHERE address_id = :addressId
			`, {
				addressId,
			});

			if (!result.rowCount) {
				this.logger.error('Address not found', { addressId });
				return false;
			}

			return {
				addressId: result.rows[0].address_id,
				externalCustomerId: result.rows[0].external_customer_id,
				coords: {
					lat: result.rows[0].lat,
					lng: result.rows[0].lng,
				},
				meta: result.rows[0].meta,
			};
		}
		catch (error) {
			this.logger.error('Error getting address', { addressId, error });
			throw error;
		}

	};

}