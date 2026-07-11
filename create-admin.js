const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@fpt.edu.vn';
  const password = 'admin';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    },
    create: {
      name: 'Super Admin',
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      tier: 'PREMIUM'
    }
  });

  console.log('Admin account created/updated:');
  console.log('Email:', admin.email);
  console.log('Password:', password);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
