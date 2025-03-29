import { ICRMService, TAddressId } from '@common/types/crm';
import { IInventoryService, TProductId } from '@common/types/inventory';
import { IOrderService, TOrderId, TOrderProposal } from '@common/types/order';
import { setupTest } from './setup';
import { IEventConsumer, IEventProducer } from '@common/types/events';
import { PGEventService } from '@services/events/PGEventService';

describe('Order Integration Flow', () => {
	let crmSvc: ICRMService;
	let invSvc: IInventoryService;
	let orderSvc: IOrderService;
	let evSvc: IEventConsumer & IEventProducer;

	beforeAll(async () => {
		({ crmSvc, invSvc, orderSvc, evSvc } = await setupTest());
	}, 20000);

	afterAll(async () => {
		(evSvc as PGEventService).stop();
	});

	it('should create and finalize an order end-to-end', async () => {
		const address = await crmSvc.createAddress(
			'customer-1',
			{ lat: 4, lng: 5 },
			{ meta: { test: 'test' } }
		);
		expect(address).toBeDefined();
		const addressId: TAddressId = address.addressId;

		const product = await invSvc.createProduct(
			'Product 1',
			{ price: { value: 100 }, weight: { value: 1 } }
		);
		expect(product).toBeDefined();
		const productId: TProductId = product.productId;

		const warehouse = await invSvc.createWarehouse(
			'warehouse-1',
			'Warehouse 1',
			'City 1',
			{ lat: 1, lng: 2 }
		);
		expect(warehouse).toBeDefined();

		const qtyAdded = await invSvc.addInventory('warehouse-1', productId, 100);
		expect(qtyAdded).toBe(100);

		const draftOrder = await orderSvc.createDraftOrder({
			externalCustomerId: 'customer-1',
			addressId,
			agentId: 'agent-1',
			pricingStrategy: 'default-pricing',
			shippingStrategy: 'default-shipping',
			validationStrategy: 'default-validation',
			items: [{ productId, quantity: 10 }],
		});
		if (!draftOrder) throw new Error('Draft order not created');

		expect(draftOrder).toMatchObject({
			orderId: expect.any(String),
			externalCustomerId: 'customer-1',
			addressId: expect.any(String),
			agentId: 'agent-1',
			items: [ { productId: expect.any(String), quantity: 10 } ],
			pricingStrategy: 'default-pricing',
			shippingStrategy: 'default-shipping',
			validationStrategy: 'default-validation',
			status: 'draft',
			createdOn: expect.any(Date),
		});

		const orderId: TOrderId = draftOrder.orderId;
		const proposal = await orderSvc.createOrderProposal(orderId);
		if (!proposal) throw new Error('Order proposal not created');
		expect(proposal).toMatchObject({
			orderId,
			externalCustomerId: 'customer-1',
			addressId: expect.any(String),
			agentId: 'agent-1',
			status: 'draft',
			createdOn: expect.any(Date),
			pricingStrategy: 'default-pricing',
			shippingStrategy: 'default-shipping',
			validationStrategy: 'default-validation',
			items: [ { productId: expect.any(String), quantity: 10 } ],
			pricing: {
				pricePerItem: expect.any(Object),
				totalPrice: 1000,
				totalShippingCost: 0.424,
				totalDiscount: 0,
				totalCost: 1000.424
			},
			allocations: [
				{
					warehouseId: 'warehouse-1',
					productId: expect.any(String),
					quantity: 10,
					distance: '4.24'
				}
			],
		});

		const finalized = await orderSvc.finalizeOrder(orderId, proposal!);
		expect(finalized).toBe(orderId);

		const finalOrder = await orderSvc.getOrder(orderId);
		if (!finalOrder) throw new Error('Order not found after finalization');
		expect(finalOrder).toMatchObject({
			orderId,
			externalCustomerId: 'customer-1',
			addressId: expect.any(String),
			agentId: 'agent-1',
			status: 'processing',
			createdOn: expect.any(Date),
			pricingStrategy: 'default-pricing',
			shippingStrategy: 'default-shipping',
			validationStrategy: 'default-validation',
			items: [ { productId: expect.any(String), quantity: 10 } ],
			pricing: {
				totalCost: 1000.424,
				totalPrice: 1000,
				pricePerItem: expect.any(Object),
				totalDiscount: 0,
				totalShippingCost: 0.424
			},
			allocations: [
				{
				warehouseId: 'warehouse-1',
				productId: expect.any(String),
				quantity: 10,
				status: 'pending'
				}
			]
		});

		await new Promise((resolve) => setTimeout(resolve, 5000));

		const allocations = await invSvc.getAllocatedStock(orderId);
		console.log("Allocations:", allocations);
		expect(allocations.length).toBeGreaterThan(0);

		const inventory = await invSvc.getInventory('warehouse-1', productId);
		expect(inventory).toBe(90); // 100 - 10 allocated

	}, 25000);
});
