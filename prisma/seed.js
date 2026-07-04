const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_CONFIGS = [
  {
    key: 'max_file_size_mb',
    value: '50',
    label: 'Dung lượng file tối đa (MB)',
    description: 'Giới hạn kích thước mỗi file upload. Đơn vị: MB.',
  },
  {
    key: 'allowed_mime_types',
    value: JSON.stringify([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'image/png',
      'image/jpeg',
    ]),
    label: 'Định dạng file được phép upload',
    description: 'Danh sách MIME type được chấp nhận (JSON array).',
  },
  {
    key: 'free_ai_limit_per_day',
    value: '10',
    label: 'Giới hạn AI Chat/ngày (Free)',
    description: 'Số lượt chat AI tối đa mỗi ngày cho tài khoản Free.',
  },
  {
    key: 'premium_ai_limit_per_day',
    value: '50',
    label: 'Giới hạn AI Chat/ngày (Premium)',
    description: 'Số lượt chat AI tối đa mỗi ngày cho tài khoản Premium.',
  },
  {
    key: 'ai_cache_ttl_days',
    value: '7',
    label: 'Thời gian cache câu trả lời AI (ngày)',
    description: 'Số ngày giữ cache câu trả lời AI trước khi xóa.',
  },
  {
    key: 'soft_delete_retention_days',
    value: '30',
    label: 'Thời gian giữ file đã xóa (ngày)',
    description: 'Số ngày trước khi tự động hard delete file đã bị xóa mềm.',
  },
  {
    key: 'max_uploads_per_day',
    value: '20',
    label: 'Số file upload tối đa/ngày',
    description: 'Giới hạn số file mỗi Student có thể upload trong 1 ngày.',
  },
];

async function main() {
  console.log('🌱 Seeding default system configs...\n');

  for (const config of DEFAULT_CONFIGS) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
    console.log(`  ✅ ${config.key} = ${config.value}`);
  }

  console.log('\n✅ System configs seeded successfully!');
}

main()
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
