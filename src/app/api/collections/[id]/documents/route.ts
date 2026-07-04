import { NextRequest, NextResponse } from "next/server"
import { addDocumentToCollection } from "@/lib/services/collection-service"
import { AddDocumentToCollectionSchema } from "@/lib/validation/collection"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const body = await req.json()
    const parsed = AddDocumentToCollectionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const relation = await addDocumentToCollection(params.id, userId, parsed.data)
    return NextResponse.json(relation, { status: 200 })
  } catch (err: any) {
    const status = err.message === "Collection not found." ? 404 : err.message === "Document not found." ? 404 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}
