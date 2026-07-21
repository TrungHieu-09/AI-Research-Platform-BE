import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

export type RequestUser = {
  id: string
  role: "STUDENT" | "ADMIN"
  tier: string
}

export async function requireBearerUser(req: NextRequest) {
  const token = req.headers.get("Authorization")?.split(" ")[1]
  if (!token || !process.env.JWT_SECRET) throw new Error("Authentication required.")

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    if (!payload.sub) throw new Error("Authentication required.")

    return {
      id: payload.sub as string,
      role: (payload.role as RequestUser["role"]) ?? "STUDENT",
      tier: (payload.tier as string) ?? "FREE",
    }
  } catch {
    throw new Error("Authentication required.")
  }
}

export async function requireBearerAdmin(req: NextRequest) {
  const user = await requireBearerUser(req)
  if (user.role !== "ADMIN") throw new Error("Access denied. Admin role required.")
  return user
}