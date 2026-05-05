import { createHash } from "crypto"
import { redis } from "@/lib/redis"

const CACHE_TTL_SECONDS = 60 * 60 * 24 // 24 hours
const CACHE_KEY_PREFIX = "qa:cache"

function questionHash(question: string): string {
  return createHash("sha256").update(question.trim().toLowerCase()).digest("hex").slice(0, 16)
}

function cacheKey(hash: string): string {
  return `${CACHE_KEY_PREFIX}:${hash}`
}

export type CacheResult =
  | { hit: true; answer: string }
  | { hit: false }

/**
 * Retrieve a cached answer for a given question.
 * Normalizes the question before hashing to improve cache hit rate.
 */
export async function getCachedAnswer(question: string): Promise<CacheResult> {
  const hash = questionHash(question)
  const cached = await redis.get<string>(cacheKey(hash))

  if (cached != null) {
    return { hit: true, answer: cached }
  }

  return { hit: false }
}

/**
 * Store an AI-generated answer in Redis, keyed by the question hash.
 * The TTL is 24 hours from the time of storage.
 */
export async function setCachedAnswer(question: string, answer: string): Promise<void> {
  const hash = questionHash(question)
  await redis.set(cacheKey(hash), answer, { ex: CACHE_TTL_SECONDS })
}

/**
 * Increment cache hit or miss counters for metrics.
 * These counters are used by the metrics module to compute hit rates.
 */
export async function recordCacheHit(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  await redis.incr(`qa:metrics:cache_hits:${today}`)
}

export async function recordCacheMiss(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  await redis.incr(`qa:metrics:cache_misses:${today}`)
}
