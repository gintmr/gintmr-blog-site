BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Legacy cleanup for older saved SQL queries and earlier function signatures.
DROP FUNCTION IF EXISTS public.get_visitors_overview_secure(text);
DROP FUNCTION IF EXISTS public.get_visitor_sessions_secure(text, integer, text);
DROP FUNCTION IF EXISTS public.upsert_visitor_session(
  text, text, text, integer,
  text, text, text, text, text, text,
  text, text, text, text
);
DROP FUNCTION IF EXISTS public.upsert_visitor_session(
  text, text, text, integer,
  text, text, text, text, text, text,
  text, text, text, text, text, text,
  text, text, double precision, double precision,
  text, text, text, integer, integer, integer,
  integer, text, integer, integer, double precision,
  text, double precision, integer, integer, integer, integer
);

CREATE OR REPLACE FUNCTION public.get_request_ip()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(btrim(split_part((current_setting('request.headers', true)::json->>'x-forwarded-for'), ',', 1)), ''),
    NULLIF(current_setting('request.headers', true)::json->>'x-real-ip', ''),
    inet_client_addr()::text,
    'unknown'
  );
$$;

COMMENT ON FUNCTION public.get_request_ip() IS 'Resolve the caller IP address from forwarded headers or the current connection.';

CREATE TABLE IF NOT EXISTS public.user_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id text NOT NULL,
  emoji text NOT NULL,
  user_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_reactions_content_id_emoji_user_hash_key
    UNIQUE (content_id, emoji, user_hash)
);

CREATE TABLE IF NOT EXISTS public.emoji_stats_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id text NOT NULL,
  emoji text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emoji_stats_cache_content_id_emoji_key
    UNIQUE (content_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.rate_limit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_type text NOT NULL,
  key_value text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT rate_limit_records_key UNIQUE (key_type, key_value, window_start)
);

CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path text NOT NULL,
  visitor_hash text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path text NOT NULL,
  visitor_hash text NOT NULL,
  session_id text NOT NULL,
  visit_started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  dwell_seconds integer NOT NULL DEFAULT 0,
  device_type text,
  os text,
  browser text,
  user_agent text,
  language text,
  timezone text,
  referrer text,
  country text,
  region text,
  city text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visitor_sessions_unique UNIQUE (page_path, visitor_hash, session_id)
);

ALTER TABLE public.visitor_sessions
  ADD COLUMN IF NOT EXISTS page_title text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS region_code text,
  ADD COLUMN IF NOT EXISTS postal text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS asn text,
  ADD COLUMN IF NOT EXISTS org text,
  ADD COLUMN IF NOT EXISTS ip_timezone text,
  ADD COLUMN IF NOT EXISTS screen_width integer,
  ADD COLUMN IF NOT EXISTS screen_height integer,
  ADD COLUMN IF NOT EXISTS viewport_width integer,
  ADD COLUMN IF NOT EXISTS viewport_height integer,
  ADD COLUMN IF NOT EXISTS color_scheme text,
  ADD COLUMN IF NOT EXISTS touch_points integer,
  ADD COLUMN IF NOT EXISTS hardware_concurrency integer,
  ADD COLUMN IF NOT EXISTS device_memory double precision,
  ADD COLUMN IF NOT EXISTS network_type text,
  ADD COLUMN IF NOT EXISTS max_scroll_percent double precision,
  ADD COLUMN IF NOT EXISTS interaction_count integer,
  ADD COLUMN IF NOT EXISTS heartbeat_count integer,
  ADD COLUMN IF NOT EXISTS visible_seconds integer,
  ADD COLUMN IF NOT EXISTS hidden_seconds integer;

CREATE TABLE IF NOT EXISTS public.private_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_reactions_content_id
  ON public.user_reactions (content_id);
CREATE INDEX IF NOT EXISTS idx_user_reactions_user_hash
  ON public.user_reactions (user_hash);
CREATE INDEX IF NOT EXISTS idx_user_reactions_emoji
  ON public.user_reactions (emoji);
CREATE INDEX IF NOT EXISTS idx_user_reactions_active_partial
  ON public.user_reactions (content_id, emoji)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_emoji_stats_content_id
  ON public.emoji_stats_cache (content_id);
