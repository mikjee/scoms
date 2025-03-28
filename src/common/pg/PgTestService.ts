import { IPgConnectionArgs } from '@common/types/pg';
import { PostgreSqlContainer as pgContainer } from '@testcontainers/postgresql';

// ---

export const setupPgTestService = async (): Promise<IPgConnectionArgs> => {

	const container = await new pgContainer("postgis/postgis:13-3.1-alpine")
			.withExposedPorts(5432)
			.withDatabase("scoms")
			.start();
	
	const pgContainerConfig: IPgConnectionArgs = {
		user: container.getUsername(),
		password: container.getPassword(),
		host: container.getHost(),
		port: container.getMappedPort(5432),
		database: 'scoms',
	};

	return pgContainerConfig;

};