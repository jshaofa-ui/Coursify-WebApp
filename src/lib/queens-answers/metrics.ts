import { redis } from "@/lib/redis"

const METRICS_KEY_PREFIX = "qa:metrics"

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Types ────────────────────────────────────────────────────────────────

export type UserMetricsSnapshot = {
  dailyQuestions: number
  weeklyQuestions: number
  monthlyQuestions: number
  avgResponseMs: number
  cacheHitRate: number
}

// ── Question Count Tracking ──────────────────────────────────────────────

/**
 * Increment the daily question count for a user.
 * Key format: qa:metrics:questions:daily:{date}:{userId}
 */
export async function incrementQuestionCount(userId: string): Promise<void> {
  const today = todayIso()
  const dailyKey = `${METRICS_KEY_PREFIX}:questions:daily:${today}:${userId}`
  await redis.incr(dailyKey)
  await redis.expire(dailyKey, 60 * 60 * 24 * 32) // keep for 32 days

  // Also increment aggregate daily counter
  const aggregateKey = `${METRICS_KEY_PREFIX}:questions:daily:${today}`
  await redis.incr(aggregateKey)
  await redis.expire(aggregateKey, 60 * 60 * 24 * 32)
}

// ── Response Time Tracking ───────────────────────────────────────────────

/**
 * Record the response time (in ms) for a QA request.
 * Uses a Redis hyperloglog-like approach: stores sum and count to compute average.
 */
export async function recordResponseTime(ms: number): Promise<void> {
  const today = todayIso()
  const sumKey = `${METRICS_KEY_PREFIX}:response_time_sum:${today}`
  const countKey = `${METRICS_KEY_PREFIX}:response_time_count:${today}`

  // Use a Lua-like approach: incrbyfloat for sum, incr for count
  // Since our redis wrapper only has incr, we store the sum as an integer
  const currentSum = (await redis.get<number>(sumKey)) ?? 0
  await redis.set(sumKey, currentSum + ms, { ex: 60 * 60 * 24 * 32 })

  await redis.incr(countKey)
  await redis.expire(countKey, 60 * 60 * 24 * 32)
}

/**
 * Get the average response time for a given date.
 */
export async function getAverageResponseTime(date?: string): Promise<number> {
  const targetDate = date ?? todayIso()
  const sumKey = `${METRICS_KEY_PREFIX}:response_time_sum:${targetDate}`
  const countKey = `${METRICS_KEY_PREFIX}:response_time_count:${targetDate}`

  const [sum, count] = await Promise.all([
    redis.get<number>(sumKey),
    redis.get<number>(countKey),
  ])

  if (!count || count === 0) return 0
  return Math.round((sum ?? 0) / count)
}

// ── Cache Hit Rate Tracking ──────────────────────────────────────────────

/**
 * Get the cache hit rate for a given date.
 * Returns a value between 0 and 1 (0 = no hits, 1 = all hits).
 */
export async function getCacheHitRate(date?: string): Promise<number> {
  const targetDate = date ?? todayIso()
  const hitsKey = `${METRICS_KEY_PREFIX}:cache_hits:${targetDate}`
  const missesKey = `${METRICS_KEY_PREFIX}:cache_misses:${targetDate}`

  const [hits, misses] = await Promise.all([
    redis.get<number>(hitsKey),
    redis.get<number>(missesKey),
  ])

  const total = (hits ?? 0) + (misses ?? 0)
  if (total === 0) return 0
  return Math.round(((hits ?? 0) / total) * 10000) / 10000 // 4 decimal places
}

// ── User Metrics Snapshot ────────────────────────────────────────────────

/**
 * Compute a metrics snapshot for a specific user.
 * Aggregates daily, weekly, and monthly question counts along with system-wide stats.
 */
export async function getUserMetrics(userId: string): Promise<UserMetricsSnapshot> {
  const today = todayIso()

  // Count questions for the user over different periods
  let dailyQuestions = 0
  let weeklyQuestions = 0
  let monthlyQuestions = 0

  // Daily: just today
  const dailyKey = `${METRICS_KEY_PREFIX}:questions:daily:${today}:${userId}`
  const dailyVal = await redis.get<number>(dailyKey)
  dailyQuestions = dailyVal ?? 0

  // Weekly: sum of last 7 days
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const key = `${METRICS_KEY_PREFIX}:questions:daily:${d}:${userId}`
    const val = await redis.get<number>(key)
    weeklyQuestions += val ?? 0
  }

  // Monthly: sum of last 30 days
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const key = `${METRICS_KEY_PREFIX}:questions:daily:${d}:${userId}`
    const val = await redis.get<number>(key)
    monthlyQuestions += val ?? 0
  }

  const [avgResponseMs, cacheHitRate] = await Promise.all([
    getAverageResponseTime(),
    getCacheHitRate(),
  ])

  return {
    dailyQuestions,
    weeklyQuestions,
    monthlyQuestions,
    avgResponseMs,
    cacheHitRate,
  }
}
