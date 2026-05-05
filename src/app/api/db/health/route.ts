import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedSupabaseFromRequest } from "@/app/api/_lib/authenticated-supabase"
import { checkDatabaseHealth, getDatabaseStats, formatBytes } from "@/lib/db-health"
import { successResponse, errorResponse, withTiming } from "@/lib/api-response"

// ── GET /api/db/health ──────────────────────────────────────────────────
// Returns comprehensive database health status.
// Protected: requires authenticated Supabase user.

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabaseFromRequest(request)

  if (!auth.ok && auth.reason === "server_configuration") {
    return errorResponse("Server configuration error", "service_unavailable", { status: 500 })
  }
  if (!auth.ok && auth.reason === "missing_token") {
    return errorResponse("Unauthorized", "unauthorized", { status: 401 })
  }
  if (!auth.ok && auth.reason === "forbidden_domain") {
    return errorResponse(auth.error, "forbidden", { status: 403 })
  }
  if (!auth.ok) {
    return errorResponse("Authentication failed", "unauthorized", { status: 401 })
  }

  // Parse query params
  const url = new URL(request.url)
  const includeStats = url.searchParams.get("stats") === "true"
  const includeTables = url.searchParams.get("tables") === "true"

  try {
    const { result: health, durationMs } = await withTiming(() => checkDatabaseHealth())

    // Build response
    const response: Record<string, unknown> = {
      status: health.status,
      connection: health.connection,
      migrationStatus: health.migrationStatus,
      cacheHitRate: health.cacheHitRate,
      timestamp: health.timestamp,
      meta: {
        durationMs,
        version: "1.0.0",
      },
    }

    if (health.details) {
      response.details = health.details
    }

    // Optionally include table sizes
    if (includeTables) {
      response.tables = health.tables.map((table) => ({
        name: table.tableNameDisplay,
        rowCount: table.rowCount,
        totalSize: formatBytes(table.totalSizeBytes),
        totalSizeBytes: table.totalSizeBytes,
        indexSize: formatBytes(table.indexSizeBytes),
        indexSizeBytes: table.indexSizeBytes,
      }))
    }

    // Optionally include full database stats
    if (includeStats) {
      const { result: stats, durationMs: statsDurationMs } = await withTiming(() =>
        getDatabaseStats(),
      )

      response.databaseStats = {
        tableCounts: stats.tableCounts,
        totalTables: stats.totalTables,
        totalIndexes: stats.totalIndexes,
        totalSize: formatBytes(stats.totalSizeBytes),
        totalSizeBytes: stats.totalSizeBytes,
        indexSize: formatBytes(stats.indexSizeBytes),
        indexSizeBytes: stats.indexSizeBytes,
        cacheHitRate: stats.cacheHitRate,
        connections: stats.connections,
        uptime: stats.uptime,
        statsDurationMs,
      }
    }

    // Include top indexes if tables are included
    if (includeTables && health.indexes.length > 0) {
      response.indexes = health.indexes
        .sort((a, b) => b.sizeBytes - a.sizeBytes)
        .slice(0, 20)
        .map((index) => ({
          name: index.indexName,
          table: index.tableName,
          size: formatBytes(index.sizeBytes),
          sizeBytes: index.sizeBytes,
        }))
    }

    return successResponse(response, {
      cached: false,
      durationMs,
      version: "1.0.0",
    })
  } catch (error) {
    console.error("[db/health] Health check failed:", error)
    return errorResponse(
      "Database health check failed",
      "internal_error",
      {
        status: 500,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
    )
  }
}

// ── HEAD /api/db/health ─────────────────────────────────────────────────
// Lightweight check: just verify the database is reachable.

export async function HEAD(request: NextRequest) {
  const auth = await getAuthenticatedSupabaseFromRequest(request)

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const health = await checkDatabaseHealth()

    if (health.status === "healthy") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "X-DB-Status": "healthy",
          "X-DB-Latency-Ms": String(health.connection.latencyMs),
        },
      })
    }

    return new NextResponse(null, {
      status: 503,
      headers: {
        "X-DB-Status": health.status,
        "X-DB-Latency-Ms": String(health.connection.latencyMs),
      },
    })
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: { "X-DB-Status": "unhealthy" },
    })
  }
}

// ── Method Not Allowed ──────────────────────────────────────────────────

export function POST(): NextResponse {
  return errorResponse("Method not allowed", "method_not_allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD" },
  })
}

export function PUT(): NextResponse {
  return errorResponse("Method not allowed", "method_not_allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD" },
  })
}

export function DELETE(): NextResponse {
  return errorResponse("Method not allowed", "method_not_allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD" },
  })
}
