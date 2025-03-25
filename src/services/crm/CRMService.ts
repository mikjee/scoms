import { ConnectedService } from '@common/connectedService/ConnectedService';
import { ICRMService, TAddress, TAddressId, TUserId } from '@common/crm/types';

// ---

export class CRMService extends ConnectedService implements ICRMService {

	public async createAddress(
		externalCustomerId: TUserId,
		coords: { lat: number; lng: number },
		meta?: any,
	): Promise<TAddress> {
		try {
			const addressId = this.uid();

			const result = await this.db.query(`
				INSERT INTO addresses (address_id, external_customer_id, coords, meta)
				VALUES ($1, $2, point($3, $4), $5)
				ON CONFLICT (address_id) DO NOTHING
				RETURNING address_id, external_customer_id, coords, meta;
			`, [
				addressId,
				externalCustomerId,
				coords.lng,
				coords.lat,
				meta,
			]);

			if (!result.rowCount) {
				this.error('Address already exists', { externalCustomerId, coords, meta });
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
			this.error('Error creating address', { externalCustomerId, coords, meta, error });
			throw error;
		}
	};

	public async getAddress(addressId: TAddressId): Promise<TAddress | false> {
		try {
			const result = await this.db.query(`
				SELECT address_id, external_customer_id, coords, meta
				FROM addresses
				WHERE address_id = :addressId
			`, {
				addressId,
			});

			if (!result.rowCount) {
				this.error('Address not found', { addressId });
				return false;
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
			this.error('Error getting address', { addressId, error });
			throw error;
		}

	};

}