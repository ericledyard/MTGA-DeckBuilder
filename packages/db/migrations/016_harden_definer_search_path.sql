-- Migration 016: pin search_path on every SECURITY DEFINER function
--
-- Captures a fix applied by hand in the Supabase Dashboard so it survives a
-- migration replay. Supabase's Security Advisor flags "Function Search Path
-- Mutable": a SECURITY DEFINER function with an unpinned search_path runs with
-- the definer's privileges but the *caller's* schema resolution, so a caller
-- who can create objects in an earlier schema can shadow a table or operator
-- and have it executed as the definer.
--
-- Every function here is SECURITY DEFINER, and none of them set search_path in
-- migrations 001-015 — so replaying from scratch reintroduces the warning.
--
-- Why `public, extensions, pg_temp` and not just `public`:
-- this schema depends on pg_trgm (fuzzy card-name search) and uuid-ossp, and
-- Supabase installs extensions into the `extensions` schema. Pinning to
-- `public` alone would resolve the trgm operators out of scope and break card
-- search. pg_temp is listed last so temp objects can never shadow real ones.
--
-- Idempotent: re-running is a no-op. Uses a catalog loop rather than a fixed
-- list so overloads (search_cards has several) are all covered without having
-- to spell out every argument signature.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef                                  -- SECURITY DEFINER only
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) AS cfg
          WHERE cfg LIKE 'search\_path=%'
        )
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, extensions, pg_temp',
      fn.signature
    );
    RAISE NOTICE 'pinned search_path on %', fn.signature;
  END LOOP;
END
$$;

-- Verify: every row should show a search_path entry in `settings`.
--
--   SELECT p.oid::regprocedure AS fn, p.prosecdef, p.proconfig AS settings
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prosecdef
--   ORDER BY 1;
