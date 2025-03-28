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
import { IPgConnectionArgs, IPgService } from '@common/types/pg';
import { trialTest } from 'src/app/__tests__/trial.integration.test';
import { setupPgTestService } from '@common/pg/PgTestService';

// ---

console.log("Begin Bootrap Monolith..");

(async () => {
		
	// Load env vars
	dotenv.config();
	// const pgConfig: IPgConnectionArgs = {
	// 	user: process.env.PGUSER,
	// 	password: process.env.PGPASSWORD,
	// 	host: process.env.PGHOST,
	// 	port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
	// 	database: process.env.PGDATABASE,
	// };

	// Start test container
	console.log("Starting Postgres Test Container...");
	const pgContainerConfig = await setupPgTestService();

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
		uid('ev'),
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
	evSvc.start();
	orchestrator.start();
	console.log("Monolith Bootstrap Complete!");

	// ---

	console.log("Begin Test...");

	// Test the services
	await trialTest(
		crmSvc,
		invSvc,
		orderSvc,
		evSvc,
	);

})();

// ---

// TODO: inject db namespace
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