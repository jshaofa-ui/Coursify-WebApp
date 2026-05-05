import "server-only";

import { createHash } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getRequiredRedisClient } from "@/lib/redis";

export type RateLimitResult =
  | {
      ok: true;
      limit: number;
      remaining: number;
      resetSeconds: number;
    }
  | {
      ok: false;
      reason: "rate_limit";
      limit: number;
      resetSeconds: number;
    }
  | {
      ok: false;
      reason: "dependency_failure";
      error: string;
    };

export type RateLimitOptions = {
  keyPrefix: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

function hashIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier).digest("hex").slice(0, 32);
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return "unknown";
}

export async function checkRateLimit({
  keyPrefix,
  identifier,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const client = getRequiredRedisClient();
    const key = `rate:${keyPrefix}:${hashIdentifier(identifier)}`;
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, windowSeconds);
    }

    if (count > limit) {
      return {
        ok: false,
        reason: "rate_limit",
        limit,
        resetSeconds: windowSeconds,
      };
    }

    return {
      ok: true,
      limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: windowSeconds,
    };
  } catch (error) {
    console.error(`[rate-limit] ${keyPrefix} failed:`, error);
    return {
      ok: false,
      reason: "dependency_failure",
      error: "Rate limiting is temporarily unavailable.",
    };
  }
}

// ──────────────────────────────────────────────
// Per-Endpoint Rate Limit Configurations
// ──────────────────────────────────────────────

export type EndpointRateLimits = {
  burst: { limit: number; windowSeconds: number };
  daily?: { limit: number; windowSeconds: number };
};

export const ENDPOINT_RATE_LIMITS: Record<string, EndpointRateLimits> = {
  "courses": {
    burst: { limit: 60, windowSeconds: 60 },
    daily: { limit: 1000, windowSeconds: 86400 },
  },
  "courses-detail": {
    burst: { limit: 120, windowSeconds: 60 },
    daily: { limit: 2000, windowSeconds: 86400 },
  },
  "departments": {
    burst: { limit: 60, windowSeconds: 60 },
    daily: { limit: 500, windowSeconds: 86400 },
  },
  "subjects": {
    burst: { limit: 60, windowSeconds: 60 },
    daily: { limit: 500, windowSeconds: 86400 },
  },
  "comments": {
    burst: { limit: 30, windowSeconds: 60 },
    daily: { limit: 500, windowSeconds: 86400 },
  },
  "upload-distribution": {
    burst: { limit: 5, windowSeconds: 60 },
    daily: { limit: 50, windowSeconds: 86400 },
  },
  "queens-answers:chat": {
    burst: { limit: 20, windowSeconds: 60 },
    daily: { limit: 100, windowSeconds: 86400 },
  },
  "me": {
    burst: { limit: 30, windowSeconds: 60 },
    daily: { limit: 500, windowSeconds: 86400 },
  },
  "stats": {
    burst: { limit: 60, windowSeconds: 60 },
    daily: { limit: 1000, windowSeconds: 86400 },
  },
  "issues": {
    burst: { limit: 60, windowSeconds: 60 },
    daily: { limit: 500, windowSeconds: 86400 },
  },
};

/**
 * Get rate limit config for an endpoint
 */
export function getEndpointRateLimits(endpoint: string): EndpointRateLimits {
  return ENDPOINT_RATE_LIMITS[endpoint] ?? {
    burst: { limit: 30, windowSeconds: 60 },
    daily: { limit: 500, windowSeconds: 86400 },
  };
}

// ──────────────────────────────────────────────
// Rate Limit Headers
// ──────────────────────────────────────────────

/**
 * Add rate limit headers to a response
 */
export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult & { ok: true },
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.resetSeconds));
  return response;
}

/**
 * Add rate limit headers to a 429 response
 */
export function withRateLimitErrorHeaders(
  response: NextResponse,
  result: RateLimitResult & { ok: false; reason: "rate_limit" },
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", "0");
  response.headers.set("X-RateLimit-Reset", String(result.resetSeconds));
  response.headers.set("Retry-After", String(result.resetSeconds));
  return response;
}
