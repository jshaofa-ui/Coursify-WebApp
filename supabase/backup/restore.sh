#!/usr/bin/env bash
# ==========================================================================
# Coursify-WebApp Database Restore Script
# ==========================================================================
# Restore a database from a backup file created by backup.sh.
# Supports both compressed (.sql.gz) and encrypted (.sql.gz.gpg) files.
#
# Usage: ./restore.sh <backup-file>
#
# Environment variables (all optional, with sensible defaults):
#   SUPABASE_DB_HOST        - Database host (required)
#   SUPABASE_DB_PORT        - Database port (default: 5432)
#   SUPABASE_DB_NAME        - Database name (default: postgres)
#   SUPABASE_DB_USER        - Database user (default: postgres)
#   SUPABASE_DB_PASSWORD    - Database password (required)
#   ENCRYPTION_KEY          - GPG symmetric cipher key (if backup is encrypted)
#   RESTORE_DRY_RUN         - Set to "true" to preview without applying
#   PG_RESTORE_OPTS         - Additional pg_restore flags
# ==========================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────

BACKUP_FILE="${1:-}"
DB_HOST="${SUPABASE_DB_HOST:-}"
DB_PORT="${SUPABASE_DB_PORT:-5432}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"
RESTORE_DRY_RUN="${RESTORE_DRY_RUN:-false}"
PG_RESTORE_OPTS="${PG_RESTORE_OPTS:-}"

# ── Validation ────────────────────────────────────────────────────────────

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Error: Backup file path is required" >&2
  echo "Usage: $0 <backup-file>" >&2
  echo "" >&2
  echo "Supported formats:" >&2
  echo "  .sql          - Plain SQL dump" >&2
  echo "  .sql.gz       - Gzip compressed SQL dump" >&2
  echo "  .sql.gz.gpg   - Gzip + GPG encrypted SQL dump" >&2
  echo "  .dump         - pg_dump custom format" >&2
  exit 1
fi

if [[ -z "$DB_HOST" ]]; then
  echo "Error: SUPABASE_DB_HOST is required" >&2
  exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
  echo "Error: SUPABASE_DB_PASSWORD is required" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Error: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

# Check for required tools
for cmd in psql; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not installed" >&2
    exit 1
  fi
done

# ── Functions ─────────────────────────────────────────────────────────────

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

warn() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $*" >&2
}

cleanup_on_error() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    log "ERROR: Restore failed with exit code $exit_code"
    # Clean up temporary decrypted files
    rm -f "$TEMP_FILE" 2>/dev/null || true
  fi
  exit $exit_code
}

trap cleanup_on_error EXIT

prepare_backup_file() {
  local input_file="$1"
  TEMP_FILE=""

  case "$input_file" in
    *.sql.gz.gpg)
      # Encrypted and compressed
      if [[ -z "${ENCRYPTION_KEY:-}" ]]; then
        log "Error: Backup is encrypted but ENCRYPTION_KEY is not set"
        exit 1
      fi
      if ! command -v gpg &>/dev/null; then
        log "Error: gpg is required to decrypt backup but not installed"
        exit 1
      fi
      TEMP_FILE=$(mktemp /tmp/coursify_restore_XXXXXX.sql.gz)
      log "Decrypting backup..."
      gpg --batch --yes --decrypt \
        --passphrase "$ENCRYPTION_KEY" \
        -o "$TEMP_FILE" \
        "$input_file"
      input_file="$TEMP_FILE"
      ;;
    *.sql.gz)
      TEMP_FILE=$(mktemp /tmp/coursify_restore_XXXXXX.sql)
      log "Decompressing backup..."
      gzip -dkc "$input_file" > "$TEMP_FILE"
      input_file="$TEMP_FILE"
      ;;
    *.sql)
      # Plain SQL, use as-is
      ;;
    *.dump)
      # Custom pg_dump format
      ;;
    *)
      warn "Unknown file format: $input_file"
      warn "Attempting to restore anyway..."
      ;;
  esac

  echo "$input_file"
}

test_connection() {
  log "Testing database connection..."
  if ! PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "SELECT 1" &>/dev/null; then
    log "ERROR: Cannot connect to database at ${DB_HOST}:${DB_PORT}"
    exit 1
  fi
  log "Database connection successful"
}

