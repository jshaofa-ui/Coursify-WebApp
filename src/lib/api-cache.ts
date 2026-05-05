import { createHash } from "crypto"
import { redis } from "./redis"

// ──────────────────────────────────────────────
// Cache TTL Configuration (in seconds)
// ──────────────────────────────────────────────

export const CACHE_TTL: Record<CacheEndpoint, number> = {
  courses: 14400,        // 4 hours - course listings change infrequently
  course_detail: 7200,   // 2 hours - individual course details
  departments: 86400,    // 24 hours - departments rarely change
  subjects: 86400,       // 24 hours - subjects rarely change
  comments: 3600,        // 1 hour - comments change more frequently
  distributions: 14400,  // 4 hours - grade distributions
  stats: 3600,           // 1 hour - statistics
  access_status: 300,    // 5 minutes - user access status (needs freshness)
  academic_profile: 600, // 10 minutes - user profile data
  uploads: 600,          // 10 minutes - upload history
  queens_answers: 86400, // 24 hours - cached AI answers
  issues: 300,           // 5 minutes - GitHub issues
  user_count: 3600,      // 1 hour - public stats
}

export type CacheEndpoint =
  | "courses"
  | "course_detail"
  | "departments"
  | "subjects"
  | "comments"
  | "distributions"
  | "stats"
  | "access_status"
  | "academic_profile"
  | "uploads"
  | "queens_answers"
  | "issues"
  | "user_count"

// ──────────────────────────────────────────────
// Cache Key Generation
// ──────────────────────────────────────────────

/**
 * Generate a stable cache key from endpoint and parameters
 */
export function getCacheKey(endpoint: CacheEndpoint, params: Record<string, unknown> = {}): string {
  const paramHash = createHash("sha256")
    .update(JSON.stringify(params))
    .digest("hex")
    .slice(0, 16)
  return `cache:${endpoint}:${paramHash}`
}

/**
 * Generate a cache key for a specific resource by ID
 */
export function getResourceCacheKey(endpoint: CacheEndpoint, id: string): string {
  return `cache:${endpoint}:${id}`
}

// ──────────────────────────────────────────────
// Cached Get/Set
// ──────────────────────────────────────────────

/**
 * Get a cached value, or compute and cache it if not found
 */
export async function cachedGet<T>(
  endpoint: CacheEndpoint,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  customTtl?: number,
): Promise<{ data: T; cached: boolean }> {
  const key = getCacheKey(endpoint, params)
  const ttl = customTtl ?? CACHE_TTL[endpoint]

  // Try cache first
  const cached = await redis.get<T>(key)
  if (cached) {
    return { data: cached, cached: true }
  }

  // Fetch fresh data
  const data = await fetcher()

  // Cache the result
  await redis.set(key, data, { ex: ttl })

  return { data, cached: false }
}

/**
 * Get a cached value by resource key
 */
export async function cachedGetById<T>(
  endpoint: CacheEndpoint,
  id: string,
  fetcher: () => Promise<T>,
  customTtl?: number,
): Promise<{ data: T; cached: boolean }> {
  const key = getResourceCacheKey(endpoint, id)
  const ttl = customTtl ?? CACHE_TTL[endpoint]

  const cached = await redis.get<T>(key)
  if (cached) {
    return { data: cached, cached: true }
  }

  const data = await fetcher()
  await redis.set(key, data, { ex: ttl })

  return { data, cached: false }
}

// ──────────────────────────────────────────────
// Cache Invalidation
// ──────────────────────────────────────────────

/**
 * Invalidate all cache entries for an endpoint
 */
export async function invalidateEndpoint(endpoint: CacheEndpoint): Promise<void> {
  await redis.delPattern(`cache:${endpoint}:*`)
}

/**
 * Invalidate a specific resource cache entry
 */
export async function invalidateResource(endpoint: CacheEndpoint, id: string): Promise<void> {
  await redis.del(getResourceCacheKey(endpoint, id))
}

/**
 * Invalidate all cache entries (use with caution)
 */
export async function invalidateAll(): Promise<void> {
  await redis.delPattern("cache:*")
}

// ──────────────────────────────────────────────
// Cache Stats
// ──────────────────────────────────────────────

export type CacheStats = {
  hits: number
  misses: number
  hitRate: number
  totalKeys: number
}

let _stats = { hits: 0, misses: 0 }

export function recordCacheHit(): void {
  _stats.hits++
}

export function recordCacheMiss(): void {
  _stats.misses++
}

export function getCacheStats(): CacheStats {
  const total = _stats.hits + _stats.misses
  return {
    hits: _stats.hits,
    misses: _stats.misses,
    hitRate: total > 0 ? Math.round((_stats.hits / total) * 100) : 0,
    totalKeys: 0, // Would require SCAN to count
  }
}

export function resetCacheStats(): void {
  _stats = { hits: 0, misses: 0 }
}
