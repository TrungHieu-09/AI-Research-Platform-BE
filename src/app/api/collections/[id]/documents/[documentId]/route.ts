import { NextRequest, NextResponse } from "next/server"
import { removeDocumentFromCollection } from "@/lib/services/collection-service"

export async function DELETE(req: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const result = await removeDocumentFromCollection(params.id, params.documentId, userId)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    const status = err.message === "Collection not found." ? 404 : err.message === "Document not found in collection." ? 404 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}
