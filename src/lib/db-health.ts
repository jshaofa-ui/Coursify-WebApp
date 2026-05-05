import { getSupabaseServerClient } from "./supabase/server"

// ── Types ────────────────────────────────────────────────────────────────

export type DatabaseHealthStatus = "healthy" | "degraded" | "unhealthy"

export type TableSizeInfo = {
  tableName: string
  rowCount: number
  totalSizeBytes: number
  indexSizeBytes: number
  tableNameDisplay: string
}

export type IndexSizeInfo = {
  indexName: string
  tableName: string
  sizeBytes: number
}

export type CacheHitRate = {
  blksHit: number
  blksRead: number
  hitRate: number
}

export type DatabaseHealthResult = {
  status: DatabaseHealthStatus
  connection: {
    ok: boolean
    latencyMs: number
    error?: string
  }
  tables: TableSizeInfo[]
  indexes: IndexSizeInfo[]
  cacheHitRate: CacheHitRate
  migrationStatus: {
    totalMigrations: number
    appliedMigrations: number
    pendingMigrations: string[]
    ok: boolean
  }
  timestamp: string
  details?: string
}

export type DatabaseStats = {
  tableCounts: Record<string, number>
  totalTables: number
  totalIndexes: number
  totalSizeBytes: number
  indexSizeBytes: number
  cacheHitRate: number
  connections: {
    active: number
    max: number
    utilization: number
  }
  uptime: string
}

export type MigrationStatus = {
  totalMigrations: number
  appliedMigrations: number
  pendingMigrations: string[]
  ok: boolean
}

// ── Known Tables ─────────────────────────────────────────────────────────

const KNOWN_TABLES = [
  "courses",
  "course_distributions",
  "rag_chunks",
  "user_profiles",
  "distribution_uploads",
  "qa_daily_usage",
  "api_cache_metadata",
  "api_usage_log",
  "queens_answers_sessions",
  "queens_answers_messages",
] as const

// ── Known Migration Files ────────────────────────────────────────────────

const KNOWN_MIGRATIONS = [
  "20260405190000_baseline_schema.sql",
  "20260416000000_add_semester_zero_locked.sql",
  "20260427000000_distribution_uploads_unique_processed.sql",
  "20260429000000_add_qa_daily_usage.sql",
  "20260505000000_api_enhancements.sql",
]

// ── Database Health Check ───────────────────────────────────────────────

