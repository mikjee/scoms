import 'tsconfig-paths/register';
import "reflect-metadata";

// ---

import dotenv from "dotenv";
import { container } from 'tsyringe';

import { IUIDGenerator, uid } from '@common/lib/uid';
import { PgService } from '@common/pg/PgService';
import { InventoryService } from '@services/inventory/controller';

// -----------------------------

dotenv.config();

// ---

const inventoryContainer = container.createChildContainer();
inventoryContainer.registerInstance('ServiceName', 'inventory');
inventoryContainer.registerInstance('ServicePrefix', 'inv');
inventoryContainer.register(PgService, { useClass: PgService });
inventoryContainer.register<IUIDGenerator>('IUIDGenerator', {
	useValue: uid("inv"),
});
const inventoryService = inventoryContainer.resolve(InventoryService);

// ---

(inventoryService as any).test();
console.log("ok");