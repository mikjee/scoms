import { IUIDGenerator, uid as prefixUID } from '../lib/uid';
import { PgService } from '../pg/PgService';

// ------------------------------------------------------------

export class ConnectedService {

	protected db: PgService;
	protected uid: IUIDGenerator;
	protected log: typeof console.log = console.log;
	protected error: typeof console.error = console.error;
	protected warn: typeof console.warn = console.warn;

	constructor(
		svcName: string,
		svcPrefix: string,
	) {
		this.db = new PgService();
		this.uid = prefixUID(svcPrefix);
	}

	// TODO: add logging
	// TODO: add DI? is opinionated DI required?
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
	// TODO: add ci/cd
	
}