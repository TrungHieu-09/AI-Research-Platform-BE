import { NextRequest, NextResponse } from "next/server"
import { getDocumentRatings, createDocumentRating, updateDocumentRating } from "@/lib/services/interaction-service"
import { CreateRatingSchema, UpdateRatingSchema } from "@/lib/validation/interaction"

/**
 * @swagger
 * /api/documents/{id}/ratings:
 *   get:
 *     summary: Get Document Ratings
 *     description: Retrieve average rating, total count, and individual reviews for a document.
 *     tags:
 *       - Document Interactions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Document ID (UUID).
 *     responses:
 *       200:
 *         description: Ratings summary and list retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 average: { type: number, example: 4.5 }
 *                 total: { type: integer, example: 12 }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       rating: { type: integer, example: 5 }
 *                       comment: { type: string, example: "Excellent study material!" }
 *                       user:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           avatarUrl: { type: string }
 *   post:
 *     summary: Submit Document Rating
 *     description: Create a new rating (1-5 stars) and optional comment for a document. Each user can rate a document once.
 *     tags:
 *       - Document Interactions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               comment: { type: string, example: "Very helpful notes." }
 *     responses:
 *       201:
 *         description: Rating created successfully.
 *       400:
 *         description: User already rated this document or invalid input.
 *       404:
 *         description: Document not found.
 *       422:
 *         description: Validation error.
 *   put:
 *     summary: Update Document Rating
 *     description: Update an existing rating or comment submitted by the caller.
 *     tags:
 *       - Document Interactions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 4 }
 *               comment: { type: string, example: "Updated review after reading chapter 3." }
 *     responses:
 *       200:
 *         description: Rating updated successfully.
 *       400:
 *         description: Rating not found or error updating.
 *       422:
 *         description: Validation error.
 */

// GET /api/documents/[id]/ratings
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await Promise.resolve(context.params);
    const ratings = await getDocumentRatings(id)
    return NextResponse.json(ratings, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch ratings." }, { status: 500 })
  }
}

// POST /api/documents/[id]/ratings
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await Promise.resolve(context.params);
    const userId = req.headers.get("x-user-id")
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const body = await req.json()
    const parsed = CreateRatingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const rating = await createDocumentRating(id, userId, parsed.data)
    return NextResponse.json(rating, { status: 201 })
  } catch (err: any) {
    const status = err.message === "Document not found." ? 404 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}

// PUT /api/documents/[id]/ratings
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await Promise.resolve(context.params);
    const userId = req.headers.get("x-user-id")
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const body = await req.json()
    const parsed = UpdateRatingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const rating = await updateDocumentRating(id, userId, parsed.data)
    return NextResponse.json(rating, { status: 200 })
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}
