import { NextRequest, NextResponse } from "next/server"
import { getUserCollections, createCollection } from "@/lib/services/collection-service"
import { CreateCollectionSchema } from "@/lib/validation/collection"

/**
 * @swagger
 * /api/collections:
 *   get:
 *     summary: Get User Document Collections
 *     description: Retrieve all personal document collections created by the authenticated user along with document counts and recent previews.
 *     tags:
 *       - Collections
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of user collections retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   name: { type: string, example: "AI Research Papers" }
 *                   _count:
 *                     type: object
 *                     properties:
 *                       documents: { type: integer, example: 5 }
 *                   createdAt: { type: string, format: date-time }
 *       401:
 *         description: Authentication required.
 *   post:
 *     summary: Create New Collection
 *     description: Create a new personal document folder/collection for grouping documents.
 *     tags:
 *       - Collections
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name: { type: string, example: "Final Year Thesis Reference" }
 *     responses:
 *       201:
 *         description: Collection created successfully.
 *       422:
 *         description: Validation error.
 */

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const collections = await getUserCollections(userId)
    return NextResponse.json(collections, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch collections." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const body = await req.json()
    const parsed = CreateCollectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const collection = await createCollection(userId, parsed.data)
    return NextResponse.json(collection, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to create collection." }, { status: 400 })
  }
}
