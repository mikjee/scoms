import { ILoggerService } from '@common/types/logger';

enum LogLevel {
	'LOG' = 'LOG',
	'WARN' = 'WARN',
	'ERROR' = 'ERROR',
};

// ---

export class ConsoleLogger implements ILoggerService {

	constructor(private readonly serviceName: string) {}

	private _log(logLevel: LogLevel, message: string, ...optionalParams: any[]): void {
		console.log(`[${this.serviceName}] (${logLevel}) ${message}`, ...optionalParams);
	}
		
	log (message?: any, ...optionalParams: any[]): void {
		this._log(LogLevel.LOG, message, ...optionalParams);
	}

	warn (message?: any, ...optionalParams: any[]): void {
		this._log(LogLevel.WARN, message, ...optionalParams);
	}

	error (message?: any, ...optionalParams: any[]): void {
		this._log(LogLevel.ERROR, message, ...optionalParams);
	}
	
}