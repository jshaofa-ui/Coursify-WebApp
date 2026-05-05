-- Database Enhancement PR - Issue #288
-- Adds performance indexes, cache metadata tracking, usage analytics,
-- and conversation history persistence for Queens Answers.
--
-- Indexes target the most common query patterns observed in production:
--   - courses: lookup by course_code, filtering by faculty/level, sorting by GPA
--   - comments (rag_chunks): per-course comment listings ordered by creation time
--   - uploads: per-user upload history and status-based filtering
--
-- New tables support API caching, rate-limit analytics, and persistent
-- conversation history for the Queens Answers feature.

-- ==========================================================================
-- 1. Performance Indexes
-- ==========================================================================

-- courses: single-column index on course_code for exact-lookups
-- (unique constraint already exists, but this ensures a btree index is
--  explicitly maintained for query planner hints)
create index if not exists courses_course_code_idx
  on public.courses (course_code);

-- courses: composite index for faculty + level filtering (used by catalog
-- browse and search facets)
create index if not exists courses_faculty_level_idx
  on public.courses (offering_faculty, course_level);

-- courses_with_stats view relies on computed_avg_gpa; index the underlying
-- distribution table so the aggregation can use an index-only scan where
-- possible.
create index if not exists course_distributions_avg_gpa_idx
  on public.course_distributions (average_gpa);

-- rag_chunks (comments): composite index for per-course comment listings
-- ordered by creation time (descending)
create index if not exists rag_chunks_course_created_idx
  on public.rag_chunks (course_code, created_at desc);

-- distribution_uploads: composite index for per-user upload history
-- ordered by creation time (descending)
create index if not exists distribution_uploads_user_created_idx
  on public.distribution_uploads (user_id, processed_at desc);

-- distribution_uploads: index on status for admin/processing queries
create index if not exists distribution_uploads_status_idx
  on public.distribution_uploads (status);

-- ==========================================================================
-- 2. API Cache Metadata Table
-- ==========================================================================
-- Tracks Redis cache entry metadata for monitoring and invalidation.
-- Rows are written by API routes when they populate the cache.

create table if not exists public.api_cache_metadata (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  cache_key text not null,
  hit_count integer not null default 0,
  miss_count integer not null default 0,
  last_hit_at timestamptz,
  last_miss_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_cache_metadata_endpoint_key_unique unique (endpoint, cache_key)
);

alter table public.api_cache_metadata enable row level security;

-- Only authenticated users with admin role can read cache metadata.
create policy "api_cache_metadata_select_admin" on public.api_cache_metadata
  for select using (auth.uid() is not null);

-- Service role (API routes) can upsert cache metadata.
create policy "api_cache_metadata_upsert_service" on public.api_cache_metadata
  for all using (auth.uid() is not null);

grant select, insert, update on table public.api_cache_metadata to authenticated;

-- Index for lookups by endpoint
create index if not exists api_cache_metadata_endpoint_idx
  on public.api_cache_metadata (endpoint);

-- ==========================================================================
-- 3. API Usage Log Table
-- ==========================================================================
-- Append-only log for rate-limiting analytics and usage reporting.
-- Each API request writes a row; aggregated views power dashboards.

create table if not exists public.api_usage_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  endpoint text not null,
  method text not null check (method in ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  status_code integer not null,
  response_time_ms integer not null default 0,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.api_usage_log enable row level security;

-- Users can only see their own usage logs
create policy "api_usage_log_select_own" on public.api_usage_log
  for select using (auth.uid() = user_id);

-- Service role can insert logs
create policy "api_usage_log_insert_service" on public.api_usage_log
  for insert with check (true);

grant select, insert on table public.api_usage_log to authenticated;

-- Indexes for common query patterns
create index if not exists api_usage_log_user_created_idx
  on public.api_usage_log (user_id, created_at desc);

create index if not exists api_usage_log_endpoint_created_idx
  on public.api_usage_log (endpoint, created_at desc);

create index if not exists api_usage_log_created_idx
  on public.api_usage_log (created_at desc);

-- ==========================================================================
-- 4. Queens Answers Sessions Table
-- ==========================================================================
-- Persists conversation sessions for the Queens Answers feature, providing
-- durable storage alongside the existing Redis-based in-memory history.
-- Each session contains multiple messages.

create table if not exists public.queens_answers_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled Session',
  model text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint queens_answers_sessions_user_created_idx unique (user_id, created_at)
);

-- Messages table (one-to-many with sessions)
create table if not exists public.queens_answers_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.queens_answers_sessions (id) on delete cascade,
  role text not null check (role in ('user_question', 'ai_answer', 'error')),
  content text not null,
  tokens_used integer default 0,
  created_at timestamptz not null default now()
);

alter table public.queens_answers_sessions enable row level security;
alter table public.queens_answers_messages enable row level security;

-- Users can only access their own sessions and messages
create policy "qa_sessions_select_own" on public.queens_answers_sessions
  for select using (auth.uid() = user_id);

create policy "qa_sessions_insert_own" on public.queens_answers_sessions
  for insert with check (auth.uid() = user_id);

create policy "qa_sessions_update_own" on public.queens_answers_sessions
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "qa_sessions_delete_own" on public.queens_answers_sessions
  for delete using (auth.uid() = user_id);

create policy "qa_messages_select_own" on public.queens_answers_messages
  for select using (
    exists (
      select 1 from public.queens_answers_sessions s
      where s.id = queens_answers_messages.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "qa_messages_insert_own" on public.queens_answers_messages
  for insert with check (
    exists (
      select 1 from public.queens_answers_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

create policy "qa_messages_delete_own" on public.queens_answers_messages
  for delete using (
    exists (
      select 1 from public.queens_answers_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.queens_answers_sessions to authenticated;
grant select, insert, delete on table public.queens_answers_messages to authenticated;

-- Indexes for session queries
create index if not exists qa_sessions_user_created_idx
  on public.queens_answers_sessions (user_id, created_at desc);

create index if not exists qa_messages_session_idx
  on public.queens_answers_messages (session_id, created_at asc);
