import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireBearerUser } from "@/lib/request-auth"
import { userProfileSelect } from "@/lib/services/user-service"

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireBearerUser(req)

    const user = await db.user.findUnique({
      where: { id: authUser.id },
      select: userProfileSelect,
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user }, { status: 200 })
  } catch (error: any) {
    console.error("Get profile error:", error)
    const status = error.message === "Authentication required." ? 401 : 500
    return NextResponse.json({ error: error.message ?? "Failed to fetch profile." }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await requireBearerUser(req)
    const body = await req.json()
    const { name } = body

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updatedUser = await db.user.update({
      where: { id: authUser.id },
      data: { name },
      select: userProfileSelect,
    })

    return NextResponse.json({ user: updatedUser }, { status: 200 })
  } catch (error: any) {
    console.error("Update profile error:", error)
    const status = error.message === "Authentication required." ? 401 : 500
    return NextResponse.json({ error: error.message ?? "Failed to update profile." }, { status })
  }
}