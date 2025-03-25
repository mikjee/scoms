import { InventoryService } from '../controller';
import { TProduct } from '@common/inventory/types';
import { PgService } from '@common/pg/PgService';

describe('InventoryService', () => {
	let inventoryService: InventoryService;
	let query: PgService['query'];
	let rollback: () => Promise<void>;

	beforeAll(async () => {
		inventoryService = new InventoryService();
		query = inventoryService['db'].query.bind(inventoryService['db']);
		await inventoryService['db'].query(`BEGIN`);
	});

	afterAll(async () => {
		await inventoryService['db'].query(`ROLLBACK`);
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

		const attributes: TProduct['attributes'] = {
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
