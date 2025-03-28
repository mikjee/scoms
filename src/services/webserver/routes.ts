import { ILoggerService } from '@common/types/logger';
import { IWebDataPoolBuilder, TWebRoutes } from '@common/types/webserver';
import { IInventoryService } from '@common/types/inventory';
import { ICRMService, TUserId } from '@common/types/crm';
import { IOrderService, TOrderId, TOrderProposal } from '@common/types/order';
import { IOrchestrator } from '@common/types/orchestrator';

// ---

export const WebRoutesFactory = (
	logger: ILoggerService,

	inventoryService: IInventoryService,
	crmService: ICRMService,
	orderService: IOrderService,

	orchestrator: IOrchestrator,
): TWebRoutes => ({

	'/status': {
		'/': {
			get: async (dataPool, res) => {
				res.json({ version: '1.0.0' });
			}
		},
	},

	'/customers': {
		'/': {
			get: async (_, res) => {
				const customerIds = await crmService.getAllCustomers();
				res.json(customerIds);
			},
		},

		'/:customerId/addresses': {
			get: async (dataPool, res) => {
				const { customerId }: {
					customerId: TUserId,
				} = dataPool;

				const addresses = await crmService.getAllAddressesByCustomerId(customerId);
				
				res.json(addresses);
			},

			post: async (dataPool, res) => {
				const { customerId, lat, lng } = dataPool;
				const address = await crmService.createAddress(customerId, { lat, lng });
				res.json(address);
			},

			delete: async (dataPool, res) => {
				res.json({ status: 'not implemented' });
			},
		},

		'/:customerId/addresses/:addressId': {
			get: async (dataPool, res) => {
				const { customerId, addressId } = dataPool;
				const address = await crmService.getAddress(addressId);
				res.json(address);
			},
			
			post: async (dataPool, res) => {
				res.json({ status: 'not implemented' });
			},

			delete: async (dataPool, res) => {
				res.json({ status: 'not implemented' });
			},
		},

		'/:customerId/addresses/:addressId/orders': {
			get: async (dataPool, res) => {
				const { customerId, addressId } = dataPool;
				const orders = await orderService.getOrdersByAddressId(addressId);
				res.json(orders);
			},
		},

		'/:customerId/orders': {
			get: async (dataPool, res) => {
				const { customerId } = dataPool;
				const orders = await orderService.getOrdersByCustomerId(customerId);
				res.json(orders);
			},
		},
	},

	'/products': {
		'/': {
			get: async (dataPool, res) => {
				const products = await inventoryService.getAllProducts();
				res.json(products);
			},

			post: async (dataPool, res) => {
				const { productName, attributes } = dataPool;
				const product = await inventoryService.createProduct(productName, attributes);
				res.json(product);
			},
		},

		'/:productId': {
			get: async (dataPool, res) => {
				const { productId } = dataPool;
				const product = await inventoryService.getProduct(productId);
				res.json(product);
			},

			put: async (dataPool, res) => {
				res.json({ status: 'not implemented' });
			},

			delete: async (dataPool, res) => {
				res.json({ status: 'not implemented' });
			},
		}
	},

	'/warehouses': {
		'/': {
			get: async (dataPool, res) => {
				const warehouses = await inventoryService.getAllWarehouses();
				res.json(warehouses);
			},

			post: async (dataPool, res) => {
				const { warehouseId, warehouseName, city, lat, lng } = dataPool;
				const warehouse = await inventoryService.createWarehouse(
					warehouseId, 
					warehouseName, 
					city, 
					{ lat, lng }
				);
				res.json(warehouse);
			},			
		},

		'/:warehouseId': {
			get: async (dataPool, res) => {
				const { warehouseId } = dataPool;
				const warehouse = await inventoryService.getWarehouse(warehouseId);
				res.json(warehouse);
			},

			put: async (dataPool, res) => {
				res.json({ status: 'not implemented' });
			},

			delete: async (dataPool, res) => {
				res.json({ status: 'not implemented' });
			},
		},

		'/:warehouseId/inventory': {
			get: async (dataPool, res) => {
				const { warehouseId } = dataPool;
				const inventory = await inventoryService.getAllInventory(warehouseId);
				res.json(inventory);
			},
		},

		'/:warehouseId/inventory/:productId': {
			get: async (dataPool, res) => {
				const { warehouseId, productId } = dataPool;
				const inventory = await inventoryService.getInventory(warehouseId, productId);
				res.json(inventory);
			},

			post: async (dataPool, res) => {
				const { warehouseId, productId, quantity } = dataPool;
				const inventory = await inventoryService.addInventory(warehouseId, productId, quantity);
				res.json(inventory);
			},

			delete: async (dataPool, res) => {
				const { warehouseId, productId, quantity } = dataPool;
				const inventory = await inventoryService.subtractInventory(warehouseId, productId, quantity);
				res.json(inventory);
			},
		}
	},

	'orders': {
		'/': {
			post: async (dataPool, res) => {
				const { 
					externalCustomerId, 
					addressId, 
					agentId, 
					items, 
					pricingStrategy, 
					shippingStrategy, 
					validationStrategy 
				} = dataPool;

				const order = await orderService.createDraftOrder({
					externalCustomerId,
					addressId,
					agentId,
					items,
					pricingStrategy,
					shippingStrategy,
					validationStrategy,
				});

				res.json(order);
			}	
		},

		'/:orderId': {
			get: async (dataPool, res) => {
				const { orderId } = dataPool;
				const order = await orderService.getOrder(orderId);
				res.json(order);
			},

			put: async (dataPool, res) => {
				const { orderId, items } = dataPool;
				const order = await orderService.updateDraftOrder(orderId, { items });
				res.json(order);
			},

			delete: async (dataPool, res) => {
				res.json({ status: 'not implemented' });
			},
		},

		'/:orderId/proposal': {
			get: async (dataPool, res) => {
				const { orderId } = dataPool;
				const order = await orderService.createOrderProposal(orderId);
				res.json(order);
			},

			post: async (dataPool, res) => {

				const { orderId, proposal }: {
					orderId: TOrderId,
					proposal: TOrderProposal,
				} = dataPool;

				const validityOrMsg = await orderService.validateOrderProposal({
					...proposal,
					orderId,
				});

				res.json(typeof validityOrMsg === 'boolean' ? 
					{ isValid: validityOrMsg } : 
					{ isValid: false, message: validityOrMsg }
				);
			},
		},

		'/:orderId/confirm': {
			post: async (dataPool, res) => {
				const { orderId, proposal }: {
					orderId: TOrderId,
					proposal: TOrderProposal,
				} = dataPool;

				const validityOrMsg = await orderService.finalizeOrder(orderId, proposal);

				res.json(typeof validityOrMsg === 'boolean' ? 
					{ isValid: validityOrMsg } : 
					{ isValid: false, message: validityOrMsg }
				);
			}
		},
	},

});

export const buildWebDataPool: IWebDataPoolBuilder = (req) => {
	return {
		...req.query,
		...req.body,
		...req.params,
		...req.cookies,
	};
};