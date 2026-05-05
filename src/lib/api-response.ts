import { NextResponse } from "next/server"

// ──────────────────────────────────────────────
// Standardized API Response Types
// ──────────────────────────────────────────────

export type ApiResponse<T = unknown> = {
  data: T
  meta?: ResponseMeta
}

export type ErrorResponse = {
  error: string
  code: ErrorCode
  details?: Record<string, unknown>
  docs?: string
}

export type PaginatedResponse<T = unknown> = {
  data: T[]
  pagination: PaginationMeta
}

export type ResponseMeta = {
  cached?: boolean
  durationMs?: number
  version?: string
}

export type PaginationMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ──────────────────────────────────────────────
// Error Codes (machine-readable)
// ──────────────────────────────────────────────

export type ErrorCode =
  // Client errors (4xx)
  | "bad_request"           // 400 - Invalid input
  | "unauthorized"          // 401 - Missing/invalid auth
  | "forbidden"             // 403 - Insufficient permissions
  | "not_found"             // 404 - Resource not found
  | "method_not_allowed"    // 405 - HTTP method not supported
  | "rate_limit_exceeded"   // 429 - Too many requests
  | "entitlement_required"  // 403 - Feature requires contribution
  // Server errors (5xx)
  | "internal_error"        // 500 - Unexpected server error
  | "service_unavailable"   // 503 - Dependency failure
  | "gateway_timeout"       // 504 - Upstream timeout

// ──────────────────────────────────────────────
// Response Helpers
// ──────────────────────────────────────────────

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data: T,
  meta?: ResponseMeta,
  init?: ResponseInit,
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = { data }
  if (meta) {
    response.meta = meta
  }
  return NextResponse.json(response, { status: 200, ...init })
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  code: ErrorCode,
  options?: {
    status?: number
    details?: Record<string, unknown>
    docs?: string
    headers?: Record<string, string>
  },
): NextResponse<ErrorResponse> {
  const status = options?.status ?? 500
  const response: ErrorResponse = { error: message, code }
  if (options?.details) response.details = options.details
  if (options?.docs) response.docs = options.docs

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options?.headers,
  }

  return NextResponse.json(response, { status, headers })
}

/**
 * Create a standardized paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  meta?: ResponseMeta,
): NextResponse<PaginatedResponse<T>> {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const response: PaginatedResponse<T> = {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
  if (meta) {
    response.meta = meta
  }
  return NextResponse.json(response, { status: 200 })
}

/**
 * Create a 405 Method Not Allowed response
 */
export function methodNotAllowedResponse(allowedMethods: string[]): NextResponse<ErrorResponse> {
  return errorResponse("Method not allowed", "method_not_allowed", {
    status: 405,
    headers: { Allow: allowedMethods.join(", ") },
  })
}

/**
 * Create a 429 Rate Limit Exceeded response
 */
export function rateLimitResponse(
  retryAfterSeconds: number,
  limit: number,
): NextResponse<ErrorResponse> {
  return errorResponse("Too many requests. Please try again later.", "rate_limit_exceeded", {
    status: 429,
    details: { retry_after: retryAfterSeconds, limit },
    headers: { "Retry-After": String(retryAfterSeconds) },
  })
}

// ──────────────────────────────────────────────
// Timing Helper
// ──────────────────────────────────────────────

export function withTiming<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  return fn().then((result) => ({
    result,
    durationMs: Math.round(performance.now() - start),
  }))
}
