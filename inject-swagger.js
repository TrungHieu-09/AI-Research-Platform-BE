const fs = require('fs');
const path = require('path');

const swaggerSpecs = {
  'api/documents/route.ts': `/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: List User Documents
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: A paginated list of documents
 *   post:
 *     summary: Register Document Metadata
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               fileHash: { type: string }
 *               fileSize: { type: integer }
 *               mimeType: { type: string }
 *               fileUrl: { type: string }
 *               subjectId: { type: string }
 *     responses:
 *       201:
 *         description: Document metadata registered
 */\n`,
  'api/documents/[id]/route.ts': `/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get Document Details
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Document details
 *   delete:
 *     summary: Soft Delete Document
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Document soft deleted
 */\n`,
  'api/documents/[id]/audit/route.ts': `/**
 * @swagger
 * /api/documents/{id}/audit:
 *   get:
 *     summary: Get Document Audit Logs
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of audit logs for the document
 */\n`,
  'api/documents/[id]/moderate/route.ts': `/**
 * @swagger
 * /api/documents/{id}/moderate:
 *   post:
 *     summary: Moderate Document (Approve/Reject)
 *     tags: [Moderation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document moderation updated
 */\n`,
  'api/documents/upload-url/route.ts': `/**
 * @swagger
 * /api/documents/upload-url:
 *   post:
 *     summary: Get Presigned Upload URL
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName: { type: string }
 *               mimeType: { type: string }
 *     responses:
 *       200:
 *         description: Presigned URL generated
 */\n`,
  'api/subjects/route.ts': `/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: List Subjects
 *     tags: [Subjects]
 *     responses:
 *       200:
 *         description: List of subjects
 *   post:
 *     summary: Create Subject
 *     tags: [Subjects]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *     responses:
 *       201:
 *         description: Subject created
 */\n`,
  'api/subjects/[id]/route.ts': `/**
 * @swagger
 * /api/subjects/{id}:
 *   get:
 *     summary: Get Subject Detail
 *     tags: [Subjects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Subject detail
 *   put:
 *     summary: Edit Subject Metadata
 *     tags: [Subjects]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Subject updated
 *   delete:
 *     summary: Disable/Remove Subject
 *     tags: [Subjects]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Subject removed
 */\n`,
  'api/subjects/suggest/route.ts': `/**
 * @swagger
 * /api/subjects/suggest:
 *   get:
 *     summary: Get Pending Subject Suggestions
 *     tags: [Subjects]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of suggestions
 *   post:
 *     summary: Suggest a new Subject
 *     tags: [Subjects]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Suggestion created
 */\n`,
  'api/ai/chat/route.ts': `/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: AI Chat Stream (RAG)
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *               sessionId: { type: string }
 *               documentId: { type: string }
 *               scope: { type: string }
 *     responses:
 *       200:
 *         description: AI response and citations
 */\n`,
  'api/ai/limit/route.ts': `/**
 * @swagger
 * /api/ai/limit:
 *   get:
 *     summary: Check AI Rate Limits
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token quota and remaining limits
 */\n`,
  'api/payments/checkout/route.ts': `/**
 * @swagger
 * /api/payments/checkout:
 *   post:
 *     summary: Initiate Order Checkout
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planId: { type: string }
 *     responses:
 *       201:
 *         description: Payment intent initiated
 */\n`,
  'api/payments/webhook/route.ts': `/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Payment Callback Webhook
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received and processed
 */\n`
};

const basePath = path.join(__dirname, 'src', 'app');

for (const [routePath, swaggerComment] of Object.entries(swaggerSpecs)) {
  const fullPath = path.join(basePath, routePath.split('/').join(path.sep));
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes('@swagger')) {
      const importMatches = [...content.matchAll(/^import .*/gm)];
      if (importMatches.length > 0) {
        const lastImportMatch = importMatches[importMatches.length - 1];
        const lastImportIndex = lastImportMatch.index + lastImportMatch[0].length;
        content = content.slice(0, lastImportIndex) + '\n\n' + swaggerComment + content.slice(lastImportIndex).trimStart();
      } else {
        content = swaggerComment + content;
      }
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log("Updated " + fullPath);
    } else {
      console.log("Skipped " + fullPath + " (already has @swagger)");
    }
  } else {
    console.log("File not found: " + fullPath);
  }
}
