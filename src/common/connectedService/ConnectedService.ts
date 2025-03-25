import { IUIDGenerator } from '@common/lib/util';
import { IPgService } from '@common/pg/types';

// ------------------------------------------------------------

export class ConnectedService {

	// TODO: Use Dependency Injection
	constructor(
		protected svcName: string = process.env.SERVICE_NAME || 'ConSvc',
		protected svcPrefix: string = process.env.SERVICE_PREFIX || 'svc',

		protected db: IPgService,
		protected uid: IUIDGenerator,

		protected log: typeof console.log = console.log,
		protected error: typeof console.error = console.error,
		protected warn: typeof console.warn = console.warn
	) {}

	// TODO: add logging
	// TODO: use dependency injection!
	// TODO: Add auth? or only for wrapper exposing it to the outside world?
	// TODO: prevent use of console log, error, and warn via eslint, suggest use of given methods
	// TODO: generate test spec for each method
	// TODO: add analytics? action plan? use logs for same?
	// TODO: add emit and subscribe methods for events - IEventConsumer, IEventEmitter
	// TODO: any caching - redis required?
	// TODO: eslint rules are not working - import restrictions, console restrictions
	// TODO: remove pgtyped
	// TODO: create plans - mvp and mvp phase 2
	// TODO: add swagger docs
	// TODO: add jsdoc style comments
	// TODO: add ci/cd - setup husky, lint-staged, and other tools
	
}