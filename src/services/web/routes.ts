import { ILoggerService } from '@common/types/logger';
import { IHTTPDataPoolBuilderFn, THTTPRoutes } from './types';
import { IInventoryService } from '@common/types/inventory';
import { ICRMService } from '@common/types/crm';
import { IOrderService } from '@common/types/order';
import { Orchestrator } from '@services/orchestrator/Orchestrator';

// ---

export const HTTPRoutesFactory = (
	logger: ILoggerService,

	inventoryService: IInventoryService,
	crmService: ICRMService,
	orderService: IOrderService,

	orchestrator: Orchestrator,
): THTTPRoutes => ({

	'/status': {
		'/': {
			get: async (dataPool, res) => {
				res.json({ status: true });
			}
		},
	},

	'/customers': {
		'/': {
			get: async (dataPool, res) => {},
		},

		'/:customerId/addresses': {
			get: async (dataPool, res) => {},
			put: async (dataPool, res) => {},
			delete: async (dataPool, res) => {},
		},

		'/:customerId/addresses/:addressId': {
			get: async (dataPool, res) => {},
			put: async (dataPool, res) => {},
			delete: async (dataPool, res) => {},
		},
	},

	'/products': {
		'/': {
			get: async (dataPool, res) => {},
			post: async (dataPool, res) => {}
		},

		'/:productId': {
			get: async (dataPool, res) => {},
			put: async (dataPool, res) => {},
			delete: async (dataPool, res) => {},
		}
	},

	'/warehouses': {
		'/': {
			get: async (dataPool, res) => {},
			post: async (dataPool, res) => {},			
		},

		'/:warehouseId': {
			get: async (dataPool, res) => {},
			put: async (dataPool, res) => {},
			delete: async (dataPool, res) => {},
		},

		'/:warehouseId/inventory': {
			get: async (dataPool, res) => {},
		},

		'/:warehouseId/inventory/:productId': {
			get: async (dataPool, res) => {},
			post: async (dataPool, res) => {},
			delete: async (dataPool, res) => {},
		}
	},

	'orders': {
		'/': {
			get: async (dataPool, res) => {},
			post: async (dataPool, res) => {},
			delete: async (dataPool, res) => {},		
		}
	},

});

export const buildHTTPDataPool: IHTTPDataPoolBuilderFn = (req) => {
	return {
		...req.query,
		...req.body,
		...req.params,
		...req.cookies,
	};
};