import { ICRMService } from '@common/types/crm';
import { IEventProducer } from '@common/types/events';
import { IInventoryService } from '@common/types/inventory';
import { ILoggerService } from '@common/types/logger';
import { TOrderDraft, TOrderProposal } from '@common/types/order';
import { IPgService } from '@common/types/pg';
import { IUIDGenerator } from '@common/types/uid';
import { IOrderPricingStrategyHandler } from '@services/order/types';

// ---

export const defaultPricing: IOrderPricingStrategyHandler = async (
	order: TOrderProposal,
	
	db: IPgService,
	logger: ILoggerService,
	uid: IUIDGenerator,
	eventProducer: IEventProducer,
	
	inventoryService: IInventoryService,
	crmService: ICRMService,
) => {
	// This method will get price for each item using InventoryService.getProduct().attributes.price
	// Then it will calculate the price per item and total price
	// Price per item is calculated as shipping distance * price per km * quantity, for each warehouse
	// Total price is as follows:
	// (sum of all items prices) - (volume discounts) + (shipping cost)
	// Then it will return the pricing object, with accurate breakdown of the pricing, including discount and shipping cost

	// Volume discount helper function
	const getVolumeDiscount = (quantity: number) => {
		// The logic for volume discount is such - 
		/*
			• 25+ units: 5% discount
			• 50+ units: 10% discount
			• 100+ units: 15% discount
			• 250+ units: 20% discount
		*/

		if (quantity >= 250) return 0.2;
		if (quantity >= 100) return 0.15;
		if (quantity >= 50) return 0.1;
		if (quantity >= 25) return 0.05;

		return 0; // No discount for now
	};

	// First get price and weight for all products in the order
	let products = await Promise.all(order.items.map(async (item) => {
		const product = await inventoryService.getProduct(item.productId);

		if (!product) {
			logger.error('Product not found', { productId: item.productId });
			throw `Product not found: ${item.productId}`;
		}

		return {
			productId: product.productId,
			price: parseInt(product.attributes.price!.value! as string),
			weight: parseInt(product.attributes.weight!.value! as string),
		};
	}));

	// Calculate price per item = item order quantity * product price, volume discount
	const pricePerItem = products.map((product, i) => {
		return {
			productId: product.productId,
			price: product.price * order.items[i].quantity,
			shippingCost: 0,
			discount: getVolumeDiscount(order.items[i].quantity) * product.price * order.items[i].quantity,
		};
	});

	// Calculate shipping cost = s $0.01 per kilogram per kilometer
	order.allocations.forEach((alloc) => {
		const product = products.find((p) => p.productId === alloc.productId);
		const itemPricing = pricePerItem.find((p) => p.productId === alloc.productId);

		if (!product || !itemPricing) {
			logger.error('Product not found for allocation', { productId: alloc.productId });
			throw `Product not found for allocation: ${alloc.productId}`;
		}

		const shippingCost = alloc.distance * 0.01 * product.weight * alloc.quantity;
		itemPricing.shippingCost += shippingCost;
	});

	//Calculate total price = sum of all items prices - volume discounts + shipping cost
	const totalPrice = pricePerItem.reduce((acc, item) => acc + item.price, 0);
	const totalShippingCost = pricePerItem.reduce((acc, item) => acc + item.shippingCost, 0);
	const totalDiscount = pricePerItem.reduce((acc, item) => acc + item.discount, 0);
	const totalCost = totalPrice - totalDiscount + totalShippingCost;

	// all done
	return {
		pricePerItem,
		totalPrice,
		totalShippingCost,
		totalDiscount,
		totalCost,
	};
};