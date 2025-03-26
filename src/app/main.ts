import 'tsconfig-paths/register';
import dotenv from "dotenv";
import { PgService } from '@common/pg/PgService';
import { InventoryService } from '@services/inventory/InventoryService';
import { ConsoleLogger } from '@common/consoleLogger/ConsoleLogger';
import { uid } from '@common/lib/util';
import { PGEventService } from '@services/events/PGEventService';
import { CRMService } from '@services/crm/CRMService';
import { Orchestrator } from '@services/orchestrator/Orchestrator';
import { OrderService } from '@services/order/OrderService';
import { defaultPricing } from '@services/order/strategies/defaultPricing';
import { defaultAllocation } from '@services/order/strategies/defaultAllocation';
import { defaultValidation } from '@services/order/strategies/defaultValidation';
import { setupPgTestWithSchema } from '@common/pg/PgTestService';
import { TProductId } from '@common/types/inventory';
import { TAddressId } from '@common/types/crm';
import { TOrderId } from '@common/types/order';

// ---

console.log("Begin Bootrap Monolith..");

(async () => {
		
	// Load env vars
	dotenv.config();

	// pg service
	// const pgsvc = new PgService();
	const pgsvc = await setupPgTestWithSchema();

	// event service - both producer & consumer
	const evSvc = new PGEventService(
		pgsvc,
		new ConsoleLogger("Event Service"),
		uid('inv'),
	);

	// inventory service
	const invSvc = new InventoryService(
		pgsvc,
		new ConsoleLogger("Inventory Service"), 
		uid('inv'),
		evSvc,
	);

	// crm service
	const crmSvc = new CRMService(
		pgsvc,
		new ConsoleLogger("CRM Service"), 
		uid('crm'),
	);

	// order service
	const orderSvc = new OrderService(
		pgsvc,
		new ConsoleLogger("Order Service"), 
		uid('o'),

		evSvc,
		invSvc,
		crmSvc,
	);

	orderSvc.registerStrategy("default-pricing", defaultPricing);
	orderSvc.registerStrategy("default-shipping", defaultAllocation);
	orderSvc.registerStrategy("default-validation", defaultValidation);

	// orchestrator
	const orchestrator = new Orchestrator(
		new ConsoleLogger("Orchestrator"),

		evSvc,
		evSvc,
		orderSvc,
		crmSvc,
		invSvc,
	);

	// All ready
	// evSvc.start();
	// orchestrator.start();
	console.log("Monolith Bootstrap Complete!");

	// ---

	// Test the services
	let addressId: TAddressId = '';
	await crmSvc.createAddress(
		"customer-1",
		{ lat: 1, lng: 2 },
		{ meta: { test: "test" } },
	).then((address) => {
		console.log("Created address:", address);
		addressId = address.addressId;
	});

	let productId: TProductId = '';
	await invSvc.createProduct(
		"Product 1",
		{ price: { value: 100} , weight: { value: 1} },
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

	await orderSvc.createOrderProposal(
		orderId,
	).then((order) => {
		if (!order) {
			console.error("Failed to create order proposal");
			return;
		}
		console.log("Created order proposal:", order);
	});



})();

// ---

// TODO: service-complaint return values from methods!
// TODO: add dependency injection - tsyringe!
// TODO: add query builder kysely!
// TODO: Add auth? or only for wrapper exposing it to the outside world?
// TODO: generate test spec for each method
// TODO: add caching - redis required? - use demo data for now
// TODO: create REST wrapper
// TODO: eslint rules are not working - import restrictions, console restrictions
// TODO: create plans - mvp and mvp phase 2
// TODO: add swagger docs
// TODO: add jsdoc style comments
// TODO: add ci/cd - setup husky, lint-staged, and other tools