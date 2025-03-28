import { ILoggerService } from '@common/types/logger';
import { IWebDataPoolBuilder, TWebRoutes } from '@common/types/webserver';
import { IInventoryService, TProductId, TWarehouseId } from '@common/types/inventory';
import { ICRMService, TAddressId, TUserId } from '@common/types/crm';
import { IOrderService, TOrderId, TOrderProposal, TOrderStrategyId } from '@common/types/order';
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
			get: async (_, res) => {
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
				const { customerId }: {	customerId: TUserId, } = dataPool;
				const addresses = await crmService.getAllAddressesByCustomerId(customerId);
				res.json(addresses);
			},

			post: async (dataPool, res) => {
				const { customerId, lat, lng }: {
					customerId: TUserId,
					lat: number,
					lng: number,
				} = dataPool;
				const address = await crmService.createAddress(customerId, { lat, lng });
				res.json(address);
			},

			delete: async (_, res) => {
				res.json({ status: 'not implemented' });
			},
		},

		'/:customerId/addresses/:addressId': {
			get: async (dataPool, res) => {
				const { customerId, addressId }: {
					customerId: TUserId,
					addressId: TAddressId,
				} = dataPool;
				const address = await crmService.getAddress(addressId);
				res.json(address);
			},
			
			post: async (_, res) => {
				res.json({ status: 'not implemented' });
			},

			delete: async (_, res) => {
				res.json({ status: 'not implemented' });
			},
		},

		'/:customerId/addresses/:addressId/orders': {
			get: async (dataPool, res) => {
				const { customerId, addressId }: {
					customerId: TUserId,
					addressId: TAddressId,
				} = dataPool;
				const orders = await orderService.getOrdersByAddressId(addressId);
				res.json(orders);
			},
		},

		'/:customerId/orders': {
			get: async (dataPool, res) => {
				const { customerId }: {
					customerId: TUserId,
				} = dataPool;
				const orders = await orderService.getOrdersByCustomerId(customerId);
				res.json(orders);
			},
		},
	},

	'/products': {
		'/': {
			get: async (_, res) => {
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
				const { productId }: {
					productId: TProductId,
				} = dataPool;
				const product = await inventoryService.getProduct(productId);
				res.json(product);
			},

			put: async (_, res) => {
				res.json({ status: 'not implemented' });
			},

			delete: async (_, res) => {
				res.json({ status: 'not implemented' });
			},
		}
	},

	'/warehouses': {
		'/': {
			get: async (_, res) => {
				const warehouses = await inventoryService.getAllWarehouses();
				res.json(warehouses);
			},

			post: async (dataPool, res) => {
				const { warehouseId, warehouseName, city, lat, lng }: {
					warehouseId: TWarehouseId,
					warehouseName: string,
					city: string,
					lat: number,
					lng: number,
				} = dataPool;

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
				const { warehouseId }: {
					warehouseId: TWarehouseId,
				} = dataPool;
				const warehouse = await inventoryService.getWarehouse(warehouseId);
				res.json(warehouse);
			},

			put: async (_, res) => {
				res.json({ status: 'not implemented' });
			},

			delete: async (_, res) => {
				res.json({ status: 'not implemented' });
			},
		},

		'/:warehouseId/inventory': {
			get: async (dataPool, res) => {
				const { warehouseId }: {
					warehouseId: TWarehouseId,
				} = dataPool;
				const inventory = await inventoryService.getAllInventory(warehouseId);
				res.json(inventory);
			},
		},

		'/:warehouseId/inventory/:productId': {
			get: async (dataPool, res) => {
				const { warehouseId, productId }: {
					warehouseId: TWarehouseId,
					productId: TProductId,
				} = dataPool;
				const inventory = await inventoryService.getInventory(warehouseId, productId);
				res.json(inventory);
			},

			post: async (dataPool, res) => {
				const { warehouseId, productId, quantity }: {
					warehouseId: TWarehouseId,
					productId: TProductId,
					quantity: number,
				} = dataPool;
				const inventory = await inventoryService.addInventory(warehouseId, productId, quantity);
				res.json(inventory);
			},

			delete: async (dataPool, res) => {
				const { warehouseId, productId, quantity }: {
					warehouseId: TWarehouseId,
					productId: TProductId,
					quantity: number,
				} = dataPool;
				const inventory = await inventoryService.subtractInventory(warehouseId, productId, quantity);
				res.json(inventory);
			},
		}
	},

	'/orders': {
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
				}: {
					externalCustomerId: TUserId,
					addressId: TAddressId,
					agentId: TUserId,
					items: { productId: TProductId; quantity: number }[],
					pricingStrategy: TOrderStrategyId,
					shippingStrategy: TOrderStrategyId,
					validationStrategy: TOrderStrategyId,
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
				const { orderId }: {
					orderId: TOrderId,
				} = dataPool;
				const order = await orderService.getOrder(orderId);
				res.json(order);
			},

			put: async (dataPool, res) => {
				const { orderId, items }: {
					orderId: TOrderId,
					items: { productId: TProductId; quantity: number }[],
				} = dataPool;
				const order = await orderService.updateDraftOrder(orderId, { items });
				res.json(order);
			},

			delete: async (_, res) => {
				res.json({ status: 'not implemented' });
			},
		},

		'/:orderId/proposal': {
			get: async (dataPool, res) => {
				const { orderId }: {
					orderId: TOrderId,
				} = dataPool;
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