/**
 * Check overall database health including connection, latency, table sizes,
 * index sizes, and cache hit rates.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  const result: DatabaseHealthResult = {
    status: "healthy",
    connection: { ok: false, latencyMs: 0 },
    tables: [],
    indexes: [],
    cacheHitRate: { blksHit: 0, blksRead: 0, hitRate: 0 },
    migrationStatus: {
      totalMigrations: KNOWN_MIGRATIONS.length,
      appliedMigrations: 0,
      pendingMigrations: [],
      ok: false,
    },
    timestamp: new Date().toISOString(),
  }

  try {
    const supabase = getSupabaseServerClient()

    // 1. Connection test with latency measurement
    const start = performance.now()
    const { error: connError } = await supabase.from("courses").select("id").limit(1)
    const latencyMs = Math.round(performance.now() - start)

    result.connection = {
      ok: !connError,
      latencyMs,
      error: connError?.message,
    }

    if (connError) {
      result.status = "unhealthy"
      result.details = `Connection failed: ${connError.message}`
      return result
    }

    // 2. Table sizes
    result.tables = await getTableSizes(supabase)

    // 3. Index sizes
    result.indexes = await getIndexSizes(supabase)

    // 4. Cache hit rates
    result.cacheHitRate = await getCacheHitRate(supabase)

    // 5. Migration status
    result.migrationStatus = await checkMigrations(supabase)

    // Determine overall status
    if (!result.migrationStatus.ok) {
      result.status = "degraded"
      result.details = `${result.migrationStatus.pendingMigrations.length} pending migration(s)`
    }

    const totalRows = result.tables.reduce((sum, t) => sum + t.rowCount, 0)
    if (totalRows === 0) {
      result.status = "degraded"
      result.details = "All tables are empty"
    }

    if (result.connection.latencyMs > 1000) {
      result.status = "degraded"
      result.details = result.details
        ? `${result.details}; High query latency (${result.connection.latencyMs}ms)`
        : `High query latency (${result.connection.latencyMs}ms)`
    }
  } catch (error) {
    result.status = "unhealthy"
    result.connection.error = error instanceof Error ? error.message : "Unknown error"
    result.details = `Health check failed: ${result.connection.error}`
  }

  return result
}

// ── Database Stats ──────────────────────────────────────────────────────

/**
 * Get comprehensive database statistics including table counts, index sizes,
 * cache hit rates, and connection utilization.
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  const supabase = getSupabaseServerClient()

  const [tableCounts, sizeInfo, cacheInfo, connectionInfo] = await Promise.all([
    getTableCounts(supabase),
    getDatabaseSizeInfo(supabase),
    getCacheHitRate(supabase),
    getConnectionInfo(supabase),
  ])

  return {
    tableCounts,
    totalTables: Object.keys(tableCounts).length,
    totalIndexes: sizeInfo.totalIndexes,
    totalSizeBytes: sizeInfo.totalSizeBytes,
    indexSizeBytes: sizeInfo.indexSizeBytes,
    cacheHitRate: cacheInfo.hitRate,
    connections: connectionInfo,
    uptime: sizeInfo.uptime,
  }
}

// ── Migration Check ─────────────────────────────────────────────────────

/**
 * Verify that all known migrations have been applied by checking the
 * Supabase schema_migrations table.
 */
export async function checkMigrations(
  clientOverride?: ReturnType<typeof getSupabaseServerClient>,
): Promise<MigrationStatus> {
  const supabase = clientOverride ?? getSupabaseServerClient()

  try {
    // Supabase tracks migrations in schema_migrations table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("schema_migrations")
      .select("version")
      .order("version", { ascending: true })

    if (error) {
      // schema_migrations might not exist in all setups
      return {
        totalMigrations: KNOWN_MIGRATIONS.length,
        appliedMigrations: 0,
        pendingMigrations: [...KNOWN_MIGRATIONS],
        ok: false,
      }
    }

    const appliedVersions = new Set((data ?? []).map((row: { version: string }) => row.version))

    const pendingMigrations = KNOWN_MIGRATIONS.filter((migration) => {
      const version = migration.split("_")[0]
      return !appliedVersions.has(version)
    })

    return {
      totalMigrations: KNOWN_MIGRATIONS.length,
      appliedMigrations: KNOWN_MIGRATIONS.length - pendingMigrations.length,
      pendingMigrations,
      ok: pendingMigrations.length === 0,
    }
  } catch {
    return {
      totalMigrations: KNOWN_MIGRATIONS.length,
      appliedMigrations: 0,
      pendingMigrations: [...KNOWN_MIGRATIONS],
      ok: false,
    }
  }
}

// ── Internal Helpers ─────────────────────────────────────────────────────

async function getTableSizes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<TableSizeInfo[]> {
  try {
    const { data, error } = await supabase.rpc("get_table_sizes", {
      table_names: KNOWN_TABLES,
    })

    if (!error && data) {
      return data as TableSizeInfo[]
    }
  } catch {
    // Fall through to direct query
  }

  // Fallback: query pg_catalog directly
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("exec_sql", {
      query: `
        SELECT
          schemaname || '.' || relname as table_name,
          n_live_tup as row_count,
          pg_total_relation_size(relid) as total_size_bytes,
          pg_indexes_size(relid) as index_size_bytes
        FROM pg_catalog.pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(relid) DESC
      `,
    })

    if (!error && data) {
      return (data as Array<{ table_name: string; row_count: unknown; total_size_bytes: unknown; index_size_bytes: unknown }>).map((row) => ({
        tableName: row.table_name,
        rowCount: Number(row.row_count) ?? 0,
        totalSizeBytes: Number(row.total_size_bytes) ?? 0,
        indexSizeBytes: Number(row.index_size_bytes) ?? 0,
        tableNameDisplay: row.table_name,
      }))
    }
  } catch {
    // Return empty on failure
  }

  return []
}

