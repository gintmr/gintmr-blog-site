BEGIN;

-- Delete visitor analytics data captured before 2026-04-01.
-- This keeps reactions and other features intact while resetting older traffic history.

DELETE FROM public.visitor_sessions
WHERE COALESCE(last_seen_at, visit_started_at, created_at) < TIMESTAMPTZ '2026-04-01 00:00:00+08';

DELETE FROM public.page_views
WHERE viewed_at < TIMESTAMPTZ '2026-04-01 00:00:00+08';

DELETE FROM public.rate_limit_records
WHERE expires_at < now();

COMMIT;

-- Verification:
-- SELECT COUNT(*) FROM public.visitor_sessions WHERE COALESCE(last_seen_at, visit_started_at, created_at) < TIMESTAMPTZ '2026-04-01 00:00:00+08';
-- SELECT COUNT(*) FROM public.page_views WHERE viewed_at < TIMESTAMPTZ '2026-04-01 00:00:00+08';
