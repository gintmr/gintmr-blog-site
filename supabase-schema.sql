BEGIN;

-- =========================================================
-- 0) 依赖扩展
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- =========================================================
-- 工具函数：获取来访 IP（优先 X-Forwarded-For）
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_request_ip()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(btrim(split_part( (current_setting('request.headers', true)::json->>'x-forwarded-for'), ',', 1 )), ''),
    NULLIF(        (current_setting('request.headers', true)::json->>'x-real-ip'),                                ''),
    inet_client_addr()::text,
    'unknown'
  );
$$;

COMMENT ON FUNCTION public.get_request_ip() IS '从请求头/连接信息解析调用方 IP（适配 Supabase/PostgREST）';

-- =========================================================
-- 1) 表结构
-- =========================================================
-- 用户表情（主表）
CREATE TABLE IF NOT EXISTS public.user_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  text NOT NULL,
  emoji       text NOT NULL,
  user_hash   text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_reactions_content_id_emoji_user_hash_key
    UNIQUE (content_id, emoji, user_hash)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_reactions_content_id
  ON public.user_reactions (content_id);
CREATE INDEX IF NOT EXISTS idx_user_reactions_user_hash
  ON public.user_reactions (user_hash);
CREATE INDEX IF NOT EXISTS idx_user_reactions_emoji
  ON public.user_reactions (emoji);
CREATE INDEX IF NOT EXISTS idx_user_reactions_active_partial
  ON public.user_reactions (content_id, emoji)
  WHERE is_active = true;

-- 统计缓存表
CREATE TABLE IF NOT EXISTS public.emoji_stats_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   text NOT NULL,
  emoji        text NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emoji_stats_cache_content_id_emoji_key
    UNIQUE (content_id, emoji)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_emoji_stats_content_id
  ON public.emoji_stats_cache (content_id);
CREATE INDEX IF NOT EXISTS idx_emoji_stats_content_id_count_desc
  ON public.emoji_stats_cache (content_id, count DESC);

