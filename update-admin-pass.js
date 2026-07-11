const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@fpt.edu.vn';
  const password = 'Admin123!';
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { email },
    data: {
      passwordHash,
    }
  });

  console.log('Admin account updated:');
  console.log('Email:', email);
  console.log('Password:', password);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
