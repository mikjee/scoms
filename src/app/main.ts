import 'tsconfig-paths/register';
import dotenv from "dotenv";
import { PgService } from '@common/pg/PgService';
import { InventoryService } from '@services/inventory/InventoryService';
import { ConsoleLogger } from '@common/consoleLogger/ConsoleLogger';
import { uid } from '@common/lib/util';
import { PGEventService } from '@services/events/PGEventService';
import { CRMService } from '@services/crm/CRMService';
import { Orchestrator } from '@services/orchestrator/Orchestrator';

// ---

console.log("Bootrap Monolith..");

// Load env vars
dotenv.config();

// pg service
const pgsvc = new PgService();

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
	evSvc,
);

// order service
const orderSvc = new InventoryService(
	pgsvc,
	new ConsoleLogger("Order Service"), 
	uid('o'),
	evSvc,
);

// orchestrator
const orchestrator = new Orchestrator(
	new ConsoleLogger("Orchestrator"), 
	uid('orc'),

	evSvc,
	evSvc,
	orderSvc,
	crmSvc,
	invSvc,
);

// All ready
// evSvc.start();
// orchestrator.start();
console.log("Monolith started!");

// ---

// TODO: use dependency injection!
// TODO: Add auth? or only for wrapper exposing it to the outside world?
// TODO: generate test spec for each method
// TODO: any caching - redis required?
// TODO: eslint rules are not working - import restrictions, console restrictions
// TODO: create plans - mvp and mvp phase 2
// TODO: add swagger docs
// TODO: add jsdoc style comments
// TODO: add ci/cd - setup husky, lint-staged, and other tools