-- 限流记录表（可选：如需更低 WAL，可考虑改为 UNLOGGED）
CREATE TABLE IF NOT EXISTS public.rate_limit_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_type      text NOT NULL,     -- 'ip' / 'user' / 'content' 等
  key_value     text NOT NULL,     -- 例如 IP 地址
  request_count integer NOT NULL DEFAULT 1,
  window_start  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  CONSTRAINT rate_limit_records_key UNIQUE (key_type, key_value, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key
  ON public.rate_limit_records (key_type, key_value);
CREATE INDEX IF NOT EXISTS idx_rate_limit_expires
  ON public.rate_limit_records (expires_at);

-- 页面访问记录表
CREATE TABLE IF NOT EXISTS public.page_views (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path    text NOT NULL,
  visitor_hash text NOT NULL,
  viewed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_page_path
  ON public.page_views (page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_path_viewed_at
  ON public.page_views (page_path, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path_visitor
  ON public.page_views (page_path, visitor_hash);

-- =========================================================
-- 2) 公共触发器：维护 updated_at
-- =========================================================
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

-- =========================================================
-- 3) 统计缓存维护（函数 + 触发器）
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_update_emoji_stats_cache(
  p_content_id text,
  p_emoji      text
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
    AND emoji      = p_emoji
    AND is_active  = true;

  INSERT INTO public.emoji_stats_cache (content_id, emoji, count, last_updated)
  VALUES (p_content_id, p_emoji, v_count, now())
  ON CONFLICT ON CONSTRAINT emoji_stats_cache_content_id_emoji_key
  DO UPDATE SET
     count        = EXCLUDED.count,
     last_updated = now();

  IF v_count = 0 THEN
    DELETE FROM public.emoji_stats_cache
    WHERE content_id = p_content_id AND emoji = p_emoji;
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

-- =========================================================
-- 4) 限流（按 IP 计数）
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_scope text,            -- 'ip' / 'content' / 'user' 等
  p_key   text,            -- 例如 IP 地址
  p_limit_per_min integer  -- 每分钟最大次数
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window timestamptz := date_trunc('minute', now());
  v_count  integer;
BEGIN
  INSERT INTO public.rate_limit_records AS rl
    (key_type, key_value, window_start, expires_at, request_count)
  VALUES
    (p_scope, p_key, v_window, v_window + interval '1 minute', 1)
  ON CONFLICT ON CONSTRAINT rate_limit_records_key
  DO UPDATE SET request_count = rl.request_count + 1
  RETURNING rl.request_count INTO v_count;

  IF v_count > p_limit_per_min THEN
    RAISE EXCEPTION 'rate limit exceeded for %:% (%/min)', p_scope, p_key, p_limit_per_min
      USING ERRCODE = '22023';
  END IF;
END;
$$;

-- =========================================================
-- 5) 对外只读接口（单个 + 批量）—— 受控访问
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_content_reactions(
  p_content_id text,
  p_user_hash  text DEFAULT NULL
)
RETURNS TABLE(
  emoji     text,
  count     integer,
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
    CASE WHEN p_user_hash IS NOT NULL
         THEN COALESCE(ur.is_active, false)
         ELSE false
    END AS is_active
  FROM public.emoji_stats_cache esc
  LEFT JOIN public.user_reactions ur
    ON  ur.content_id = esc.content_id
    AND ur.emoji      = esc.emoji
    AND ur.user_hash  = p_user_hash
  WHERE esc.content_id = p_content_id
    AND esc.count > 0
  ORDER BY esc.count DESC, esc.emoji;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_content_reactions_many(
  p_content_ids text[],
  p_user_hash   text DEFAULT NULL
)
RETURNS TABLE(
  content_id text,
  emoji      text,
  count      integer,
  is_active  boolean
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
    CASE WHEN p_user_hash IS NOT NULL
         THEN COALESCE(ur.is_active, false)
         ELSE false
    END AS is_active
  FROM public.emoji_stats_cache esc
  LEFT JOIN public.user_reactions ur
    ON  ur.content_id = esc.content_id
    AND ur.emoji      = esc.emoji
    AND ur.user_hash  = p_user_hash
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

-- =========================================================
-- 6) 对外写接口（原子切换 + IP 限流）—— 受控访问
-- =========================================================
CREATE OR REPLACE FUNCTION public.toggle_emoji_reaction(
  p_content_id text,
  p_emoji      text,
  p_user_hash  text
)
RETURNS TABLE(
  emoji     text,
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
  v_new_count  integer;
  v_ip         text;
BEGIN
  -- 每 IP 每分钟最多 60 次（按需调整）
  v_ip := public.get_request_ip();
  PERFORM public.enforce_rate_limit('ip', v_ip, 60);

  -- 原子切换：首次插入为 true；冲突则翻转
  INSERT INTO public.user_reactions AS ur (content_id, emoji, user_hash, is_active)
  VALUES (p_content_id, p_emoji, p_user_hash, true)
  ON CONFLICT ON CONSTRAINT user_reactions_content_id_emoji_user_hash_key
  DO UPDATE SET
     is_active = NOT ur.is_active,
     updated_at = now()
  RETURNING ur.is_active INTO v_new_active;

  -- 触发器已同步缓存：读取最新计数
  SELECT COALESCE(esc.count, 0)
    INTO v_new_count
  FROM public.emoji_stats_cache esc
  WHERE esc.content_id = p_content_id
    AND esc.emoji      = p_emoji;

  RETURN QUERY SELECT p_emoji::text, v_new_count::integer, v_new_active::boolean;
END;
$$;

-- =========================================================
-- 7) 管理函数（仅后端/服务密钥使用）
-- =========================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.rate_limit_records WHERE expires_at < now();
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
    now()    AS last_updated
  FROM public.user_reactions
  WHERE is_active = true
  GROUP BY content_id, emoji
  HAVING COUNT(*) > 0;
END;
$$;

-- =========================================================
-- 8) 安全：启用 RLS，移除旧策略，不创建任何允许策略
-- =========================================================
ALTER TABLE public.user_reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emoji_stats_cache  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views         ENABLE ROW LEVEL SECURITY;

-- 清理可能存在的旧策略（幂等）
DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_reactions';
  IF FOUND THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow public read user_reactions" ON public.user_reactions';
    EXECUTE 'DROP POLICY IF EXISTS "Restrict direct insert user_reactions" ON public.user_reactions';
    EXECUTE 'DROP POLICY IF EXISTS "Restrict direct update user_reactions" ON public.user_reactions';
    EXECUTE 'DROP POLICY IF EXISTS "Restrict direct delete user_reactions" ON public.user_reactions';
  END IF;

  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='emoji_stats_cache';
  IF FOUND THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow public read emoji_stats_cache" ON public.emoji_stats_cache';
    EXECUTE 'DROP POLICY IF EXISTS "Restrict all modification emoji_stats_cache" ON public.emoji_stats_cache';
    EXECUTE 'DROP POLICY IF EXISTS "No direct insert emoji_stats_cache" ON public.emoji_stats_cache';
    EXECUTE 'DROP POLICY IF EXISTS "No direct update emoji_stats_cache" ON public.emoji_stats_cache';
    EXECUTE 'DROP POLICY IF EXISTS "No direct delete emoji_stats_cache" ON public.emoji_stats_cache';
  END IF;

  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='rate_limit_records';
  IF FOUND THEN
    EXECUTE 'DROP POLICY IF EXISTS "Restrict all access rate_limit_records" ON public.rate_limit_records';
  END IF;

  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='page_views';
  IF FOUND THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow public read page_views" ON public.page_views';
    EXECUTE 'DROP POLICY IF EXISTS "No direct insert page_views" ON public.page_views';
    EXECUTE 'DROP POLICY IF EXISTS "No direct update page_views" ON public.page_views';
    EXECUTE 'DROP POLICY IF EXISTS "No direct delete page_views" ON public.page_views';
  END IF;
END $$;

-- 现在三张表都**没有**任何允许策略 ⇒ anon/authenticated 直接查/改会被 RLS 拒绝

-- 额外收紧：撤销表级权限
REVOKE ALL ON TABLE public.user_reactions     FROM anon, authenticated;
REVOKE ALL ON TABLE public.emoji_stats_cache  FROM anon, authenticated;
REVOKE ALL ON TABLE public.rate_limit_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.page_views         FROM anon, authenticated;

-- =========================================================
-- 9) 授权：只开放受控接口
-- =========================================================
GRANT EXECUTE ON FUNCTION public.get_content_reactions(text, text)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_reactions_many(text[], text)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_emoji_reaction(text, text, text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_view_count(text)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_view_counts_many(text[])            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_visit_stats(text)                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_page_view(text, text, integer)         TO anon, authenticated;

-- 管理/内部函数仅 service_role
REVOKE EXECUTE ON FUNCTION public.enforce_rate_limit(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rate_limits()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rebuild_emoji_stats_cache()             FROM PUBLIC;

GRANT  EXECUTE ON FUNCTION public.enforce_rate_limit(text, text, integer) TO service_role;
GRANT  EXECUTE ON FUNCTION public.cleanup_expired_rate_limits()           TO service_role;
GRANT  EXECUTE ON FUNCTION public.rebuild_emoji_stats_cache()             TO service_role;

-- 可选：pg_cron 定时清理（需要安装 pg_cron 扩展）
-- SELECT cron.schedule('cleanup-rate-limits', '*/5 * * * *', $$SELECT public.cleanup_expired_rate_limits();$$);

COMMIT;

-- ===================== 测试示例 =====================
-- 1) 批量读取：
-- SELECT * FROM public.get_content_reactions_many(ARRAY['post-1','post-2']::text[], NULL);
-- 2) 单条读取：
-- SELECT * FROM public.get_content_reactions('post-1', '7usqc8');
-- 3) 点赞切换（IP 限流 60/min）：
-- SELECT * FROM public.toggle_emoji_reaction('post-1','👍','7usqc8');
-- 4) 页面浏览量：
-- SELECT public.track_page_view('/posts/beyond_the_sirens', 'visitor-abc', 30);
-- SELECT public.get_page_view_count('/posts/beyond_the_sirens');
-- SELECT * FROM public.get_page_visit_stats('/posts/beyond_the_sirens');
