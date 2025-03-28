import express, { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { IHTTPDataPoolBuilderFn, IHTTPMiddlewareFn, IServeOptions, THTTPRoutes } from './types';

// ---

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// ---

// Routes requests for HTTP REST
const routeHTTP = (
	app: any,

	HTTPRoutes: THTTPRoutes,
	middlewares: Array<IHTTPMiddlewareFn> = [],

	buildDataPool: IHTTPDataPoolBuilderFn = (request) => ({
		...request.query,
		...request.body,
		...request.params,
		...request.cookies,
	}) 
) => {	

	// Parse routes
	Object.keys(HTTPRoutes).forEach(path => {

		const router = express.Router();
		
		Object.keys(HTTPRoutes[path]).forEach(subPath => {

			Object.keys(HTTPRoutes[path][subPath]).forEach(method => {

				const handler = HTTPRoutes[path][subPath][method];

				const wrappedHandler = async (request: any, response: Response) => {
					try {
						const dataPool = buildDataPool(request);
						const result = await handler(dataPool, response, request);

						if (!result) return;
						response.status(result.code);

						if (result.type === 'application/json') response.json(result.data);
						else {
							response.contentType(result.type);
							response.send(result.data);
						}

						return response.end();
					}
					catch (err) { 
						console.error('router.route.handle', { error: err, request });
						response.sendStatus(500);
					}
				};

				const routerHook = (router[method as keyof express.Router] as Function).bind(router);
				routerHook(
					subPath, 
					...middlewares,
					wrappedHandler
				);

			});
		});

		app.use(path, router);
	});
	
};

// ---

const serve = async ({
	HTTPRoutes,
	HTTPMiddlewares,
	buildHTTPDataPool,
	originArr,
}: IServeOptions) => {

	// Init
	const app = express();
	const server = http.createServer(app);
	const port = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 3030;

	// CORS, Cookies, JSON body parser, fileupload, ratelimiter
	app.use(cors({
		origin: originArr || true,
		credentials: true,
	}));
	app.use(cookieParser());
	app.use(express.json());
	app.use(limiter);

	// Shutdown seq
	const shutdown = () => {
		console.warn('Stopping HTTP & WS server!');
		server.close();
	};
	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
	
	// Route traffic - HTTP
	routeHTTP(
		app, 
		HTTPRoutes, 
		HTTPMiddlewares,
		buildHTTPDataPool
	);

	// Start HTTP server
	try {
		await server.listen(port);
		console.info(`Started express server at https://localhost:${port}`);
	}
	catch (err) {
		console.error('Failed to start express server', { error: err });
	}

	// Error handler middleware for Express - install this last
	app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
		this.logger.error('express.route.error', {
			method: req.method,
			path: req.path,
			// route: req.route,
			// ip: req.ip,
			// cookies: req.cookies,
			// signedCookies: req.signedCookies,
			// headers: req.headers,
			body: req.body,
			// stack: err.stack
		});
		
		return next(err);
	});

	return server;
}

// ---

export default serve;