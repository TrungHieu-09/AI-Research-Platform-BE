/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable the default Next.js page/app router pages for a pure API server
  // Keep this config minimal since this project is API-only (no UI pages needed here)
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdf-parse", "@google/generative-ai"],

  // CORS headers — allow requests from the client (localhost:3000) and any deployed domain
  async headers() {
    const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000"
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: clientOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ]
  },
}

module.exports = nextConfig

