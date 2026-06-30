/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable the default Next.js page/app router pages for a pure API server
  // Keep this config minimal since this project is API-only (no UI pages needed here)
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
}

module.exports = nextConfig
