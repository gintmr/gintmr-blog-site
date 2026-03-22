import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/client";

const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_KEY;

// 只有在配置了环境变量时才创建 Supabase 客户端
export const supabase = !!(supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// 用于在未配置时提供友好的日志信息
if (!supabase) {
  console.info(
    "Supabase not configured - emoji reactions and page view counter will be disabled"
  );
}

// 类型
export interface UserReactionData {
  id?: string;
  content_id: string;
  emoji: string;
  user_hash: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ReactionRow = {
  content_id?: string; // 批量接口会返回
  emoji: string;
  count: number;
  is_active: boolean;
};

export interface PageViewCountRow {
  page_path: string;
  view_count: number;
}

export interface PageVisitStats {
  view_count: number;
  visitor_count: number;
}

export interface VisitorEnvironment {
  deviceType: string;
  os: string;
  browser: string;
  userAgent: string;
  language: string;
  timezone: string;
  referrer: string;
}

export interface VisitorGeoInfo {
  country?: string;
  region?: string;
  city?: string;
}

export interface VisitorSessionPayload {
  pagePath: string;
  visitorHash: string;
  sessionId: string;
  dwellSeconds?: number;
  environment?: VisitorEnvironment;
  geo?: VisitorGeoInfo;
}

export interface VisitorSessionRow {
  page_path: string;
  visitor_hash: string;
  session_id: string;
  visit_started_at: string;
  last_seen_at: string;
  dwell_seconds: number;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  language: string | null;
  timezone: string | null;
  referrer: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  ip_address: string | null;
}

export interface VisitorsOverview {
  total_views: number;
  total_visitors: number;
  total_sessions: number;
  last_visit_at: string | null;
}

// 环境判断 & 小工具
const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

// 检查 Supabase 是否可用的辅助函数
function checkSupabaseAvailable(): boolean {
  if (!supabase) {
    console.error("Supabase client not initialized");
    return false;
  }
  return true;
}

function normalizePagePath(path: string): string {
  if (!path) return "/";

  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";

  const withoutQuery = trimmed.split("?")[0].split("#")[0];
  const normalized = withoutQuery.replace(/\/+$/, "");
  return normalized || "/";
}

function safeTrim(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

// 将 rows 以 content_id 分组
function groupByContentId(rows: ReactionRow[]) {
  const map = new Map<string, ReactionRow[]>();
  for (const r of rows) {
    const id = r.content_id!;
    const list = map.get(id) ?? [];
    list.push(r);
    map.set(id, list);
  }
  return map;
}

// ---------------------------------------------
// 批量读取 RPC（数据库已创建 get_content_reactions_many）
// 单条读取默认会走批量器
// ---------------------------------------------

/**
 * 直接单条读取（不经过批量器）
 * 若你想强制一次只打一个 RPC，可调用这个函数。
 */
export async function getContentReactionsDirect(
  contentId: string,
  userHash?: string
) {
  if (!checkSupabaseAvailable()) {
    return [] as ReactionRow[];
  }

  const { data, error } = await supabase!.rpc("get_content_reactions", {
    p_content_id: contentId,
    p_user_hash: userHash ?? null,
  });
  if (error) {
    console.error("Error fetching reactions:", error);
    return [] as ReactionRow[];
  }
  return (data as ReactionRow[]) ?? [];
}

/**
 * 批量读取：一次拿多个 contentId 的汇总
 */
export async function getContentReactionsMany(
  contentIds: string[],
  userHash?: string
) {
  if (!checkSupabaseAvailable()) {
    return [] as ReactionRow[];
  }

  const { data, error } = await supabase!.rpc("get_content_reactions_many", {
    p_content_ids: contentIds,
    p_user_hash: userHash ?? null,
  });
  if (error) {
    console.error("Error fetching reactions (batch):", error);
    return [] as ReactionRow[];
  }
  return (data as ReactionRow[]) ?? [];
}

// 客户端批量器（同一帧内的多个请求合并为一次 RPC）
type Resolver = {
  resolve: (rows: ReactionRow[]) => void;
  reject: (error: Error) => void;
};

class ReactionsBatcher {
  private queues = new Map<
    string /* userHashKey */,
    Map<string /*contentId*/, Resolver[]>
  >();
  private timer: number | undefined;
  // 同一动画帧合并（可调大到 24~32ms 以获得更高合并率）
  private static BATCH_WINDOW_MS = 16;

  /**
   * 收集一个 contentId 请求；按 userHash 维度合并
   */
  load(contentId: string, userHash?: string): Promise<ReactionRow[]> {
    if (!isBrowser) {
      // SSR：直接单条 RPC，避免跨请求共享状态
      return getContentReactionsDirect(contentId, userHash);
    }

    const key = userHash ?? "";
    if (!this.queues.has(key)) this.queues.set(key, new Map());
    const q = this.queues.get(key)!;

    const resolvers = q.get(contentId) ?? [];
    const p = new Promise<ReactionRow[]>((resolve, reject) =>
      resolvers.push({ resolve, reject })
    );
    q.set(contentId, resolvers);

    this.scheduleFlush();
    return p;
  }

  private scheduleFlush() {
    if (this.timer) return;
    this.timer = window.setTimeout(
      () => this.flush(),
      ReactionsBatcher.BATCH_WINDOW_MS
    );
  }

  private async flush() {
    const batches = this.queues;
    this.queues = new Map();
    this.timer = undefined;

    // 如果 Supabase 未配置，直接返回空结果
    if (!checkSupabaseAvailable()) {
      for (const q of batches.values()) {
        for (const resolvers of q.values()) {
          resolvers.forEach(({ resolve }) => resolve([]));
        }
      }
      return;
    }

    await Promise.all(
      [...batches.entries()].map(async ([userKey, q]) => {
        const ids = [...q.keys()];
        try {
          // 调用批量 RPC
          const { data, error } = await supabase!.rpc(
            "get_content_reactions_many",
            {
              p_content_ids: ids,
              p_user_hash: userKey || null,
            }
          );
          if (error) throw error;

          const rows = (data as ReactionRow[]) ?? [];
          const grouped = groupByContentId(rows);

          for (const id of ids) {
            const list = grouped.get(id) ?? [];
            (q.get(id) ?? []).forEach(({ resolve }) => resolve(list));
          }
        } catch (err) {
          // 整批失败：逐个 reject（或回退到单条直调也可）
          for (const resolvers of q.values())
            resolvers.forEach(({ reject }) => reject(err as Error));
        }
      })
    );
  }
}

const reactionsBatcher = new ReactionsBatcher();

/**
 * 对外导出：组件内直接用这个。
 * - 浏览器端：自动合并为一次批量 RPC
 * - SSR：自动回退为单条 RPC
 */
export function getContentReactions(contentId: string, userHash?: string) {
  return reactionsBatcher.load(contentId, userHash);
}

// 写入：切换表情（服务器端限流）
export async function toggleEmojiReaction(
  contentId: string,
  emoji: string,
  userHash: string
) {
  if (!checkSupabaseAvailable()) {
    console.warn("Supabase not configured - emoji reaction toggle skipped");
    return null;
  }

  const { data, error } = await supabase!.rpc("toggle_emoji_reaction", {
    p_content_id: contentId,
    p_emoji: emoji,
    p_user_hash: userHash,
  });

  if (error) {
    // 可根据 errcode 做更友好的提示（例如 22023 = rate limit）
    console.error("Error toggling reaction:", error);
    throw error;
  }

  // 返回单行：{ emoji, new_count, is_active }
  return (
    (data?.[0] as { emoji: string; new_count: number; is_active: boolean }) ??
    null
  );
}

// 页面访问计数（按页面路径）
export async function getPageViewCount(pagePath: string): Promise<number | null> {
  if (!checkSupabaseAvailable()) {
    return null;
  }

  const normalizedPath = normalizePagePath(pagePath);
  const { data, error } = await supabase!.rpc("get_page_view_count", {
    p_page_path: normalizedPath,
  });

  if (error) {
    console.error("Error fetching page view count:", error);
    return null;
  }

  const numericValue =
    typeof data === "number"
      ? data
      : Number.parseInt(String(data ?? "0"), 10);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export async function getPageViewCountsMany(
  pagePaths: string[]
): Promise<PageViewCountRow[]> {
  if (!checkSupabaseAvailable()) {
    return [];
  }

  const normalizedPaths = Array.from(
    new Set(pagePaths.map(normalizePagePath).filter(Boolean))
  );

  if (normalizedPaths.length === 0) return [];

  const { data, error } = await supabase!.rpc("get_page_view_counts_many", {
    p_page_paths: normalizedPaths,
  });

  if (error) {
    console.error("Error fetching page view counts:", error);
    return [];
  }

  return (data as PageViewCountRow[]) ?? [];
}

export async function getPageVisitStats(
  pagePath: string
): Promise<PageVisitStats | null> {
  if (!checkSupabaseAvailable()) {
    return null;
  }

  const normalizedPath = normalizePagePath(pagePath);
  const { data, error } = await supabase!.rpc("get_page_visit_stats", {
    p_page_path: normalizedPath,
  });

  if (error) {
    console.error("Error fetching page visit stats:", error);
    return null;
  }

  const firstRow = Array.isArray(data) ? data[0] : data;
  if (!firstRow || typeof firstRow !== "object") {
    return { view_count: 0, visitor_count: 0 };
  }

  const row = firstRow as Record<string, unknown>;
  const toInt = (value: unknown) => {
    const n =
      typeof value === "number"
        ? value
        : Number.parseInt(String(value ?? "0"), 10);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    view_count: toInt(row.view_count),
    visitor_count: toInt(row.visitor_count),
  };
}

export async function upsertVisitorSession(
  payload: VisitorSessionPayload
): Promise<boolean> {
  if (!checkSupabaseAvailable()) {
    return false;
  }

  const pagePath = normalizePagePath(payload.pagePath);
  const visitorHash = safeTrim(payload.visitorHash);
  const sessionId = safeTrim(payload.sessionId);

  if (!visitorHash || !sessionId) {
    return false;
  }

  const dwellSeconds = Math.max(0, Math.floor(payload.dwellSeconds ?? 0));
  const env = payload.environment;
  const geo = payload.geo;

  const { error } = await supabase!.rpc("upsert_visitor_session", {
    p_page_path: pagePath,
    p_visitor_hash: visitorHash,
    p_session_id: sessionId,
    p_dwell_seconds: dwellSeconds,
    p_device_type: env?.deviceType ?? null,
    p_os: env?.os ?? null,
    p_browser: env?.browser ?? null,
    p_user_agent: env?.userAgent ?? null,
    p_language: env?.language ?? null,
    p_timezone: env?.timezone ?? null,
    p_referrer: env?.referrer ?? null,
    p_country: geo?.country ?? null,
    p_region: geo?.region ?? null,
    p_city: geo?.city ?? null,
  });

  if (error) {
    console.error("Error upserting visitor session:", error);
    return false;
  }

  return true;
}

export async function getVisitorsOverviewSecure(
  password: string
): Promise<VisitorsOverview> {
  if (!checkSupabaseAvailable()) {
    throw new Error("Supabase client not initialized");
  }

  const pass = safeTrim(password);
  if (!pass) throw new Error("Password is empty");

  const { data, error } = await supabase!.rpc("get_visitors_overview_secure", {
    p_password: pass,
  });

  if (error) {
    console.error("Error fetching visitors overview:", error);
    throw new Error(
      `RPC get_visitors_overview_secure failed (${error.code ?? "unknown"}): ${error.message}`
    );
  }

  const firstRow = Array.isArray(data) ? data[0] : data;
  if (!firstRow || typeof firstRow !== "object") {
    return {
      total_views: 0,
      total_visitors: 0,
      total_sessions: 0,
      last_visit_at: null,
    };
  }

  const row = firstRow as Record<string, unknown>;
  const toInt = (value: unknown) => {
    const n =
      typeof value === "number"
        ? value
        : Number.parseInt(String(value ?? "0"), 10);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    total_views: toInt(row.total_views),
    total_visitors: toInt(row.total_visitors),
    total_sessions: toInt(row.total_sessions),
    last_visit_at:
      typeof row.last_visit_at === "string" ? row.last_visit_at : null,
  };
}

export async function getVisitorSessionsSecure(
  password: string,
  options?: { limit?: number; pagePath?: string }
): Promise<VisitorSessionRow[]> {
  if (!checkSupabaseAvailable()) {
    throw new Error("Supabase client not initialized");
  }

  const pass = safeTrim(password);
  if (!pass) throw new Error("Password is empty");

  const limit = Math.min(
    Math.max(Math.floor(options?.limit ?? 300), 1),
    1000
  );
  const pagePath = safeTrim(options?.pagePath);

  const { data, error } = await supabase!.rpc("get_visitor_sessions_secure", {
    p_password: pass,
    p_limit: limit,
    p_page_path: pagePath || null,
  });

  if (error) {
    console.error("Error fetching visitor sessions:", error);
    throw new Error(
      `RPC get_visitor_sessions_secure failed (${error.code ?? "unknown"}): ${error.message}`
    );
  }

  return (data as VisitorSessionRow[]) ?? [];
}

export async function trackPageView(
  pagePath: string,
  visitorHash: string,
  dedupeMinutes = 30
): Promise<number | null> {
  if (!checkSupabaseAvailable()) {
    return null;
  }

  const normalizedPath = normalizePagePath(pagePath);
  const { data, error } = await supabase!.rpc("track_page_view", {
    p_page_path: normalizedPath,
    p_visitor_hash: visitorHash,
    p_dedupe_minutes: Math.max(0, Math.floor(dedupeMinutes)),
  });

  if (error) {
    console.error("Error tracking page view:", error);
    return null;
  }

  const numericValue =
    typeof data === "number"
      ? data
      : Number.parseInt(String(data ?? "0"), 10);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return "Tablet";
  if (/mobi|iphone|android/.test(ua)) return "Mobile";
  return "Desktop";
}

function detectOs(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os x") && !ua.includes("iphone") && !ua.includes("ipad")) return "macOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "iOS";
  if (ua.includes("linux")) return "Linux";
  return "Unknown";
}

function detectBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("firefox/")) return "Firefox";
  return "Unknown";
}

export function detectVisitorEnvironment(): VisitorEnvironment {
  if (!isBrowser) {
    return {
      deviceType: "Unknown",
      os: "Unknown",
      browser: "Unknown",
      userAgent: "",
      language: "",
      timezone: "",
      referrer: "",
    };
  }

  const userAgent = navigator.userAgent || "";
  const language =
    (Array.isArray(navigator.languages) && navigator.languages[0]) ||
    navigator.language ||
    "";
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const referrer = document.referrer || "";

  return {
    deviceType: detectDeviceType(userAgent),
    os: detectOs(userAgent),
    browser: detectBrowser(userAgent),
    userAgent,
    language,
    timezone,
    referrer,
  };
}

const GEO_CACHE_KEY = "astro-obsidian-blog:visitor-geo:v1";
const GEO_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 小时

export async function getVisitorGeoInfo(): Promise<VisitorGeoInfo> {
  if (!isBrowser) return {};

  try {
    const cachedRaw = localStorage.getItem(GEO_CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as
        | (VisitorGeoInfo & { fetchedAt?: number })
        | null;
      if (
        cached &&
        typeof cached === "object" &&
        typeof cached.fetchedAt === "number" &&
        Date.now() - cached.fetchedAt < GEO_CACHE_TTL_MS
      ) {
        return {
          country: safeTrim(cached.country),
          region: safeTrim(cached.region),
          city: safeTrim(cached.city),
        };
      }
    }
  } catch {
    // ignore cache read errors
  }

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3500);
    const response = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
      cache: "no-store",
    });
    window.clearTimeout(timer);

    if (!response.ok) return {};

    const data = (await response.json()) as Record<string, unknown>;
    const geo: VisitorGeoInfo = {
      country: safeTrim(String(data.country_name ?? "")),
      region: safeTrim(String(data.region ?? "")),
      city: safeTrim(String(data.city ?? "")),
    };

    try {
      localStorage.setItem(
        GEO_CACHE_KEY,
        JSON.stringify({
          ...geo,
          fetchedAt: Date.now(),
        })
      );
    } catch {
      // ignore cache write errors
    }

    return geo;
  } catch {
    return {};
  }
}

export function generateSessionId(
  ns = "astro-obsidian-blog:visitor-session"
): string {
  const random = crypto?.randomUUID?.() ?? randomIdFallback();
  return `${ns}:${Date.now()}:${random}`;
}

// 生成用户哈希（基于强随机 + localStorage 持久化）
export function generateUserHash(ns = "astro-obsidian-blog"): string {
  if (!isBrowser) return "ssr-default-hash";

  const KEY = `${ns}:uid`;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return stored;

    // 生成强随机 UUID（现代浏览器）
    const uid = crypto?.randomUUID?.() ?? randomIdFallback();
    localStorage.setItem(KEY, uid);
    return uid;
  } catch {
    // 无法访问 localStorage 时退化为会话级 ID
    return crypto?.randomUUID?.() ?? randomIdFallback();
  }
}

function randomIdFallback(): string {
  // 128bit 随机数（近似 UUIDv4 的强度）
  try {
    const bytes = new Uint8Array(16);
    crypto?.getRandomValues?.(bytes);
    // 设置 v4/variant 位（若 getRandomValues 不可用，这步也安全跳过）
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `uid-${Date.now()}-${(Math.random() * 1000).toFixed()}`;
  }
}
