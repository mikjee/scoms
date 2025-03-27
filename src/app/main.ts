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
import { TOrderId, TOrderProposal } from '@common/types/order';
import { PostgreSqlContainer as pgContainer } from '@testcontainers/postgresql';
import { Wait } from 'testcontainers';
import { IPgConnectionArgs, IPgService } from '@common/types/pg';

// ---

console.log("Begin Bootrap Monolith..");

(async () => {
		
	// Load env vars
	dotenv.config();
	const pgConfig: IPgConnectionArgs = {
		user: process.env.PGUSER,
		password: process.env.PGPASSWORD,
		host: process.env.PGHOST,
		port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
		database: process.env.PGDATABASE,
	};

	// Start test container
	const container = await new pgContainer("postgis/postgis:13-3.1-alpine")
		.withExposedPorts(5432)
		.withDatabase("scoms")
		.start();

	const pgContainerConfig: IPgConnectionArgs = {
		user: container.getUsername(),
		password: container.getPassword(),
		host: container.getHost(),
		port: container.getMappedPort(5432),
		database: 'scoms',
	};

	// pg service
	const pgsvc: IPgService = await new PgService(
		pgContainerConfig,
		new ConsoleLogger("Postgres Service"),
	);
	await pgsvc.waitForReady();
	await pgsvc.execFile('create.sql');

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

	console.log("Begin Test...");

	// Test the services
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

})();

// ---

// TODO: too much error handling - select which levels and where to handle errors!
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