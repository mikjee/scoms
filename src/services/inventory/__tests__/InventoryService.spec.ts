import { uid } from '@common/lib/uid';
import { InventoryService } from '../controller';
import { TProduct, TProductAttribute } from '@common/inventory/types';
import { PgMemService, setupTestDb } from '@common/pg/PgMem';

describe('InventoryService', () => {
	let inventoryService: InventoryService;
	let dbSvc: PgMemService;

	beforeAll(async () => {
		dbSvc = setupTestDb();
		inventoryService = new InventoryService(
			'InventoryServiceTest',
			'ivst',
			dbSvc,
			uid('ivst'),
		);
	});

	afterEach(async () => {
		await dbSvc.query('TRUNCATE TABLE scoms.products CASCADE;');
		await dbSvc.query('TRUNCATE TABLE scoms.product_attributes CASCADE;');
	});

	afterAll(async () => {
		await dbSvc.disconnect();
	});

	it('should create a product with no attributes', async () => {
		const productName = 'Test Product No Attr';
		
		const result = await inventoryService.createProduct(productName);

		expect(result).toHaveProperty('productId');
		expect(result.productName).toBe(productName);
		expect(result.attributes).toEqual({});
	});

	it('should create a product with multiple attributes', async () => {
		const productName = 'Test Product With Attrs';

		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'red', meta: { hex: '#f00' } },
			size: { value: 'large', meta: { units: 'cm' } },
		};

		const result = await inventoryService.createProduct(productName, attributes);

		expect(result).toHaveProperty('productId');
		expect(result.productName).toBe(productName);
		expect(result.attributes).toEqual(expect.objectContaining({
			color: expect.objectContaining({ value: 'red', meta: { hex: '#f00' } }),
			size: expect.objectContaining({ value: 'large', meta: { units: 'cm' } }),
		}));
	});
});
