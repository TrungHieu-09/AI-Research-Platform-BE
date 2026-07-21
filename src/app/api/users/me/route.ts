import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireBearerUser } from "@/lib/request-auth"
import { userProfileSelect } from "@/lib/services/user-service"

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireBearerUser(req)

    let user = await db.user.findUnique({
      where: { id: authUser.id },
      select: userProfileSelect,
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      )
    }

    if (user.tierExpiresAt && user.tierExpiresAt < new Date()) {
      user = await db.user.update({
        where: { id: authUser.id },
        data: {
          tier: "FREE",
          tierExpiresAt: null,
        },
        select: userProfileSelect,
      })
    }

    return NextResponse.json(
      { user },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error("Get profile error:", error)

    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch profile."

    const status =
      message === "Authentication required."
        ? 401
        : 500

    return NextResponse.json(
      { error: message },
      { status },
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await requireBearerUser(req)

    const body: unknown = await req.json()

    if (
      typeof body !== "object" ||
      body === null ||
      !("name" in body) ||
      typeof body.name !== "string" ||
      body.name.trim() === ""
    ) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      )
    }

    const updatedUser = await db.user.update({
      where: { id: authUser.id },
      data: {
        name: body.name.trim(),
      },
      select: userProfileSelect,
    })

    return NextResponse.json(
      { user: updatedUser },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error("Update profile error:", error)

    const message =
      error instanceof Error
        ? error.message
        : "Failed to update profile."

    const status =
      message === "Authentication required."
        ? 401
        : 500

    return NextResponse.json(
      { error: message },
      { status },
    )
  }
}