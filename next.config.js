/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable the default Next.js page/app router pages for a pure API server
  // Keep this config minimal since this project is API-only (no UI pages needed here)
  serverExternalPackages: ["@prisma/client", "bcryptjs"],

  // CORS headers — allow requests from the client (localhost:3000) and any deployed domain
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.FRONTEND_URL ?? "http://localhost:3000" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, x-user-id" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
