import { NextRequest, NextResponse } from "next/server"

/**
 * @swagger
 * /api/documents/mock-upload:
 *   put:
 *     summary: Mock file upload endpoint for local development
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Mock upload successful
 */
export async function PUT(req: NextRequest) {
  return NextResponse.json({ success: true, message: "Mock file uploaded successfully for local development." })
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ success: true, message: "Mock file uploaded successfully for local development." })
}
