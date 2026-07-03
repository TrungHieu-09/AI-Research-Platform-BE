import { NextResponse } from "next/server"

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: API Health Check
 *     description: Returns the status of the Lumis Backend API
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 service:
 *                   type: string
 *                   example: "Lumis Backend API"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Lumis Backend API",
    timestamp: new Date().toISOString(),
  })
}
