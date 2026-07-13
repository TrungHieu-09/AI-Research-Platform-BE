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
  { path: "/api/notifications", minRole: "STUDENT" },
  { path: "/api/collections", minRole: "STUDENT" },
  { path: "/api/bookmarks", minRole: "STUDENT" },
  { path: "/api/documents/upload-url", minRole: "STUDENT" },
  { path: "/api/documents", minRole: "STUDENT" },
  { path: "/api/subjects/suggest", minRole: "STUDENT" },
  { path: "/api/collections", minRole: "STUDENT" },
  { path: "/api/ai/chat", minRole: "STUDENT" },
  { path: "/api/ai/limit", minRole: "STUDENT" },
  { path: "/api/payments/checkout", minRole: "STUDENT" },
  { path: "/api/payments/receipts", minRole: "STUDENT" },
  { path: "/api/documents", minRole: "STUDENT" }, // general doc access
  // Admin+ routes
  { path: "/api/documents/moderate", minRole: "ADMIN" },
  // Admin-only routes
  { path: "/api/admin", minRole: "ADMIN" },
  { path: "/api/users", minRole: "ADMIN" },
]

// ──────────────────────────────────────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────────────────────────────────────

export default async function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "*"

  // Handle CORS Preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-user-role",
        "Access-Control-Allow-Credentials": "true",
      },
    })
  }

  const pathname = request.nextUrl.pathname

  // Find the most specific (longest path) matching rule
  const matchedRule = ROUTE_RULES.filter((rule) => pathname.startsWith(rule.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0]

  // No rule matched — allow request through (public routes like /api/auth/*)
  if (!matchedRule) {
    const response = NextResponse.next()
    response.headers.set("Access-Control-Allow-Origin", origin)
    return response
  }

  const token = request.headers.get("Authorization")?.split(" ")[1]

  if (!token) {
    return NextResponse.json(
      { error: "Authentication token required." },
      {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": origin,
        },
      }
    )
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    const userRole = (payload.role as Role) ?? "STUDENT"

    if ((ROLE_HIERARCHY[userRole] ?? 0) < ROLE_HIERARCHY[matchedRule.minRole]) {
      return NextResponse.json(
        { error: `Access denied. Required role: ${matchedRule.minRole}.` },
        {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": origin,
          },
        },
      )
    }

    // Forward resolved identity to route handlers via request headers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-user-id", payload.sub as string)
    requestHeaders.set("x-user-role", userRole)
    requestHeaders.set("x-user-tier", (payload.tier as string) ?? "FREE")

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set("Access-Control-Allow-Origin", origin)
    return response
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired session token." },
      {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": origin,
        },
      }
    )
  }
}

export const config = {
  // Apply middleware to all API routes EXCEPT auth and public routes
  matcher: ["/api/((?!auth|public).*)"],
}
