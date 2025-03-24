const dotenv = require('dotenv');
dotenv.config();

module.exports = {
	"transforms": [
		{
			"mode": "sql",
			"include": "services/**/queries/*.sql",
			"emitTemplate": "{{dir}}/{{name}}.queries.ts"
		}
	],
	"srcDir": "./src",
	"failOnError": false,
	"camelCaseColumnNames": false,
	"db": {
		host: process.env.PGHOST,
		port: Number(process.env.PGPORT),
		user: process.env.PGUSER,
		password: process.env.PGPASSWORD,
		dbName: process.env.PGDATABASE,
	},
};