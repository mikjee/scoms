import 'tsconfig-paths/register';
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
import { setupPgTestService } from '@common/pg/PgTestService';

export async function setupTest() {
	
	console.log("Begin Test Setup..");
	
	// Start test container
	console.log("Starting Postgres Test Container..");
	const pgContainerConfig = await setupPgTestService();

	// pg service
	const pgsvc: IPgService = await new PgService(
		pgContainerConfig,
		new ConsoleLogger("Postgres Service"),
	);

	// load schema and populate test data
	await pgsvc.waitForReady();
	await pgsvc.execFile('create.sql');
	await pgsvc.execFile('populate.sql');

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

	// done
	return {
		crmSvc, 
		invSvc, 
		orderSvc,
		orchestrator,
		evSvc,
		pgsvc,
	};

}