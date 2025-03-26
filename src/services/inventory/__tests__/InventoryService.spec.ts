import { uid } from '@common/lib/util';
import { InventoryService } from '../InventoryService';
import { TProduct, TProductAttribute } from '@common/types/inventory';
import { PgTestService, setupPgTestWithSchema } from '@common/pg/PgTestService';

describe('InventoryService', () => {
	let inventoryService: InventoryService;
	let dbSvc: PgTestService;

	beforeAll(async () => {
		dbSvc = await setupPgTestWithSchema();
		inventoryService = new InventoryService(
			'InventoryServiceTest',
			'ivst',
			dbSvc,
			uid('ivst'),
		);
	});

	// ---

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

	// ---

	it('should set attributes for an existing product', async () => {
		const productName = 'Test Product Set Attrs';
		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'blue' },
			size: { value: 'medium' },
		};

		const product = await inventoryService.createProduct(productName, attributes);
		const newAttributes: Record<string, Partial<TProductAttribute>> = {
			color: { value: 'green' },
			size: { value: null }, // Setting size to null
		};

		const result = await inventoryService.dangerouslySetAttributes(product.productId, newAttributes);

		expect(result).toBe(true);

		const updatedProduct = await inventoryService.getProduct(product.productId);
		expect(updatedProduct).toHaveProperty('productId', product.productId);
		expect(updatedProduct.attributes).toEqual(expect.objectContaining({
			color: expect.objectContaining({ value: 'green' }),
			size: expect.objectContaining({ value: null }),
		}));
	});

	it('should return false for non-existing product', async () => {
		const result = await inventoryService.getProduct('non-existing-id');
		expect(result).toBe(false);
	});

	it('should return false for non-existing product by name', async () => {
		const result = await inventoryService.getProduct('non-existing-name');
		expect(result).toBe(false);
	});

	it('should return the product by ID', async () => {
		const productName = 'Test Product By ID';
		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'yellow' },
			size: { value: 'small' },
		};

		const product = await inventoryService.createProduct(productName, attributes);
		const result = await inventoryService.getProduct(product.productId);

		expect(result).toHaveProperty('productId', product.productId);
		expect(result.productName).toBe(productName);
		expect(result.attributes).toEqual(expect.objectContaining({
			color: expect.objectContaining({ value: 'yellow' }),
			size: expect.objectContaining({ value: 'small' }),
		}));
	});

	it('should return the product by name', async () => {
		const productName = 'Test Product By Name';
		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'purple' },
			size: { value: 'extra-large' },
		};

		const product = await inventoryService.createProduct(productName, attributes);
		const result = await inventoryService.getProduct(productName);

		expect(result).toHaveProperty('productId', product.productId);
		expect(result.productName).toBe(productName);
		expect(result.attributes).toEqual(expect.objectContaining({
			color: expect.objectContaining({ value: 'purple' }),
			size: expect.objectContaining({ value: 'extra-large' }),
		}));
	});

	// ---

	it('should create a warehouse', async () => {
		const warehouseId = 'test-warehouse-id';
		const warehouseName = 'Test Warehouse';
		const city = 'Test City';
		const coords = { lat: 12.34, lng: 56.78 };

		const result = await inventoryService.createWarehouse(warehouseId, warehouseName, city, coords);

		expect(result).toHaveProperty('warehouseId', warehouseId);
		expect(result.warehouseName).toBe(warehouseName);
		expect(result.city).toBe(city);
		expect(result.coords).toEqual(coords);
	});

	it('should add inventory for a product in a warehouse', async () => {
		const warehouseId = 'test-warehouse-id';
		const productName = 'Test Product Inventory';
		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'black' },
			size: { value: 'medium' },
		};

		const product = await inventoryService.createProduct(productName, attributes);
		const quantityToAdd = 100;

		const result = await inventoryService.addInventory(warehouseId, product.productId, quantityToAdd);

		expect(result).toBe(quantityToAdd);
	});

	it('should subtract inventory for a product in a warehouse', async () => {
		const warehouseId = 'test-warehouse-id';
		const productName = 'Test Product Inventory Subtract';
		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'white' },
			size: { value: 'large' },
		};

		const product = await inventoryService.createProduct(productName, attributes);
		const quantityToAdd = 50;
		await inventoryService.addInventory(warehouseId, product.productId, quantityToAdd);

		const quantityToSubtract = 20;
		const result = await inventoryService.subtractInventory(warehouseId, product.productId, quantityToSubtract);

		expect(result).toBe(quantityToAdd - quantityToSubtract);
	});

	it('should not allow subtracting more inventory than available', async () => {
		const warehouseId = 'test-warehouse-id';
		const productName = 'Test Product Inventory Over Subtract';
		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'orange' },
			size: { value: 'small' },
		};

		const product = await inventoryService.createProduct(productName, attributes);
		const quantityToAdd = 30;
		await inventoryService.addInventory(warehouseId, product.productId, quantityToAdd);

		const quantityToSubtract = 50; // More than available
		const result = await inventoryService.subtractInventory(warehouseId, product.productId, quantityToSubtract);

		expect(result).toBe(false);
	});

	it('should not allow adding inventory for a non-existing product', async () => {
		const warehouseId = 'test-warehouse-id';
		const nonExistingProductId = 'non-existing-product-id';
		const quantityToAdd = 50;

		const result = await inventoryService.addInventory(warehouseId, nonExistingProductId, quantityToAdd);

		expect(result).toBe(false);
	});

	it('should not allow subtracting inventory for a non-existing product', async () => {
		const warehouseId = 'test-warehouse-id';
		const nonExistingProductId = 'non-existing-product-id';
		const quantityToSubtract = 20;

		const result = await inventoryService.subtractInventory(warehouseId, nonExistingProductId, quantityToSubtract);

		expect(result).toBe(false);
	});

	it('should not allow adding inventory for a non-existing warehouse', async () => {
		const nonExistingWarehouseId = 'non-existing-warehouse-id';
		const productName = 'Test Product Non-Existing Warehouse';
		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'pink' },
			size: { value: 'medium' },
		};

		const product = await inventoryService.createProduct(productName, attributes);
		const quantityToAdd = 50;

		const result = await inventoryService.addInventory(nonExistingWarehouseId, product.productId, quantityToAdd);

		expect(result).toBe(false);
	});

	it('should not allow subtracting inventory for a non-existing warehouse', async () => {
		const nonExistingWarehouseId = 'non-existing-warehouse-id';
		const productName = 'Test Product Non-Existing Warehouse Subtract';
		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'brown' },
			size: { value: 'large' },
		};

		const product = await inventoryService.createProduct(productName, attributes);
		const quantityToSubtract = 20;

		const result = await inventoryService.subtractInventory(nonExistingWarehouseId, product.productId, quantityToSubtract);

		expect(result).toBe(false);
	});

	it('should not allow creating a product with an existing name', async () => {
		const productName = 'Test Product Duplicate Name';
		const attributes: Record<string, Omit<TProductAttribute, "attributeId">> = {
			color: { value: 'grey' },
			size: { value: 'extra-small' },
		};

		await inventoryService.createProduct(productName, attributes);

		await expect(inventoryService.createProduct(productName, attributes)).rejects.toThrowError(
			new Error(`Product with name "${productName}" already exists.`),
		);
	});

	// ---

	it('should find nearest warehouse by coordinates', async () => {
		const warehouseId1 = 'warehouse-1';
		const warehouseName1 = 'Warehouse 1';
		const city1 = 'City 1';
		const coords1 = { lat: 12.34, lng: 56.78 };

		const warehouseId2 = 'warehouse-2';
		const warehouseName2 = 'Warehouse 2';
		const city2 = 'City 2';
		const coords2 = { lat: 23.45, lng: 67.89 };

		await inventoryService.createWarehouse(warehouseId1, warehouseName1, city1, coords1);
		await inventoryService.createWarehouse(warehouseId2, warehouseName2, city2, coords2);

		const targetCoords = { lat: 15.0, lng: 60.0 };
		const nearestWarehouses = await inventoryService.getNearestWarehouses(
			'product-id', // Dummy product ID, not used in this test
			10, // Dummy quantity, not used in this test
			targetCoords,
		);

		expect(nearestWarehouses).toBeInstanceOf(Array);
		expect(nearestWarehouses).toHaveLength(2); // Two warehouses created
		
	});

});
