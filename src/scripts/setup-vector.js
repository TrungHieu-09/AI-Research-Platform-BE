const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('1. Enabling pgvector extension...');
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
  
  console.log('2. Adding metadata column...');
  await prisma.$executeRawUnsafe('ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\'::jsonb;');
  
  console.log('3. Updating embedding vector(768) column for Gemini...');
  await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS document_chunks_embedding_idx;');
  await prisma.$executeRawUnsafe('ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;');
  await prisma.$executeRawUnsafe('ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(768);');
  
  console.log('4. Creating HNSW vector index for vector(768)...');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);');
  
  console.log('✅ ALL pgvector columns and indexes created successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
