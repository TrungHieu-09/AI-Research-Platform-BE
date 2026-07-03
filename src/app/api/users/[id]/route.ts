import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user status or role (Admin only)
 *     description: Allow admin to suspend/activate accounts or elevate roles
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [STUDENT, ADMIN]
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED]
 *               tier:
 *                 type: string
 *                 enum: [FREE, PRO]
 *     responses:
 *       200:
 *         description: User updated successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminRole = req.headers.get("x-user-role")
    const adminId = req.headers.get("x-user-id")

    if (adminRole !== "ADMIN" || !adminId) {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const body = await req.json()
    const { role, status, tier } = body

    const existingUser = await db.user.findUnique({ where: { id: params.id } })
    if (!existingUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    // Prevent admin from suspending or demoting themselves
    if (params.id === adminId && (status === "SUSPENDED" || role === "STUDENT")) {
      return NextResponse.json({ error: "You cannot suspend or demote your own admin account." }, { status: 400 })
    }

    const updateData: any = {}
    if (role && (role === "STUDENT" || role === "ADMIN")) updateData.role = role
    if (status && (status === "ACTIVE" || status === "SUSPENDED")) updateData.status = status
    if (tier && (tier === "FREE" || tier === "PRO")) updateData.tier = tier

    const updatedUser = await db.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        tier: true,
        updatedAt: true
      }
    })

    // Create Audit Log
    await db.auditLog.create({
      data: {
        userId: adminId,
        action: `UPDATE_USER_${Object.keys(updateData).join("_").toUpperCase()}`,
        targetEntity: "users",
        targetId: params.id,
        ipAddress: req.headers.get("x-forwarded-for") ?? req.ip
      }
    })

    return NextResponse.json({ user: updatedUser }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to update user." }, { status: 500 })
  }
}