create_pre_restore_snapshot() {
  local snapshot_file
  snapshot_file=$(mktemp /tmp/coursify_pre_restore_XXXXXX.sql)

  log "Creating pre-restore snapshot for safety..."
  PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --schema-only \
    -f "$snapshot_file" 2>/dev/null || true

  if [[ -s "$snapshot_file" ]]; then
    log "Pre-restore schema snapshot saved: $snapshot_file"
    echo "$snapshot_file"
  else
    rm -f "$snapshot_file"
    warn "Could not create pre-restore snapshot"
    echo ""
  fi
}

restore_sql_dump() {
  local sql_file="$1"

  if [[ "$RESTORE_DRY_RUN" == "true" ]]; then
    log "DRY RUN: Would restore from $sql_file"
    log "DRY RUN: SQL file size: $(stat -f%z "$sql_file" 2>/dev/null || stat -c%s "$sql_file" 2>/dev/null || echo 'unknown') bytes"
    log "DRY RUN: First 20 lines of SQL:"
    head -20 "$sql_file"
    return 0
  fi

  log "Restoring SQL dump..."
  PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -f "$sql_file"

  log "SQL restore completed"
}

restore_custom_dump() {
  local dump_file="$1"

  if [[ "$RESTORE_DRY_RUN" == "true" ]]; then
    log "DRY RUN: Would restore from $dump_file (custom format)"
    log "DRY RUN: Table of contents:"
    pg_restore --list "$dump_file" 2>/dev/null || true
    return 0
  fi

  log "Restoring custom format dump..."
  PGPASSWORD="$DB_PASSWORD" pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-privileges \
    $PG_RESTORE_OPTS \
    "$dump_file"

  log "Custom format restore completed"
}

verify_restore() {
  log "Verifying restore..."

  # Check that key tables exist and have data
  local tables=("courses" "course_distributions" "user_profiles")
  local all_ok=true

  for table in "${tables[@]}"; do
    local count
    count=$(PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -t -c "SELECT count(*) FROM public.${table}" 2>/dev/null || echo "ERROR")

    if [[ "$count" == "ERROR" ]]; then
      warn "Table ${table} not found or inaccessible"
      all_ok=false
    else
      log "  ${table}: ${count} rows"
    fi
  done

  if $all_ok; then
    log "Restore verification passed"
  else
    warn "Restore verification had issues - review manually"
  fi
}

# ── Main Execution ───────────────────────────────────────────────────────

log "=========================================="
log "Coursify Database Restore"
log "File: $(basename "$BACKUP_FILE")"
log "=========================================="

if [[ "$RESTORE_DRY_RUN" == "true" ]]; then
  log "*** DRY RUN MODE - No changes will be made ***"
fi

# Test connection
test_connection

# Safety warning
if [[ "$RESTORE_DRY_RUN" != "true" ]]; then
  log "WARNING: This will overwrite data in ${DB_NAME} on ${DB_HOST}"
  log "The backup file is: ${BACKUP_FILE}"
  log ""

  # Create pre-restore snapshot
  SNAPSHOT_FILE=$(create_pre_restore_snapshot)

  echo ""
  read -rp "Are you sure you want to proceed? (type 'yes' to confirm): " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    log "Restore cancelled by user"
    exit 0
  fi
fi

# Prepare the backup file (decrypt/decompress as needed)
log "Preparing backup file..."
PREPARED_FILE=$(prepare_backup_file "$BACKUP_FILE")
log "Prepared file: $PREPARED_FILE"

# Determine file type and restore
case "$PREPARED_FILE" in
  *.sql)
    restore_sql_dump "$PREPARED_FILE"
    ;;
  *.dump)
    restore_custom_dump "$PREPARED_FILE"
    ;;
  *)
    # Try SQL first, fall back to custom format
    if head -5 "$PREPARED_FILE" | grep -q "PostgreSQL"; then
      restore_sql_dump "$PREPARED_FILE"
    else
      restore_custom_dump "$PREPARED_FILE"
    fi
    ;;
esac

# Verify
verify_restore

# Cleanup
rm -f "$TEMP_FILE" 2>/dev/null || true

log "=========================================="
log "Restore complete"
if [[ -n "${SNAPSHOT_FILE:-}" ]]; then
  log "Pre-restore snapshot: $SNAPSHOT_FILE"
  log "Keep this file for rollback if needed"
fi
log "=========================================="
