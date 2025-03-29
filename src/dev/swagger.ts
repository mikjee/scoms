import { readFileSync } from 'fs';
import YAML from 'yaml';

export const swaggerSpec = YAML.parse(
	readFileSync('docs/swagger/openapi.yaml', 'utf8')
);