CREATE INDEX IF NOT EXISTS idx_emoji_stats_content_id_count_desc
  ON public.emoji_stats_cache (content_id, count DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key
  ON public.rate_limit_records (key_type, key_value);
CREATE INDEX IF NOT EXISTS idx_rate_limit_expires
  ON public.rate_limit_records (expires_at);

CREATE INDEX IF NOT EXISTS idx_page_views_page_path
  ON public.page_views (page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_path_viewed_at
  ON public.page_views (page_path, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path_visitor
  ON public.page_views (page_path, visitor_hash);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_page_last_seen
  ON public.visitor_sessions (page_path, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_last_seen
  ON public.visitor_sessions (visitor_hash, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen
  ON public.visitor_sessions (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_country_last_seen
  ON public.visitor_sessions (country, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_org_last_seen
  ON public.visitor_sessions (org, last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_reactions_set_updated_at ON public.user_reactions;
CREATE TRIGGER trg_user_reactions_set_updated_at
  BEFORE UPDATE ON public.user_reactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_visitor_sessions_set_updated_at ON public.visitor_sessions;
CREATE TRIGGER trg_visitor_sessions_set_updated_at
  BEFORE UPDATE ON public.visitor_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_private_settings_set_updated_at ON public.private_settings;
CREATE TRIGGER trg_private_settings_set_updated_at
  BEFORE UPDATE ON public.private_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE FUNCTION public.fn_update_emoji_stats_cache(
  p_content_id text,
  p_emoji text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.user_reactions
  WHERE content_id = p_content_id
    AND emoji = p_emoji
    AND is_active = true;

  INSERT INTO public.emoji_stats_cache (content_id, emoji, count, last_updated)
  VALUES (p_content_id, p_emoji, v_count, now())
  ON CONFLICT ON CONSTRAINT emoji_stats_cache_content_id_emoji_key
  DO UPDATE SET
    count = EXCLUDED.count,
    last_updated = now();

  IF v_count = 0 THEN
    DELETE FROM public.emoji_stats_cache
    WHERE content_id = p_content_id
      AND emoji = p_emoji;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trg_sync_emoji_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_update_emoji_stats_cache(NEW.content_id, NEW.emoji);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.fn_update_emoji_stats_cache(OLD.content_id, OLD.emoji);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.fn_update_emoji_stats_cache(NEW.content_id, NEW.emoji);
    IF (OLD.content_id, OLD.emoji) IS DISTINCT FROM (NEW.content_id, NEW.emoji) THEN
      PERFORM public.fn_update_emoji_stats_cache(OLD.content_id, OLD.emoji);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_reactions_sync_stats ON public.user_reactions;
CREATE TRIGGER trg_user_reactions_sync_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.user_reactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_sync_emoji_stats();

CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_scope text,
  p_key text,
  p_limit_per_min integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit_records AS rl (
    key_type,
    key_value,
    window_start,
    expires_at,
    request_count
  )
  VALUES (
    p_scope,
    p_key,
    v_window,
    v_window + interval '1 minute',
    1
  )
  ON CONFLICT ON CONSTRAINT rate_limit_records_key
  DO UPDATE SET request_count = rl.request_count + 1
  RETURNING rl.request_count INTO v_count;

  IF v_count > p_limit_per_min THEN
    RAISE EXCEPTION 'rate limit exceeded for %:% (%/min)', p_scope, p_key, p_limit_per_min
      USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_content_reactions(
  p_content_id text,
  p_user_hash text DEFAULT NULL
)
RETURNS TABLE(
  emoji text,
  count integer,
  is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    esc.emoji,
    esc.count,
    CASE
      WHEN p_user_hash IS NOT NULL THEN COALESCE(ur.is_active, false)
      ELSE false
    END AS is_active
  FROM public.emoji_stats_cache esc
  LEFT JOIN public.user_reactions ur
    ON ur.content_id = esc.content_id
   AND ur.emoji = esc.emoji
   AND ur.user_hash = p_user_hash
  WHERE esc.content_id = p_content_id
    AND esc.count > 0
  ORDER BY esc.count DESC, esc.emoji;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_content_reactions_many(
  p_content_ids text[],
  p_user_hash text DEFAULT NULL
)
RETURNS TABLE(
  content_id text,
  emoji text,
  count integer,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    esc.content_id,
    esc.emoji,
    esc.count,
    CASE
      WHEN p_user_hash IS NOT NULL THEN COALESCE(ur.is_active, false)
      ELSE false
    END AS is_active
  FROM public.emoji_stats_cache esc
  LEFT JOIN public.user_reactions ur
    ON ur.content_id = esc.content_id
   AND ur.emoji = esc.emoji
   AND ur.user_hash = p_user_hash
  WHERE esc.content_id = ANY (p_content_ids)
    AND esc.count > 0
  ORDER BY esc.content_id, esc.count DESC, esc.emoji;
$$;

CREATE OR REPLACE FUNCTION public.get_page_view_count(
  p_page_path text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::integer
    FROM public.page_views pv
    WHERE pv.page_path = NULLIF(btrim(p_page_path), '')
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.get_page_view_counts_many(
  p_page_paths text[]
)
RETURNS TABLE(
  page_path text,
  view_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    pv.page_path,
    COUNT(*)::integer AS view_count
  FROM public.page_views pv
  WHERE pv.page_path = ANY (p_page_paths)
  GROUP BY pv.page_path;
$$;

CREATE OR REPLACE FUNCTION public.get_page_visit_stats(
  p_page_path text
)
RETURNS TABLE(
  view_count integer,
  visitor_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH scoped AS (
    SELECT pv.visitor_hash
    FROM public.page_views pv
    WHERE pv.page_path = NULLIF(btrim(p_page_path), '')
  )
  SELECT
    COUNT(*)::integer AS view_count,
    COUNT(DISTINCT scoped.visitor_hash)::integer AS visitor_count
  FROM scoped;
$$;

CREATE OR REPLACE FUNCTION public.track_page_view(
  p_page_path text,
  p_visitor_hash text,
  p_dedupe_minutes integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_path text := NULLIF(btrim(p_page_path), '');
  v_hash text := NULLIF(btrim(p_visitor_hash), '');
  v_last_seen timestamptz;
  v_dedupe_minutes integer := GREATEST(COALESCE(p_dedupe_minutes, 30), 0);
  v_ip text;
BEGIN
  IF v_path IS NULL OR v_hash IS NULL THEN
    RAISE EXCEPTION 'page path and visitor hash are required'
      USING ERRCODE = '22023';
  END IF;

  v_ip := public.get_request_ip();
  PERFORM public.enforce_rate_limit('pageview_ip', v_ip, 240);

  SELECT pv.viewed_at
    INTO v_last_seen
  FROM public.page_views pv
  WHERE pv.page_path = v_path
    AND pv.visitor_hash = v_hash
  ORDER BY pv.viewed_at DESC
  LIMIT 1;

  IF v_last_seen IS NULL
     OR v_last_seen <= now() - make_interval(mins => v_dedupe_minutes) THEN
    INSERT INTO public.page_views (page_path, visitor_hash, viewed_at)
    VALUES (v_path, v_hash, now());
  END IF;

  RETURN (
    SELECT COUNT(*)::integer
    FROM public.page_views
    WHERE page_path = v_path
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_visitors_info_password(
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_password text := NULLIF(btrim(p_password), '');
BEGIN
  IF v_password IS NULL OR length(v_password) < 4 THEN
    RAISE EXCEPTION 'visitors_info password is too short'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.private_settings AS ps (key, value, updated_at)
  VALUES (
    'visitors_info_password_hash',
    crypt(v_password, gen_salt('bf', 10)),
    now()
  )
  ON CONFLICT (key)
  DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.check_visitors_info_password(
  p_password text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_hash text;
  v_password text := COALESCE(p_password, '');
BEGIN
  SELECT ps.value
    INTO v_hash
  FROM public.private_settings ps
  WHERE ps.key = 'visitors_info_password_hash'
  LIMIT 1;

  IF v_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN crypt(v_password, v_hash) = v_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_visitor_session(
  p_page_path text,
  p_visitor_hash text,
  p_session_id text,
  p_dwell_seconds integer DEFAULT 0,
  p_device_type text DEFAULT NULL,
  p_os text DEFAULT NULL,
  p_browser text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_page_title text DEFAULT NULL,
  p_country_code text DEFAULT NULL,
  p_region_code text DEFAULT NULL,
  p_postal text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_asn text DEFAULT NULL,
  p_org text DEFAULT NULL,
  p_ip_timezone text DEFAULT NULL,
  p_screen_width integer DEFAULT NULL,
  p_screen_height integer DEFAULT NULL,
  p_viewport_width integer DEFAULT NULL,
  p_viewport_height integer DEFAULT NULL,
  p_color_scheme text DEFAULT NULL,
  p_touch_points integer DEFAULT NULL,
  p_hardware_concurrency integer DEFAULT NULL,
  p_device_memory double precision DEFAULT NULL,
  p_network_type text DEFAULT NULL,
  p_max_scroll_percent double precision DEFAULT NULL,
  p_interaction_count integer DEFAULT NULL,
  p_heartbeat_count integer DEFAULT NULL,
  p_visible_seconds integer DEFAULT NULL,
  p_hidden_seconds integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_path text := NULLIF(btrim(p_page_path), '');
  v_hash text := NULLIF(btrim(p_visitor_hash), '');
  v_session text := NULLIF(btrim(p_session_id), '');
  v_ip text := public.get_request_ip();
BEGIN
  IF v_path IS NULL OR v_hash IS NULL OR v_session IS NULL THEN
    RAISE EXCEPTION 'page path, visitor hash and session id are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public.enforce_rate_limit('visitor_session_ip', v_ip, 600);

  INSERT INTO public.visitor_sessions AS vs (
    page_path,
    visitor_hash,
    session_id,
    visit_started_at,
    last_seen_at,
    dwell_seconds,
    device_type,
    os,
    browser,
    user_agent,
    language,
    timezone,
    referrer,
    country,
    region,
    city,
    page_title,
    country_code,
    region_code,
    postal,
    latitude,
    longitude,
    asn,
    org,
    ip_timezone,
    screen_width,
    screen_height,
    viewport_width,
    viewport_height,
    color_scheme,
    touch_points,
    hardware_concurrency,
    device_memory,
    network_type,
    max_scroll_percent,
    interaction_count,
    heartbeat_count,
    visible_seconds,
    hidden_seconds,
    ip_address
  )
  VALUES (
    v_path,
    v_hash,
    v_session,
    now(),
    now(),
    GREATEST(COALESCE(p_dwell_seconds, 0), 0),
    NULLIF(btrim(COALESCE(p_device_type, '')), ''),
    NULLIF(btrim(COALESCE(p_os, '')), ''),
    NULLIF(btrim(COALESCE(p_browser, '')), ''),
    NULLIF(btrim(COALESCE(p_user_agent, '')), ''),
    NULLIF(btrim(COALESCE(p_language, '')), ''),
    NULLIF(btrim(COALESCE(p_timezone, '')), ''),
    NULLIF(btrim(COALESCE(p_referrer, '')), ''),
    NULLIF(btrim(COALESCE(p_country, '')), ''),
    NULLIF(btrim(COALESCE(p_region, '')), ''),
    NULLIF(btrim(COALESCE(p_city, '')), ''),
    NULLIF(btrim(COALESCE(p_page_title, '')), ''),
    NULLIF(btrim(COALESCE(p_country_code, '')), ''),
    NULLIF(btrim(COALESCE(p_region_code, '')), ''),
    NULLIF(btrim(COALESCE(p_postal, '')), ''),
    p_latitude,
    p_longitude,
    NULLIF(btrim(COALESCE(p_asn, '')), ''),
    NULLIF(btrim(COALESCE(p_org, '')), ''),
    NULLIF(btrim(COALESCE(p_ip_timezone, '')), ''),
    CASE WHEN p_screen_width IS NULL THEN NULL ELSE GREATEST(p_screen_width, 0) END,
    CASE WHEN p_screen_height IS NULL THEN NULL ELSE GREATEST(p_screen_height, 0) END,
    CASE WHEN p_viewport_width IS NULL THEN NULL ELSE GREATEST(p_viewport_width, 0) END,
    CASE WHEN p_viewport_height IS NULL THEN NULL ELSE GREATEST(p_viewport_height, 0) END,
    NULLIF(btrim(COALESCE(p_color_scheme, '')), ''),
    CASE WHEN p_touch_points IS NULL THEN NULL ELSE GREATEST(p_touch_points, 0) END,
    CASE WHEN p_hardware_concurrency IS NULL THEN NULL ELSE GREATEST(p_hardware_concurrency, 0) END,
    CASE WHEN p_device_memory IS NULL THEN NULL ELSE GREATEST(p_device_memory, 0) END,
    NULLIF(btrim(COALESCE(p_network_type, '')), ''),
    CASE WHEN p_max_scroll_percent IS NULL THEN NULL ELSE LEAST(GREATEST(p_max_scroll_percent, 0), 100) END,
    CASE WHEN p_interaction_count IS NULL THEN NULL ELSE GREATEST(p_interaction_count, 0) END,
    CASE WHEN p_heartbeat_count IS NULL THEN NULL ELSE GREATEST(p_heartbeat_count, 0) END,
    CASE WHEN p_visible_seconds IS NULL THEN NULL ELSE GREATEST(p_visible_seconds, 0) END,
    CASE WHEN p_hidden_seconds IS NULL THEN NULL ELSE GREATEST(p_hidden_seconds, 0) END,
    NULLIF(btrim(COALESCE(v_ip, '')), '')
  )
  ON CONFLICT ON CONSTRAINT visitor_sessions_unique
  DO UPDATE SET
    last_seen_at = now(),
    dwell_seconds = GREATEST(vs.dwell_seconds, GREATEST(COALESCE(p_dwell_seconds, 0), 0)),
    device_type = COALESCE(NULLIF(btrim(COALESCE(p_device_type, '')), ''), vs.device_type),
    os = COALESCE(NULLIF(btrim(COALESCE(p_os, '')), ''), vs.os),
    browser = COALESCE(NULLIF(btrim(COALESCE(p_browser, '')), ''), vs.browser),
    user_agent = COALESCE(NULLIF(btrim(COALESCE(p_user_agent, '')), ''), vs.user_agent),
    language = COALESCE(NULLIF(btrim(COALESCE(p_language, '')), ''), vs.language),
    timezone = COALESCE(NULLIF(btrim(COALESCE(p_timezone, '')), ''), vs.timezone),
    referrer = COALESCE(NULLIF(btrim(COALESCE(p_referrer, '')), ''), vs.referrer),
    country = COALESCE(NULLIF(btrim(COALESCE(p_country, '')), ''), vs.country),
    region = COALESCE(NULLIF(btrim(COALESCE(p_region, '')), ''), vs.region),
    city = COALESCE(NULLIF(btrim(COALESCE(p_city, '')), ''), vs.city),
    page_title = COALESCE(NULLIF(btrim(COALESCE(p_page_title, '')), ''), vs.page_title),
    country_code = COALESCE(NULLIF(btrim(COALESCE(p_country_code, '')), ''), vs.country_code),
    region_code = COALESCE(NULLIF(btrim(COALESCE(p_region_code, '')), ''), vs.region_code),
    postal = COALESCE(NULLIF(btrim(COALESCE(p_postal, '')), ''), vs.postal),
    latitude = COALESCE(p_latitude, vs.latitude),
    longitude = COALESCE(p_longitude, vs.longitude),
    asn = COALESCE(NULLIF(btrim(COALESCE(p_asn, '')), ''), vs.asn),
    org = COALESCE(NULLIF(btrim(COALESCE(p_org, '')), ''), vs.org),
    ip_timezone = COALESCE(NULLIF(btrim(COALESCE(p_ip_timezone, '')), ''), vs.ip_timezone),
    screen_width = COALESCE(CASE WHEN p_screen_width IS NULL THEN NULL ELSE GREATEST(p_screen_width, 0) END, vs.screen_width),
    screen_height = COALESCE(CASE WHEN p_screen_height IS NULL THEN NULL ELSE GREATEST(p_screen_height, 0) END, vs.screen_height),
    viewport_width = COALESCE(CASE WHEN p_viewport_width IS NULL THEN NULL ELSE GREATEST(p_viewport_width, 0) END, vs.viewport_width),
    viewport_height = COALESCE(CASE WHEN p_viewport_height IS NULL THEN NULL ELSE GREATEST(p_viewport_height, 0) END, vs.viewport_height),
    color_scheme = COALESCE(NULLIF(btrim(COALESCE(p_color_scheme, '')), ''), vs.color_scheme),
    touch_points = COALESCE(CASE WHEN p_touch_points IS NULL THEN NULL ELSE GREATEST(p_touch_points, 0) END, vs.touch_points),
    hardware_concurrency = COALESCE(CASE WHEN p_hardware_concurrency IS NULL THEN NULL ELSE GREATEST(p_hardware_concurrency, 0) END, vs.hardware_concurrency),
    device_memory = COALESCE(CASE WHEN p_device_memory IS NULL THEN NULL ELSE GREATEST(p_device_memory, 0) END, vs.device_memory),
    network_type = COALESCE(NULLIF(btrim(COALESCE(p_network_type, '')), ''), vs.network_type),
    max_scroll_percent = COALESCE(CASE WHEN p_max_scroll_percent IS NULL THEN NULL ELSE LEAST(GREATEST(p_max_scroll_percent, 0), 100) END, vs.max_scroll_percent),
    interaction_count = COALESCE(CASE WHEN p_interaction_count IS NULL THEN NULL ELSE GREATEST(p_interaction_count, 0) END, vs.interaction_count),
    heartbeat_count = COALESCE(CASE WHEN p_heartbeat_count IS NULL THEN NULL ELSE GREATEST(p_heartbeat_count, 0) END, vs.heartbeat_count),
    visible_seconds = COALESCE(CASE WHEN p_visible_seconds IS NULL THEN NULL ELSE GREATEST(p_visible_seconds, 0) END, vs.visible_seconds),
    hidden_seconds = COALESCE(CASE WHEN p_hidden_seconds IS NULL THEN NULL ELSE GREATEST(p_hidden_seconds, 0) END, vs.hidden_seconds),
    ip_address = COALESCE(vs.ip_address, NULLIF(btrim(COALESCE(v_ip, '')), '')),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_visitors_overview_secure(
  p_password text
)
RETURNS TABLE(
  total_views bigint,
  total_visitors bigint,
  total_sessions bigint,
  last_visit_at timestamptz,
  avg_dwell_seconds numeric,
  returning_visitors bigint,
  new_visitors_7d bigint
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ip text := public.get_request_ip();
BEGIN
  PERFORM public.enforce_rate_limit('visitors_info_read_ip', v_ip, 60);

  IF NOT public.check_visitors_info_password(p_password) THEN
    RAISE EXCEPTION 'invalid visitors_info password'
      USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::bigint FROM public.page_views),
    (SELECT COUNT(DISTINCT visitor_hash)::bigint FROM public.visitor_sessions),
    (SELECT COUNT(*)::bigint FROM public.visitor_sessions),
    (SELECT MAX(last_seen_at) FROM public.visitor_sessions),
    (
      SELECT COALESCE(AVG(NULLIF(dwell_seconds, 0)), 0)::numeric(12, 2)
      FROM public.visitor_sessions
    ),
    (
      SELECT COUNT(*)::bigint
      FROM (
        SELECT visitor_hash
        FROM public.visitor_sessions
        GROUP BY visitor_hash
        HAVING COUNT(*) > 1
      ) returning_visitors
    ),
    (
      SELECT COUNT(*)::bigint
      FROM (
        SELECT visitor_hash, MIN(visit_started_at) AS first_seen_at
        FROM public.visitor_sessions
        GROUP BY visitor_hash
        HAVING MIN(visit_started_at) >= now() - interval '7 days'
      ) new_visitors
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_visitor_sessions_secure(
  p_password text,
  p_limit integer DEFAULT 300,
  p_page_path text DEFAULT NULL
)
RETURNS TABLE(
  page_path text,
  visitor_hash text,
  session_id text,
  visit_started_at timestamptz,
  last_seen_at timestamptz,
  dwell_seconds integer,
  device_type text,
  os text,
  browser text,
  user_agent text,
  language text,
  timezone text,
  referrer text,
  country text,
  region text,
  city text,
  page_title text,
  country_code text,
  region_code text,
  postal text,
  latitude double precision,
  longitude double precision,
  asn text,
  org text,
  ip_timezone text,
  screen_width integer,
  screen_height integer,
  viewport_width integer,
  viewport_height integer,
  color_scheme text,
  touch_points integer,
  hardware_concurrency integer,
  device_memory double precision,
  network_type text,
  max_scroll_percent double precision,
  interaction_count integer,
  heartbeat_count integer,
  visible_seconds integer,
  hidden_seconds integer,
  ip_address text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ip text := public.get_request_ip();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 300), 1), 1000);
  v_page text := NULLIF(btrim(p_page_path), '');
BEGIN
  PERFORM public.enforce_rate_limit('visitors_info_read_ip', v_ip, 60);

  IF NOT public.check_visitors_info_password(p_password) THEN
    RAISE EXCEPTION 'invalid visitors_info password'
      USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    vs.page_path,
    vs.visitor_hash,
    vs.session_id,
    vs.visit_started_at,
    vs.last_seen_at,
    vs.dwell_seconds,
    vs.device_type,
    vs.os,
    vs.browser,
    vs.user_agent,
    vs.language,
    vs.timezone,
    vs.referrer,
    vs.country,
    vs.region,
    vs.city,
    vs.page_title,
    vs.country_code,
    vs.region_code,
    vs.postal,
    vs.latitude,
    vs.longitude,
    vs.asn,
    vs.org,
    vs.ip_timezone,
    vs.screen_width,
    vs.screen_height,
    vs.viewport_width,
    vs.viewport_height,
    vs.color_scheme,
    vs.touch_points,
    vs.hardware_concurrency,
    vs.device_memory,
    vs.network_type,
    vs.max_scroll_percent,
    vs.interaction_count,
    vs.heartbeat_count,
    vs.visible_seconds,
    vs.hidden_seconds,
    vs.ip_address
  FROM public.visitor_sessions vs
  WHERE v_page IS NULL OR vs.page_path = v_page
  ORDER BY vs.last_seen_at DESC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_emoji_reaction(
  p_content_id text,
  p_emoji text,
  p_user_hash text
)
RETURNS TABLE(
  emoji text,
  new_count integer,
  is_active boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_active boolean;
  v_new_count integer;
  v_ip text;
BEGIN
  v_ip := public.get_request_ip();
  PERFORM public.enforce_rate_limit('ip', v_ip, 60);

  INSERT INTO public.user_reactions AS ur (content_id, emoji, user_hash, is_active)
  VALUES (p_content_id, p_emoji, p_user_hash, true)
  ON CONFLICT ON CONSTRAINT user_reactions_content_id_emoji_user_hash_key
  DO UPDATE SET
    is_active = NOT ur.is_active,
    updated_at = now()
  RETURNING ur.is_active INTO v_new_active;

  SELECT COALESCE(esc.count, 0)
    INTO v_new_count
  FROM public.emoji_stats_cache esc
  WHERE esc.content_id = p_content_id
    AND esc.emoji = p_emoji;

  RETURN QUERY
  SELECT p_emoji::text, v_new_count::integer, v_new_active::boolean;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.rate_limit_records
  WHERE expires_at < now();
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_emoji_stats_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  TRUNCATE public.emoji_stats_cache;

  INSERT INTO public.emoji_stats_cache (content_id, emoji, count, last_updated)
  SELECT
    content_id,
    emoji,
    COUNT(*) AS count,
    now() AS last_updated
  FROM public.user_reactions
  WHERE is_active = true
  GROUP BY content_id, emoji
  HAVING COUNT(*) > 0;
END;
$$;

ALTER TABLE public.user_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emoji_stats_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table text;
  v_policy text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'user_reactions',
    'emoji_stats_cache',
    'rate_limit_records',
    'page_views',
    'visitor_sessions',
    'private_settings'
  ]
  LOOP
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy, v_table);
    END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.user_reactions FROM anon, authenticated;
REVOKE ALL ON TABLE public.emoji_stats_cache FROM anon, authenticated;
REVOKE ALL ON TABLE public.rate_limit_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.page_views FROM anon, authenticated;
REVOKE ALL ON TABLE public.visitor_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.private_settings FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_content_reactions(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_reactions_many(text[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_emoji_reaction(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_view_count(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_view_counts_many(text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_visit_stats(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_page_view(text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_visitor_session(
  text, text, text, integer,
  text, text, text, text, text, text,
  text, text, text, text, text, text,
  text, text, double precision, double precision,
  text, text, text, integer, integer, integer,
  integer, text, integer, integer, double precision,
  text, double precision, integer, integer, integer, integer
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visitors_overview_secure(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visitor_sessions_secure(text, integer, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_rate_limit(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rebuild_emoji_stats_cache() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_visitors_info_password(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_visitors_info_password(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_emoji_stats_cache() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_visitors_info_password(text) TO service_role;

COMMIT;

-- Smoke tests after deployment:
-- SELECT public.set_visitors_info_password('your-password-here');
-- SELECT * FROM public.get_visitors_overview_secure('your-password-here');
-- SELECT * FROM public.get_visitor_sessions_secure('your-password-here', 5, NULL);
