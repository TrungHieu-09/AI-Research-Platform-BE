const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'`.then(res => {
  console.log(res);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
