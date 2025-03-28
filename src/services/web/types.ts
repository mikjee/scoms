import { NextFunction, Request, Response } from 'express';

// ---

export type THTTPResult = {
	code: number, 
	data: any, 
	type: string, 
	length: number | undefined
};

export default (code: number, data?: any, type: string = 'application/json', length?: number): THTTPResult => ({ code, data, type, length });

export interface IHTTPHandlerFn {
	(dataPool: any, response: Response, req: Request): Promise<THTTPResult | undefined | false | void>
};

export type THTTPRoutes = {
	[path: string]: {
		[subPath: string]: {
			[method: string]: IHTTPHandlerFn
		}
	}
};

export interface IHTTPMiddlewareFn {
	(req: Request, res: Response, next: NextFunction): any
};

export interface IHTTPDataPoolBuilderFn {
	(req: Request): any
};

export interface IServeOptions {
	HTTPRoutes: THTTPRoutes, 
	HTTPMiddlewares?: Array<IHTTPMiddlewareFn>,
	buildHTTPDataPool?: IHTTPDataPoolBuilderFn,
	originArr?: Array<string>
};