-- DEPRECATED
-- File này chỉ giữ để chặn setup legacy.
-- Nguồn schema chính thức hiện tại:
--   1) supabase/migrations/20260417090000_canonical_baseline.sql
--   2) supabase/migrations/20260417090100_ops_scheduler_optional.sql (optional)

DO $$
BEGIN
  RAISE EXCEPTION 'supabase/schema.sql is deprecated. Use canonical migrations in supabase/migrations instead.';
END
$$;
