import type { SupabaseClient } from "@supabase/supabase-js"
import { redis } from "@/lib/redis"

export const QA_TIER_LIMITS = { low: 2, mid: 3, high: 4 } as const

export type QAUsage = {
  dailyLimit: number
  used: number
  remaining: number
}

export type QAConsumeResult =
  | { ok: true; usage: QAUsage }
  | { ok: false; reason: "rate_limit"; usage: QAUsage }
  | { ok: false; reason: "dependency_failure"; dependency: "supabase"; error: string }

export type QAReadUsageResult =
  | { ok: true; usage: QAUsage }
  | { ok: false; reason: "dependency_failure"; dependency: "supabase"; error: string }

// ── Sliding Window Burst Limiting ────────────────────────────────────────

export const QA_BURST_LIMIT = 10 // max requests per minute
export const QA_BURST_WINDOW_SECONDS = 60

export type BurstLimitResult =
  | { ok: true; remaining: number; resetSeconds: number }
  | { ok: false; reason: "burst_rate_limit"; retryAfterSeconds: number; limit: number }
  | { ok: false; reason: "dependency_failure"; error: string }

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function dependencyFailure(error: unknown) {
  console.error("[queens-answers/rate-limit] supabase failure:", error)
  return {
    ok: false as const,
    reason: "dependency_failure" as const,
    dependency: "supabase" as const,
    error: "Queen's Answers quota is temporarily unavailable.",
  }
}

/**
 * Check the sliding window burst rate limit for a user.
 * Allows QA_BURST_LIMIT requests per QA_BURST_WINDOW_SECONDS seconds.
 *
 * Uses a sorted-set-like approach with Redis: each request is stored with a
 * timestamp, and we count requests within the current window.
 */
export async function checkBurstRateLimit(
  userId: string,
): Promise<BurstLimitResult> {
  try {
    const key = `qa:burst:${userId}`
    const now = Date.now()
    const minuteBucket = Math.floor(now / 1000 / QA_BURST_WINDOW_SECONDS)
    const bucketKey = `${key}:${minuteBucket}`

    const count = await redis.incr(bucketKey)
    if (count === null) {
      return {
        ok: false,
        reason: "dependency_failure",
        error: "Burst rate limiting is temporarily unavailable.",
      }
    }

    if (count === 1) {
      await redis.expire(bucketKey, QA_BURST_WINDOW_SECONDS)
    }

    if (count > QA_BURST_LIMIT) {
      const ttl = await redis.ttl(bucketKey)
      const retryAfter = Math.max(1, ttl ?? QA_BURST_WINDOW_SECONDS)
      return {
        ok: false,
        reason: "burst_rate_limit",
        retryAfterSeconds: retryAfter,
        limit: QA_BURST_LIMIT,
      }
    }

    return {
      ok: true,
      remaining: Math.max(0, QA_BURST_LIMIT - count),
      resetSeconds: QA_BURST_WINDOW_SECONDS,
    }
  } catch (error) {
    console.error("[queens-answers/rate-limit] burst check failed:", error)
    return {
      ok: false,
      reason: "dependency_failure",
      error: "Burst rate limiting is temporarily unavailable.",
    }
  }
}

/**
 * Format a user-friendly burst rate limit error message with retry-after hint.
 */
export function formatBurstLimitMessage(retryAfterSeconds: number): string {
  const seconds = Math.ceil(retryAfterSeconds)
  if (seconds <= 5) {
    return `Slow down! You're sending requests too quickly. Please wait ${seconds}s before trying again.`
  }
  if (seconds <= 30) {
    return `Too many requests in the last minute. Please wait ${seconds}s before sending another question.`
  }
  return `Rate limit exceeded. Please wait ${seconds}s before trying again.`
}

// ── Daily Limit (Existing) ──────────────────────────────────────────────

export function tierLimitForSemesters(semesters: number | null | undefined): number {
  if (semesters == null || semesters <= 1) return QA_TIER_LIMITS.low
  if (semesters <= 4) return QA_TIER_LIMITS.mid
  return QA_TIER_LIMITS.high
}

export async function readUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  semesters: number | null | undefined,
): Promise<QAReadUsageResult> {
  try {
    const dailyLimit = tierLimitForSemesters(semesters)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("qa_daily_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("date", todayIso())
      .single()

    // PGRST116 = no rows found — user hasn't asked anything today
    if (error && error.code !== "PGRST116") {
      return dependencyFailure(error)
    }

    const used: number = data?.count ?? 0
    return {
      ok: true,
      usage: {
        dailyLimit,
        used,
        remaining: Math.max(0, dailyLimit - used),
      },
    }
  } catch (error) {
    return dependencyFailure(error)
  }
}

export async function consumeQuestion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  semesters: number | null | undefined,
): Promise<QAConsumeResult> {
  try {
    const dailyLimit = tierLimitForSemesters(semesters)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("qa_consume_question", {
      p_user_id: userId,
      p_daily_limit: dailyLimit,
    })

    if (error) {
      return dependencyFailure(error)
    }

    const result = data as { new_count: number; allowed: boolean }
    const used = result.new_count

    if (!result.allowed) {
      return {
        ok: false,
        reason: "rate_limit",
        usage: { dailyLimit, used, remaining: 0 },
      }
    }

    return {
      ok: true,
      usage: {
        dailyLimit,
        used,
        remaining: Math.max(0, dailyLimit - used),
      },
    }
  } catch (error) {
    return dependencyFailure(error)
  }
}
