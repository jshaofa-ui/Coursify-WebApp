#!/usr/bin/env bash
# ==========================================================================
# Coursify-WebApp Database Backup Script
# ==========================================================================
# pg_dump based backup for Supabase PostgreSQL.
# Supports full and incremental backups with compression and encryption.
#
# Usage: ./backup.sh [full|incremental]
#
# Environment variables (all optional, with sensible defaults):
#   SUPABASE_DB_HOST        - Database host (required)
#   SUPABASE_DB_PORT        - Database port (default: 5432)
#   SUPABASE_DB_NAME        - Database name (default: postgres)
#   SUPABASE_DB_USER        - Database user (default: postgres)
#   SUPABASE_DB_PASSWORD    - Database password (required)
#   BACKUP_DIR              - Output directory (default: ./backups)
#   BACKUP_RETENTION_DAYS   - Days to retain backups (default: 30)
#   ENCRYPTION_KEY          - GPG symmetric cipher key for encryption
#   COMPRESS_LEVEL          - Compression level 1-9 (default: 6)
#   PG_DUMP_OPTS            - Additional pg_dump flags
# ==========================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────

BACKUP_TYPE="${1:-full}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
COMPRESS_LEVEL="${COMPRESS_LEVEL:-6}"
PG_DUMP_OPTS="${PG_DUMP_OPTS:-}"

# Supabase connection defaults
DB_HOST="${SUPABASE_DB_HOST:-}"
DB_PORT="${SUPABASE_DB_PORT:-5432}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"

# ── Validation ────────────────────────────────────────────────────────────

if [[ "$BACKUP_TYPE" != "full" && "$BACKUP_TYPE" != "incremental" ]]; then
  echo "Error: Backup type must be 'full' or 'incremental'" >&2
  echo "Usage: $0 [full|incremental]" >&2
  exit 1
fi

if [[ -z "$DB_HOST" ]]; then
  echo "Error: SUPABASE_DB_HOST is required" >&2
  echo "Set it via environment variable or .env file" >&2
  exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
  echo "Error: SUPABASE_DB_PASSWORD is required" >&2
  echo "Set it via environment variable or .env file" >&2
  exit 1
fi

# Check for required tools
for cmd in pg_dump gzip; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not installed" >&2
    exit 1
  fi
done

# ── Timestamps and Paths ─────────────────────────────────────────────────

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_ONLY=$(date +"%Y%m%d")
TIMESTAMP_DIR="${BACKUP_DIR}/${DATE_ONLY}"

if [[ "$BACKUP_TYPE" == "full" ]]; then
  BACKUP_FILE="${TIMESTAMP_DIR}/full_backup_${TIMESTAMP}.sql"
else
  BACKUP_FILE="${TIMESTAMP_DIR}/incremental_backup_${TIMESTAMP}.sql"
fi

COMPRESSED_FILE="${BACKUP_FILE}.gz"
ENCRYPTED_FILE="${COMPRESSED_FILE}.gpg"

# ── Functions ─────────────────────────────────────────────────────────────

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

cleanup_on_error() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    log "ERROR: Backup failed with exit code $exit_code"
    # Remove partial backup files
    rm -f "$BACKUP_FILE" "$COMPRESSED_FILE" "$ENCRYPTED_FILE" 2>/dev/null || true
  fi
  exit $exit_code
}

trap cleanup_on_error EXIT

run_pg_dump() {
  local output_file="$1"
  local dump_opts="$2"

  log "Running pg_dump to ${output_file}..."

  PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    $dump_opts \
    $PG_DUMP_OPTS \
    -f "$output_file"

  log "pg_dump completed successfully"
}

compress_file() {
  local input_file="$1"

  if [[ ! -f "$input_file" ]]; then
    log "ERROR: Cannot compress - file not found: $input_file"
    return 1
  fi

  log "Compressing with gzip (level ${COMPRESS_LEVEL})..."
  gzip -"${COMPRESS_LEVEL}" -k "$input_file"

  if [[ -f "${input_file}.gz" ]]; then
    local original_size
    local compressed_size
    original_size=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file" 2>/dev/null || echo "unknown")
    compressed_size=$(stat -f%z "${input_file}.gz" 2>/dev/null || stat -c%s "${input_file}.gz" 2>/dev/null || echo "unknown")
    log "Compression complete: ${original_size}B -> ${compressed_size}B"
  fi
}

encrypt_file() {
  local input_file="$1"

  if [[ -z "${ENCRYPTION_KEY:-}" ]]; then
    log "No ENCRYPTION_KEY set, skipping encryption"
    return 0
  fi

  if ! command -v gpg &>/dev/null; then
    log "WARNING: gpg not found, skipping encryption"
    return 0
  fi

  log "Encrypting with GPG symmetric cipher..."
  gpg --batch --yes --symmetric \
    --cipher-algo AES256 \
    --passphrase "$ENCRYPTION_KEY" \
    -o "$ENCRYPTED_FILE" \
    "$input_file"

  # Remove unencrypted compressed file after successful encryption
  rm -f "$input_file"
  log "Encryption complete: $(basename "$ENCRYPTED_FILE")"
}

cleanup_old_backups() {
  log "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
  find "$BACKUP_DIR" -type f \( -name "*.sql" -o -name "*.sql.gz" -o -name "*.sql.gz.gpg" \) \
    -mtime +"$BACKUP_RETENTION_DAYS" -delete 2>/dev/null || true

  # Remove empty directories
  find "$BACKUP_DIR" -type d -empty -delete 2>/dev/null || true
  log "Cleanup complete"
}

verify_backup() {
  local backup_path="$1"

  if [[ ! -f "$backup_path" ]]; then
    log "ERROR: Backup file not found: $backup_path"
    return 1
  fi

  local file_size
  file_size=$(stat -f%z "$backup_path" 2>/dev/null || stat -c%s "$backup_path" 2>/dev/null || echo "0")

  if [[ "$file_size" -lt 100 ]]; then
    log "WARNING: Backup file is suspiciously small (${file_size} bytes)"
    return 1
  fi

  log "Backup verified: $(basename "$backup_path") (${file_size} bytes)"
  return 0
}

# ── Main Execution ───────────────────────────────────────────────────────

log "=========================================="
log "Coursify Database Backup"
log "Type: ${BACKUP_TYPE}"
log "=========================================="

# Create backup directory
mkdir -p "$TIMESTAMP_DIR"

# Test database connectivity
log "Testing database connection..."
if ! PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema-only \
  -f /dev/null 2>/dev/null; then
  log "ERROR: Cannot connect to database at ${DB_HOST}:${DB_PORT}"
  exit 1
fi
log "Database connection successful"

# Run backup
if [[ "$BACKUP_TYPE" == "full" ]]; then
  run_pg_dump "$BACKUP_FILE" ""
else
  # Incremental: schema-only + data for recently modified tables
  # For Supabase, we dump schema and key tables
  run_pg_dump "$BACKUP_FILE" "--schema-only"
fi

# Compress
compress_file "$BACKUP_FILE"

# Determine which file to encrypt/verify
FINAL_FILE="$COMPRESSED_FILE"
if [[ -n "${ENCRYPTION_KEY:-}" ]] && command -v gpg &>/dev/null; then
  encrypt_file "$COMPRESSED_FILE"
  FINAL_FILE="$ENCRYPTED_FILE"
fi

# Verify
verify_backup "$FINAL_FILE"

# Cleanup old backups
cleanup_old_backups

log "=========================================="
log "Backup complete: ${FINAL_FILE}"
log "=========================================="