async function getIndexSizes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<IndexSizeInfo[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("exec_sql", {
      query: `
        SELECT
          indexname as index_name,
          tablename as table_name,
          pg_relation_size(indexrelid) as size_bytes
        FROM pg_catalog.pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY pg_relation_size(indexrelid) DESC
      `,
    })

    if (!error && data) {
      return (data as Array<{ index_name: string; table_name: string; size_bytes: unknown }>).map((row) => ({
        indexName: row.index_name,
        tableName: row.table_name,
        sizeBytes: Number(row.size_bytes) ?? 0,
      }))
    }
  } catch {
    // Return empty on failure
  }

  return []
}

async function getCacheHitRate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<CacheHitRate> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("exec_sql", {
      query: `
        SELECT
          sum(blks_hit) as blks_hit,
          sum(blks_read) as blks_read
        FROM pg_catalog.pg_statio_user_tables
      `,
    })

    if (!error && data && data.length > 0) {
      const row = data[0]
      const blksHit = Number(row.blks_hit) ?? 0
      const blksRead = Number(row.blks_read) ?? 0
      const total = blksHit + blksRead
      return {
        blksHit,
        blksRead,
        hitRate: total > 0 ? Math.round((blksHit / total) * 10000) / 100 : 0,
      }
    }
  } catch {
    // Return defaults on failure
  }

  return { blksHit: 0, blksRead: 0, hitRate: 0 }
}

async function getTableCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  await Promise.all(
    KNOWN_TABLES.map(async (table) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error } = await (supabase as any)
          .from(table)
          .select("*", { count: "exact", head: true })

        if (!error) {
          counts[table] = count ?? 0
        }
      } catch {
        counts[table] = -1 // Indicates error
      }
    }),
  )

  return counts
}

async function getDatabaseSizeInfo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{
  totalSizeBytes: number
  indexSizeBytes: number
  totalIndexes: number
  uptime: string
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("exec_sql", {
      query: `
        SELECT
          pg_database_size(current_database()) as total_size,
          (SELECT sum(pg_relation_size(indexrelid)) FROM pg_stat_user_indexes) as index_size,
          (SELECT count(*) FROM pg_stat_user_indexes) as total_indexes,
          pg_postmaster_start_time() as uptime
      `,
    })

    if (!error && data && data.length > 0) {
      const row = data[0]
      return {
        totalSizeBytes: Number(row.total_size) ?? 0,
        indexSizeBytes: Number(row.index_size) ?? 0,
        totalIndexes: Number(row.total_indexes) ?? 0,
        uptime: row.uptime ?? "unknown",
      }
    }
  } catch {
    // Return defaults
  }

  return { totalSizeBytes: 0, indexSizeBytes: 0, totalIndexes: 0, uptime: "unknown" }
}

async function getConnectionInfo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ active: number; max: number; utilization: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("exec_sql", {
      query: `
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_conn
      `,
    })

    if (!error && data && data.length > 0) {
      const row = data[0]
      const active = Number(row.active) ?? 0
      const max = Number(row.max_conn) ?? 100
      return {
        active,
        max,
        utilization: Math.round((active / max) * 10000) / 100,
      }
    }
  } catch {
    // Return defaults
  }

  return { active: 0, max: 100, utilization: 0 }
}

// ── Utility: Format bytes to human-readable ─────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}
