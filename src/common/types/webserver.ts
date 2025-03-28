import { NextFunction, Request, Response } from 'express';

// ---

export type TWebResult = {
	code: number, 
	data: any, 
	type: string, 
	length: number | undefined
};

export default (code: number, data?: any, type: string = 'application/json', length?: number): TWebResult => ({ code, data, type, length });

export interface IWebRouteHandler {
	(dataPool: any, response: Response, req: Request): Promise<TWebResult | undefined | false | void>
};

export type TWebRoutes = {
	[path: string]: {
		[subPath: string]: {
			[method: string]: IWebRouteHandler
		}
	}
};

export interface IWebMiddleware {
	(req: Request, res: Response, next: NextFunction): any
};

export interface IWebDataPoolBuilder {
	(req: Request): any
};

export interface IWebServerConfig {
	port: number,
	host: string,
	
	routes: TWebRoutes, 
	middlewares?: Array<IWebMiddleware>,
	dataPoolBuilder?: IWebDataPoolBuilder,
	allowedOrigins?: Array<string>
};