import { NextRequest, NextResponse } from "next/server"
import { createCollection, getUserCollections } from "@/lib/services/collection-service"
import { CreateCollectionSchema } from "@/lib/validation/collection"

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const collections = await getUserCollections(userId)
    return NextResponse.json(collections, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch collections." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

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
