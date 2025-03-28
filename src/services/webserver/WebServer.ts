import express, { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { IWebDataPoolBuilder, IWebMiddleware, IWebServerConfig, TUrlPath, TWebRoutes } from '@common/types/webserver';
import { ILoggerService } from '@common/types/logger';

// ---

export class WebServer {

	constructor(
		private readonly options: IWebServerConfig,
		private readonly logger: ILoggerService,
	) {
		
	}

	// ---

	private limiter = rateLimit({
		windowMs: 60 * 1000, 	// 1 minute
		max: 100 				// limit each IP to 20 requests per windowMs
	});

	private route = (
		app: any,

		routes: TWebRoutes,
		middlewares: Array<IWebMiddleware> = [],

		buildDataPool: IWebDataPoolBuilder = (request) => ({
			...request.query,
			...request.body,
			...request.params,
			...request.cookies,
		}) 
	) => {	

		// Parse routes
		Object.keys(routes).forEach(_path => {

			const path = _path as TUrlPath;
			const router = express.Router();
			
			Object.keys(routes[path]).forEach(_subPath => {
				const subPath = _subPath as TUrlPath;

				Object.keys(routes[path][subPath]).forEach(method => {

					const handler = routes[path][subPath][method];

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
							this.logger.error('Express route handler error', { error: err, request });
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

	public serve = async () => {

		const {
			port,
			host,

			routes,
			middlewares,
			dataPoolBuilder,
			allowedOrigins,
		} = this.options;

		// Init
		const app = express();
		const server = http.createServer(app);

		// CORS, Cookies, JSON body parser, fileupload, ratelimiter
		app.use(cors({
			origin: allowedOrigins || true,
			credentials: true,
		}));
		app.use(cookieParser());
		app.use(express.json());
		app.use(this.limiter);

		// Shutdown seq
		const shutdown = () => {
			this.logger.warn('Stopping HTTP server!');
			server.close();
		};
		process.on('SIGTERM', shutdown);
		process.on('SIGINT', shutdown);
		
		// Route traffic - HTTP
		this.route(
			app, 
			routes, 
			middlewares,
			dataPoolBuilder
		);

		// Start HTTP server
		try {
			await server.listen(port);
			this.logger.log(`Started express server at https://localhost:${port}`);
		}
		catch (err) {
			this.logger.error('Failed to start express server', { error: err });
		}

		// Error handler middleware for Express - install this last
		app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
			this.logger.error('Express routing error', {
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

		return { server, app };
	}

};