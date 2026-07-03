import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

// ──────────────────────────────────────────────────────────────────────────────
// RBAC configuration
// ──────────────────────────────────────────────────────────────────────────────

const ROLE_HIERARCHY = {
  STUDENT: 1,
  ADMIN: 2,
} as const

type Role = keyof typeof ROLE_HIERARCHY

const ROUTE_RULES: { path: string; minRole: Role }[] = [
  { path: "/api/documents/upload-url", minRole: "STUDENT" },
  { path: "/api/documents", minRole: "STUDENT" },
  { path: "/api/subjects/suggest", minRole: "STUDENT" },
  { path: "/api/ai/chat", minRole: "STUDENT" },
  { path: "/api/ai/limit", minRole: "STUDENT" },
  { path: "/api/payments/checkout", minRole: "STUDENT" },
  { path: "/api/documents", minRole: "STUDENT" }, // general doc access
  // Admin+ routes
  { path: "/api/documents/moderate", minRole: "ADMIN" },
  // Admin-only routes
  { path: "/api/subjects", minRole: "ADMIN" },
  { path: "/api/users", minRole: "ADMIN" },
  { path: "/api/payments/webhook", minRole: "ADMIN" },
]

// ──────────────────────────────────────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Find the most specific (longest path) matching rule
  const matchedRule = ROUTE_RULES.filter((rule) => pathname.startsWith(rule.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0]

  // No rule matched — allow request through (public routes like /api/auth/*)
  if (!matchedRule) return NextResponse.next()

  const token = request.headers.get("Authorization")?.split(" ")[1]

  if (!token) {
    return NextResponse.json({ error: "Authentication token required." }, { status: 401 })
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    const userRole = (payload.role as Role) ?? "STUDENT"

    if ((ROLE_HIERARCHY[userRole] ?? 0) < ROLE_HIERARCHY[matchedRule.minRole]) {
      return NextResponse.json(
        { error: `Access denied. Required role: ${matchedRule.minRole}.` },
        { status: 403 },
      )
    }

    // Forward resolved identity to route handlers via request headers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-user-id", payload.sub as string)
    requestHeaders.set("x-user-role", userRole)
    requestHeaders.set("x-user-tier", (payload.tier as string) ?? "FREE")

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    return NextResponse.json({ error: "Invalid or expired session token." }, { status: 401 })
  }
}

export const config = {
  // Apply middleware to all API routes EXCEPT auth and public routes
  matcher: ["/api/((?!auth|public).*)"],
}
