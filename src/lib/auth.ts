import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

export type RequestUser = {
  id: string
  role: "STUDENT" | "ADMIN"
  tier: string
}

export async function getOptionalRequestUser(req: NextRequest): Promise<RequestUser | null> {
  const forwardedUserId = req.headers.get("x-user-id")
  if (forwardedUserId) {
    return {
      id: forwardedUserId,
      role: (req.headers.get("x-user-role") as RequestUser["role"]) ?? "STUDENT",
      tier: req.headers.get("x-user-tier") ?? "FREE",
    }
  }

  const token = req.headers.get("Authorization")?.split(" ")[1]
  if (!token || !process.env.JWT_SECRET) return null

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    if (!payload.sub) return null

    return {
      id: payload.sub as string,
      role: (payload.role as RequestUser["role"]) ?? "STUDENT",
      tier: (payload.tier as string) ?? "FREE",
    }
  } catch {
    return null
  }
}

export async function requireRequestUser(req: NextRequest) {
  const user = await getOptionalRequestUser(req)
  if (!user) throw new Error("Authentication required.")
  return user
}

export async function requireAdminUser(req: NextRequest) {
  const user = await requireRequestUser(req)
  if (user.role !== "ADMIN") throw new Error("Access denied. Admin role required.")
  return user
}
