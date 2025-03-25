const dotenv = require('dotenv');
dotenv.config();

module.exports = {
	"transforms": [
		{
			"mode": "sql",
			"include": "services/**/sql/*.sql",
			"emitTemplate": "{{dir}}/{{name}}.sql.ts"
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
		ssl: {
			host: process.env.PGSSLHOST,
			port: Number(process.env.PGSSLPORT),
			ca: process.env.PGSSLROOTCERT,
			key: process.env.PGSSLKEY,
			cert: process.env.PGSSLCERT,
		},
	},
};