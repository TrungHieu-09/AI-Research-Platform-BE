import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireBearerUser } from "@/lib/request-auth"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireBearerUser(req)

    const body: unknown = await req.json()

    if (
      typeof body !== "object" ||
      body === null ||
      !("currentPassword" in body) ||
      !("newPassword" in body) ||
      typeof (body as any).currentPassword !== "string" ||
      typeof (body as any).newPassword !== "string"
    ) {
      return NextResponse.json(
        { error: "currentPassword và newPassword là bắt buộc." },
        { status: 400 },
      )
    }

    const { currentPassword, newPassword } = body as {
      currentPassword: string
      newPassword: string
    }

    if (newPassword.trim().length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có ít nhất 6 ký tự." },
        { status: 400 },
      )
    }

    // Fetch user with password hash
    const user = await db.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, passwordHash: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy người dùng." }, { status: 404 })
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Tài khoản này không có mật khẩu (đăng nhập bằng OAuth). Vui lòng liên hệ IT Support." },
        { status: 400 },
      )
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isMatch) {
      return NextResponse.json(
        { error: "Mật khẩu hiện tại không đúng." },
        { status: 401 },
      )
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 12)

    await db.user.update({
      where: { id: authUser.id },
      data: { passwordHash: hashed },
    })

    return NextResponse.json(
      { message: "Đổi mật khẩu thành công." },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error("Change password error:", error)

    const message =
      error instanceof Error ? error.message : "Lỗi server khi đổi mật khẩu."

    const status = message === "Authentication required." ? 401 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
