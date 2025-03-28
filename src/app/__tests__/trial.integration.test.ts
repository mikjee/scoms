import { IInventoryService, TProductId } from '@common/types/inventory';
import { ICRMService, TAddressId } from '@common/types/crm';
import { IOrderService, TOrderId, TOrderProposal } from '@common/types/order';
import { EEventType, IEventConsumer, IEventProducer } from '@common/types/events';

// ---

export const trialTest = async (
	crmSvc: ICRMService,
	invSvc: IInventoryService,
	orderSvc: IOrderService,
	evSvc: IEventProducer & IEventConsumer,
) => {
	
	let addressId: TAddressId = '';
	await crmSvc.createAddress(
		"customer-1",
		{ lat: 4, lng: 5 },
		{ meta: { test: "test" } },
	).then((address) => {
		console.log("Created address:", address);
		addressId = address.addressId;
	});

	let productId: TProductId = '';
	await invSvc.createProduct(
		"Product 1",
		{price: {value: 100} , weight: {value: 1}},
	).then((product) => {
		console.log("Created product:", product);
		productId = product.productId;
	});

	await invSvc.createWarehouse(
		"warehouse-1",
		"Warehouse 1",
		"City 1",
		{ lat: 1, lng: 2 },
	).then((warehouse) => {
		console.log("Created warehouse:", warehouse);
	});

	await invSvc.addInventory(
		"warehouse-1",
		productId,
		100,
	).then((quantity) => {
		console.log("Added inventory:", quantity);
	});

	let orderId: TOrderId = '';
	await orderSvc.createDraftOrder(
		{
			externalCustomerId: "customer-1",
			addressId,
			agentId: "agent-1",

			pricingStrategy: "default-pricing",
			shippingStrategy: "default-shipping",
			validationStrategy: "default-validation",

			items: [
				{
					productId,
					quantity: 10,
				},
			],
		},
	).then((order) => {
		if (!order) {
			console.error("Failed to create draft order");
			return;
		}
		console.log("Created draft order:", order);
		orderId = order.orderId;
	});

	let proposedOrder: TOrderProposal;
	await orderSvc.createOrderProposal(
		orderId,
	).then((order) => {
		if (!order) {
			console.error("Failed to create order proposal");
			return;
		}
		proposedOrder = order;
		console.log("Created order proposal:", order);
	});

	const result = await orderSvc.finalizeOrder(
		orderId,
		proposedOrder!,
	);
	console.log("is order finalized:", result);

	const finalOrder = await orderSvc.getOrder(orderId);
	console.log("Finalized order:", finalOrder);

	const confirmResult = await invSvc.confirmAllocation(
		orderId,
	);
	console.log("is allocation confirmed:", confirmResult);

	const orderAllocations = await invSvc.getAllocatedStock(orderId);
	const inventory = await invSvc.getInventory(
		"warehouse-1",
		productId,
	);
	console.log("Inventory after allocation:", inventory);
	console.log("Order allocations:", orderAllocations);

	console.log("End Test");
	return;

	evSvc.subscribe(EEventType.ORDER_PROCESSING, async (event) => {
		console.log("Test event received 1:", event.eventType);
	});

	evSvc.subscribe(EEventType.ORDER_PROCESSING, async (event) => {
		console.log("Test event received 2:", event.eventType);
	});

	evSvc.emit({
		eventType: EEventType.ORDER_PROCESSING,
		payload: {
			orderId,
			productId,
			addressId,
		},
	});

	evSvc.emit({
		eventType: EEventType.ORDER_EXECUTED,
		payload: {
			orderId,
			productId,
			addressId,
		},
	});

	evSvc.emit({
		eventType: EEventType.ORDER_PROCESSING,
		payload: {
			orderId,
			productId,
			addressId,
		},
	});

	setTimeout(() => {
		evSvc.subscribe(EEventType.ORDER_EXECUTED, async (event) => {
			console.log("Test event received 3:", event.eventType);
		});
	}, 5000);

};