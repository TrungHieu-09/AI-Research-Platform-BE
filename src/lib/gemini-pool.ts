import { GoogleGenerativeAI } from "@google/generative-ai"

let keyPool: string[] = []
let currentKeyIndex = 0

function initKeyPool() {
  if (keyPool.length > 0) return
  const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || ""
  keyPool = rawKeys
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
  if (keyPool.length === 0) {
    keyPool = [""]
  }
}

export function getGeminiClient(): GoogleGenerativeAI {
  initKeyPool()
  return new GoogleGenerativeAI(keyPool[currentKeyIndex])
}

export function rotateGeminiKey(): boolean {
  initKeyPool()
  if (keyPool.length <= 1) return false
  currentKeyIndex = (currentKeyIndex + 1) % keyPool.length
  console.log(`[Gemini Pool] Rotated API Key to index #${currentKeyIndex} (out of ${keyPool.length} keys available)`)
  return true
}

export function getKeyCount(): number {
  initKeyPool()
  return keyPool.length
}
