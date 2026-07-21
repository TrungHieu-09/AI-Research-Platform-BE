const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const directUrlLine = env.split('\n').find(line => line.startsWith('DIRECT_URL='));
const directUrl = directUrlLine.split('=')[1].replace(/"/g, '').trim();

const { Client } = require('pg');
const client = new Client({ connectionString: directUrl });
client.connect()
  .then(() => client.query('ALTER TABLE "users" ADD COLUMN "tierExpiresAt" timestamp(3) without time zone;'))
  .then(() => {
    console.log("Column added successfully.");
    return client.end();
  })
  .catch(err => {
    console.error(err);
    client.end();
  });
