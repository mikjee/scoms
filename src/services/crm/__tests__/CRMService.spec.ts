import { uid } from '@common/lib/util';
import { PgTestService, setupPgTestWithSchema } from '@common/pg/PgTestService';
import { CRMService } from '@services/crm/CRMService';

describe('CRMService', () => {
	let crmsvc: CRMService;
	let dbSvc: PgTestService;

	beforeAll(async () => {
		dbSvc = await setupPgTestWithSchema();
		crmsvc = new CRMService(
			'CRMServiceTest',
			'crmt',
			dbSvc,
			uid('crmt'),
		);
	});

	// ---

	it('createAddress', async () => {
		const addressId = uid('addressId');
		const externalCustomerId = uid('externalCustomerId');
		const coords = { lat: 1, lng: 2 };
		const meta = { test: 'test' };

		const address = await crmsvc.createAddress(externalCustomerId, coords, meta);

		expect(address).toEqual({
			addressId,
			externalCustomerId,
			coords,
			meta,
		});
	});

	it('getAddress', async () => {
		const addressId = uid('addressId');
		const externalCustomerId = uid('externalCustomerId');
		const coords = { lat: 1, lng: 2 };
		const meta = { test: 'test' };

		await crmsvc.createAddress(externalCustomerId, coords, meta);

		const address = await crmsvc.getAddress(addressId);

		expect(address).toEqual({
			addressId,
			externalCustomerId,
			coords,
			meta,
		});
	});

});