export type TAddressId = string;
export type TUserId = string;

export type TAddress = {
	addressId: TAddressId;
	coords: { lat: number; lng: number };
	externalCustomerId: TUserId;
	meta?: any;
};

export interface ICRMService {
	getAllCustomers(): Promise<TUserId[]>;

	createAddress(
		externalCustomerId: TUserId,
		coords: { lat: number; lng: number },
		meta?: any,
	): Promise<TAddress>;

	getAddress(addressId: TAddressId): Promise<TAddress | false>;

	getAllAddressesByCustomerId(externalCustomerId: TUserId): Promise<TAddress[]>;
}