const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
client.connect().then(() => {
  return client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
}).then(res => {
  console.log(res.rows);
  client.end();
}).catch(console.error);
