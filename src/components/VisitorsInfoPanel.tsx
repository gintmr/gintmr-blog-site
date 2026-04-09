import React from "react";
import {
  getVisitorSessionsSecure,
  getVisitorsOverviewSecure,
  type VisitorSessionRow,
  type VisitorsOverview,
} from "@/db/supabase";
import { UI_LOCALE } from "@/i18n/ui";

const STORAGE_KEY = "visitors-info-password";
const VISITOR_ALIAS_STORAGE_KEY = "visitors-info-aliases";
const ROW_LIMIT = 1400;
const SESSION_PAGE_SIZE = 20;

type TimeRange = "all" | "today" | "7d" | "30d";
type PageType = "all" | "blog" | "story" | "diary" | "visitors" | "other";
type DeviceFilter = "all" | "Desktop" | "Mobile" | "Tablet";
type VisitorTypeFilter = "all" | "new" | "returning" | "suspicious";
type SortMode = "latest" | "longest-dwell" | "most-suspicious";

type SuspicionResult = {
  score: number;
  level: "low" | "watch" | "high";
  reasons: string[];
};

type DecoratedSession = VisitorSessionRow & {
  sessionKey: string;
  pageType: PageType;
  decodedPath: string;
  locationLabel: string;
  isReturning: boolean;
  isNewVisitor: boolean;
  suspicion: SuspicionResult;
  displayVisitor: string;
  alias: string | null;
};

type ChartDatum = {
  label: string;
  count: number;
  meta?: string;
};

type GeoPoint = {
  label: string;
  latitude: number;
  longitude: number;
  count: number;
};

const UI_TEXT =
  UI_LOCALE === "zh-CN"
    ? {
        title: "访客情报台",
        subtitle:
          "受密码保护的站点观察面板，融合摘要、地理、行为、风险和访客路径分析。",
        passwordPlaceholder: "请输入访问密码",
        unlock: "解锁",
        loading: "加载中...",
        remember: "记住密码（当前设备）",
        refresh: "刷新数据",
        wrongPassword: "密码错误或无权限，请重试。",
        setupMissing: "数据库函数未部署完整，请先执行最新 supabase-schema.sql。",
        permissionDenied:
          "数据库权限未授予完整，请重新执行 supabase-schema.sql 中的 GRANT 段落。",
        envMissing:
          "站点未正确配置 Supabase 环境变量（SUPABASE_URL/SUPABASE_KEY）。",
        networkFail: "网络请求失败，请稍后重试。",
        debugPrefix: "调试信息",
        empty: "暂无访客记录。",
        filtersTitle: "筛选器",
        moreFilters: "更多筛选",
        hideFilters: "收起筛选",
        insightsTitle: "自动洞察",
        chartsTitle: "流量拆解",
        geoTitle: "地理分布",
        behaviorTitle: "行为信号",
        sessionsTitle: "最近会话",
        detailsTitle: "访客画像",
        timelineTitle: "访问链路",
        aliasTitle: "访客别名",
        aliasPlaceholder: "例如：我自己 / 主力电脑 / iPhone",
        aliasSave: "保存别名",
        aliasRemove: "删除别名",
        paginationPrev: "上一页",
        paginationNext: "下一页",
        paginationSummary: "第 {current} / {total} 页",
        selectedHint: "当前选中记录",
        revealIp: "显示完整 IP",
        hideIp: "隐藏完整 IP",
        overview: {
          totalViews: "总浏览量",
          totalVisitors: "总访客数",
          totalSessions: "总会话数",
          avgViews: "人均浏览",
          avgDwell: "平均停留",
          returningRate: "回访占比",
          newVisitors7d: "近 7 天新访客",
          lastVisit: "最近访问",
        },
        filters: {
          period: "时间范围",
          pageType: "页面类型",
          device: "设备",
          deviceId: "设备标识",
          visitorType: "访客类型",
          sort: "排序",
          keyword: "关键词",
          location: "地区关键词",
          alias: "访客别名",
        },
        filterOptions: {
          all: "全部",
          today: "今天",
          days7: "7 天",
          days30: "30 天",
          blog: "Blog",
          story: "Story",
          diary: "Diary",
          visitors: "Visitors Info",
          other: "Other",
          desktop: "Desktop",
          mobile: "Mobile",
          tablet: "Tablet",
          newVisitor: "新访客",
          returning: "回访访客",
          suspicious: "可疑访客",
          latest: "最新访问",
          longestDwell: "停留最长",
          mostSuspicious: "风险最高",
        },
        charts: {
          countries: "国家 / 地区分布",
          cities: "城市 Top 榜",
          devices: "设备与系统",
          pages: "热门页面",
          dwellPages: "深读页面",
          hours: "访问时段热力图",
        },
        metrics: {
          sessions: "会话",
          visitors: "访客",
          dwell: "停留",
          firstSeen: "首次出现",
          lastSeen: "最后活跃",
          visitPath: "访问链路",
          fullUrl: "完整路径",
          decodedUrl: "解码路径",
          referrer: "来源",
          ip: "IP",
          geo: "地理位置",
          network: "网络情报",
          environment: "设备环境",
          behavior: "行为画像",
          suspiciousReason: "风险标记",
          noReferrer: "直接访问",
          noSignals: "暂无明显异常",
          mapHint: "地图为经纬度散点投影，适合快速查看热点和异常落点。",
        },
        insights: {
          audience: "Audience",
          geography: "Geography",
          timing: "Timing",
          content: "Content",
          anomaly: "Anomaly",
        },
        labels: {
          suspiciousSessions: "可疑会话",
          longestDwell: "最长停留",
          mostActiveVisitor: "最活跃访客",
          deepestReader: "最深阅读者",
          bounceRate: "跳出会话",
          engagedSessions: "深度会话",
          hiddenHeavy: "后台停留偏高",
          mapEmpty: "当前数据缺少经纬度，地图会在新数据进入后逐步丰富。",
          direct: "直接访问",
          unknown: "未知",
        },
      }
    : {
        title: "Visitors Intelligence",
        subtitle:
          "A password-protected dashboard combining summaries, geography, behavior, risk, and visitor journey analysis.",
        passwordPlaceholder: "Enter password",
        unlock: "Unlock",
        loading: "Loading...",
        remember: "Remember password on this device",
        refresh: "Refresh",
        wrongPassword: "Wrong password or unauthorized.",
        setupMissing:
          "Database functions are not fully deployed. Run the latest supabase-schema.sql.",
        permissionDenied:
          "Database permissions are missing. Re-run the grants in supabase-schema.sql.",
        envMissing:
          "Supabase environment variables are missing (SUPABASE_URL/SUPABASE_KEY).",
        networkFail: "Network request failed. Please try again later.",
        debugPrefix: "Debug",
        empty: "No visitor records yet.",
        filtersTitle: "Filters",
        moreFilters: "More filters",
        hideFilters: "Hide filters",
        insightsTitle: "Insights",
        chartsTitle: "Traffic Breakdown",
        geoTitle: "Geo Radar",
        behaviorTitle: "Behavior Signals",
        sessionsTitle: "Recent Sessions",
        detailsTitle: "Visitor Profile",
        timelineTitle: "Journey",
        aliasTitle: "Visitor alias",
        aliasPlaceholder: "For example: Me / Main laptop / iPhone",
        aliasSave: "Save alias",
        aliasRemove: "Remove alias",
        paginationPrev: "Previous",
        paginationNext: "Next",
        paginationSummary: "Page {current} / {total}",
        selectedHint: "Selected record",
        revealIp: "Reveal full IP",
        hideIp: "Hide full IP",
        overview: {
          totalViews: "Total Views",
          totalVisitors: "Total Visitors",
          totalSessions: "Total Sessions",
          avgViews: "Avg Views / Visitor",
          avgDwell: "Avg Dwell",
          returningRate: "Returning Rate",
          newVisitors7d: "New Visitors (7d)",
          lastVisit: "Last Visit",
        },
        filters: {
          period: "Period",
          pageType: "Page Type",
          device: "Device",
          deviceId: "Device identifier",
          visitorType: "Visitor Type",
          sort: "Sort",
          keyword: "Keyword",
          location: "Location keyword",
          alias: "Visitor alias",
        },
        filterOptions: {
          all: "All",
          today: "Today",
          days7: "7d",
          days30: "30d",
          blog: "Blog",
          story: "Story",
          diary: "Diary",
          visitors: "Visitors Info",
          other: "Other",
          desktop: "Desktop",
          mobile: "Mobile",
          tablet: "Tablet",
          newVisitor: "New",
          returning: "Returning",
          suspicious: "Suspicious",
          latest: "Latest",
          longestDwell: "Longest dwell",
          mostSuspicious: "Highest risk",
        },
        charts: {
          countries: "Country / region mix",
          cities: "Top cities",
          devices: "Devices and systems",
          pages: "Top pages",
          dwellPages: "Deep-read pages",
          hours: "Visits by hour",
        },
        metrics: {
          sessions: "Sessions",
          visitors: "Visitors",
          dwell: "Dwell",
          firstSeen: "First seen",
          lastSeen: "Last seen",
          visitPath: "Visit path",
          fullUrl: "Full path",
          decodedUrl: "Decoded path",
          referrer: "Referrer",
          ip: "IP",
          geo: "Location",
          network: "Network intel",
          environment: "Environment",
          behavior: "Behavior",
          suspiciousReason: "Risk flags",
          noReferrer: "Direct",
          noSignals: "No obvious anomaly",
          mapHint:
            "The map uses latitude/longitude point projection to surface hotspots and odd outliers quickly.",
        },
        insights: {
          audience: "Audience",
          geography: "Geography",
          timing: "Timing",
          content: "Content",
          anomaly: "Anomaly",
        },
        labels: {
          suspiciousSessions: "Suspicious sessions",
          longestDwell: "Longest dwell",
          mostActiveVisitor: "Most active visitor",
          deepestReader: "Deepest reader",
          bounceRate: "Bounce sessions",
          engagedSessions: "Engaged sessions",
          hiddenHeavy: "Background-heavy sessions",
          mapEmpty:
            "No coordinates yet. The map will become richer as new geo-enriched sessions arrive.",
          direct: "Direct",
          unknown: "Unknown",
        },
      };

function safeDisplay(value: string | null | undefined, fallback = "--") {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : fallback;
}

function formatTime(value: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString(UI_LOCALE === "zh-CN" ? "zh-CN" : "en-US", {
    hour12: false,
  });
}

function formatDwell(seconds: number | null | undefined) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  if (safe < 60) return `${safe}s`;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString();
}

function maskVisitorHash(value: string) {
  if (!value) return "--";
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatTemplate(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

function readVisitorAliases() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    const raw = window.localStorage.getItem(VISITOR_ALIAS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeVisitorAliases(next: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VISITOR_ALIAS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function getVisitorDisplayName(visitorHash: string, aliasMap: Record<string, string>) {
  const alias = aliasMap[visitorHash]?.trim();
  return alias || maskVisitorHash(visitorHash);
}

function maskIp(ip: string | null) {
  const text = safeDisplay(ip, "");
  if (!text) return "--";
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const matched = text.match(v4);
  if (!matched) return text;
  return `${matched[1]}.${matched[2]}.*.*`;
}

function decodePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function getPageType(path: string): PageType {
  if (path.startsWith("/blog")) return "blog";
  if (path.startsWith("/story")) return "story";
  if (path.startsWith("/diary")) return "diary";
  if (path.startsWith("/visitors_info")) return "visitors";
  return "other";
}

function getLocationLabel(row: Pick<VisitorSessionRow, "country" | "region" | "city">) {
  return [row.country, row.region, row.city]
    .map(value => safeDisplay(value, ""))
    .filter(Boolean)
    .join(" / ");
}

function getHourBucket(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? -1 : date.getHours();
}

function getVisitorFirstSeenMap(rows: VisitorSessionRow[]) {
  const map = new Map<string, number>();
  rows.forEach(row => {
    const time = new Date(row.visit_started_at).getTime();
    if (Number.isNaN(time)) return;
    const prev = map.get(row.visitor_hash);
    if (prev == null || time < prev) map.set(row.visitor_hash, time);
  });
  return map;
}

function getVisitorSessionCountMap(rows: VisitorSessionRow[]) {
  const map = new Map<string, number>();
  rows.forEach(row => {
    map.set(row.visitor_hash, (map.get(row.visitor_hash) ?? 0) + 1);
  });
  return map;
}

function getSuspicion(row: VisitorSessionRow, sessionCount: number): SuspicionResult {
  let score = 0;
  const reasons: string[] = [];

  if ((row.dwell_seconds ?? 0) === 0) {
    score += 2;
    reasons.push("zero-dwell");
  }

  if ((row.referrer ?? "").trim() === "") {
    score += 1;
    reasons.push("no-referrer");
  }

  const orgText = `${row.org ?? ""} ${row.asn ?? ""}`.toLowerCase();
  if (
    /(vpn|proxy|hosting|cloud|data center|datacenter|server|digitalocean|amazon|aws|google|oracle|microsoft|azure|linode|ovh|vultr|colo|cdn)/.test(
      orgText
    )
  ) {
    score += 3;
    reasons.push("network-provider");
  }

  const ua = (row.user_agent ?? "").toLowerCase();
  if (
    /(bot|spider|crawler|headless|python|curl|wget|scrapy|selenium|playwright|puppeteer)/.test(
      ua
    )
  ) {
    score += 4;
    reasons.push("automation-ua");
  }

  if (
    (row.language ?? "").trim() &&
    (row.timezone ?? "").trim() &&
    row.ip_timezone &&
    row.timezone !== row.ip_timezone
  ) {
    score += 1;
    reasons.push("timezone-mismatch");
  }

  if (sessionCount >= 8 && (row.dwell_seconds ?? 0) <= 3) {
    score += 2;
    reasons.push("many-short-sessions");
  }

  if ((row.max_scroll_percent ?? 0) < 5 && (row.interaction_count ?? 0) <= 1) {
    score += 1;
    reasons.push("low-engagement");
  }

  const level = score >= 6 ? "high" : score >= 3 ? "watch" : "low";
  return { score, level, reasons };
}

function aggregateCount(
  rows: DecoratedSession[],
  resolver: (row: DecoratedSession) => string,
  limit: number
): ChartDatum[] {
  const counts = new Map<string, number>();
  rows.forEach(row => {
    const label = resolver(row).trim() || UI_TEXT.labels.unknown;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function aggregateDwell(rows: DecoratedSession[], limit: number): ChartDatum[] {
  const totals = new Map<string, number>();
  rows.forEach(row => {
    const label = row.decodedPath;
    totals.set(label, (totals.get(label) ?? 0) + (row.dwell_seconds ?? 0));
  });

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count, meta: formatDwell(count) }));
}

function getTopHour(rows: DecoratedSession[]) {
  const counts = new Map<number, number>();
  rows.forEach(row => {
    const hour = getHourBucket(row.last_seen_at);
    if (hour >= 0) counts.set(hour, (counts.get(hour) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
}

function buildVisitorJourney(rows: DecoratedSession[], visitorHash: string) {
  return rows
    .filter(row => row.visitor_hash === visitorHash)
    .sort(
      (a, b) => Date.parse(a.last_seen_at) - Date.parse(b.last_seen_at)
    );
}

function getRiskTone(level: SuspicionResult["level"]) {
  if (level === "high") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  if (level === "watch") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function formatRiskReasons(reasons: string[]) {
  const labels: Record<string, string> =
    UI_LOCALE === "zh-CN"
      ? {
          "zero-dwell": "停留 0s",
          "no-referrer": "无来源",
          "network-provider": "疑似代理 / 机房 / 中转网络",
          "automation-ua": "UA 含自动化特征",
          "timezone-mismatch": "浏览器时区与 IP 时区不一致",
          "many-short-sessions": "多次极短访问",
          "low-engagement": "滚动与交互极低",
        }
      : {
          "zero-dwell": "0s dwell",
          "no-referrer": "no referrer",
          "network-provider": "proxy / hosting / transit provider signal",
          "automation-ua": "automation-style user agent",
          "timezone-mismatch": "browser timezone != IP timezone",
          "many-short-sessions": "many very short sessions",
          "low-engagement": "very low scroll / interaction",
        };

  return reasons.map(reason => labels[reason] ?? reason).join(", ");
}

function buildGeoPoints(rows: DecoratedSession[]): GeoPoint[] {
  const grouped = new Map<
    string,
    { latitude: number; longitude: number; count: number; label: string }
  >();

  rows.forEach(row => {
    if (row.latitude == null || row.longitude == null) return;
    const lat = row.latitude;
    const lon = row.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const label = row.locationLabel || row.decodedPath;
    const key = `${lat.toFixed(2)}:${lon.toFixed(2)}:${label}`;
    const prev = grouped.get(key);
    if (prev) {
      prev.count += 1;
      return;
    }

    grouped.set(key, {
      latitude: lat,
      longitude: lon,
      count: 1,
      label,
    });
  });

  return [...grouped.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

function resolveErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = message.toLowerCase();

  if (lower.includes("invalid visitors_info password") || lower.includes("28000")) {
    return { userMessage: UI_TEXT.wrongPassword, debug: message };
  }

  if (
    lower.includes("does not exist") ||
    lower.includes("42883") ||
    lower.includes("get_visitors_overview_secure")
  ) {
    return { userMessage: UI_TEXT.setupMissing, debug: message };
  }

  if (lower.includes("permission denied") || lower.includes("42501")) {
    return { userMessage: UI_TEXT.permissionDenied, debug: message };
  }

  if (
    lower.includes("supabase client not initialized") ||
    lower.includes("apikey") ||
    lower.includes("invalid api key")
  ) {
    return { userMessage: UI_TEXT.envMissing, debug: message };
  }

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return { userMessage: UI_TEXT.networkFail, debug: message };
  }

  return { userMessage: UI_TEXT.wrongPassword, debug: message };
}

const VisitorsInfoPanel: React.FC = () => {
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [debugError, setDebugError] = React.useState("");
  const [unlocked, setUnlocked] = React.useState(false);
  const [overview, setOverview] = React.useState<VisitorsOverview | null>(null);
  const [rows, setRows] = React.useState<VisitorSessionRow[]>([]);
  const [timeRange, setTimeRange] = React.useState<TimeRange>("all");
  const [pageType, setPageType] = React.useState<PageType>("all");
  const [deviceFilter, setDeviceFilter] = React.useState<DeviceFilter>("all");
  const [visitorType, setVisitorType] =
    React.useState<VisitorTypeFilter>("all");
  const [sortMode, setSortMode] = React.useState<SortMode>("latest");
  const [keyword, setKeyword] = React.useState("");
  const [locationKeyword, setLocationKeyword] = React.useState("");
  const [deviceIdentifierKeyword, setDeviceIdentifierKeyword] = React.useState("");
  const [aliasKeyword, setAliasKeyword] = React.useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);
  const [selectedSessionId, setSelectedSessionId] = React.useState<
    string | null
  >(null);
  const [revealedIpIds, setRevealedIpIds] = React.useState<string[]>([]);
  const [visitorAliases, setVisitorAliases] = React.useState<Record<string, string>>({});
  const [aliasInput, setAliasInput] = React.useState("");
  const [sessionPage, setSessionPage] = React.useState(1);

  const loadData = React.useCallback(
    async (pass: string) => {
      setLoading(true);
      setError("");
      setDebugError("");
      try {
        const [nextOverview, nextRows] = await Promise.all([
          getVisitorsOverviewSecure(pass),
          getVisitorSessionsSecure(pass, { limit: ROW_LIMIT }),
        ]);

        setOverview(nextOverview);
        setRows(nextRows);
        setUnlocked(true);

        if (remember) {
          localStorage.setItem(STORAGE_KEY, pass);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (loadError) {
        const resolved = resolveErrorMessage(loadError);
        setUnlocked(false);
        setOverview(null);
        setRows([]);
        setError(resolved.userMessage);
        setDebugError(resolved.debug);
      } finally {
        setLoading(false);
      }
    },
    [remember]
  );

  React.useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY) || "";
      if (cached) {
        setPassword(cached);
        void loadData(cached);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [loadData]);

  React.useEffect(() => {
    setVisitorAliases(readVisitorAliases());
  }, []);

  const visitorFirstSeenMap = React.useMemo(() => getVisitorFirstSeenMap(rows), [rows]);
  const visitorSessionCountMap = React.useMemo(
    () => getVisitorSessionCountMap(rows),
    [rows]
  );

  const decoratedRows = React.useMemo<DecoratedSession[]>(() => {
    return rows.map(row => {
      const sessionKey = `${row.page_path}:${row.visitor_hash}:${row.session_id}`;
      const suspicion = getSuspicion(
        row,
        visitorSessionCountMap.get(row.visitor_hash) ?? 1
      );
      const alias = visitorAliases[row.visitor_hash]?.trim() || null;

      return {
        ...row,
        sessionKey,
        pageType: getPageType(row.page_path),
        decodedPath: decodePath(row.page_path),
        locationLabel: getLocationLabel(row),
        isReturning: (visitorSessionCountMap.get(row.visitor_hash) ?? 0) > 1,
        isNewVisitor:
          (visitorFirstSeenMap.get(row.visitor_hash) ?? Number.MAX_SAFE_INTEGER) >=
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        suspicion,
        displayVisitor: alias || maskVisitorHash(row.visitor_hash),
        alias,
      };
    });
  }, [rows, visitorAliases, visitorFirstSeenMap, visitorSessionCountMap]);

  const filteredRows = React.useMemo(() => {
    const now = Date.now();
    const keywordLower = keyword.trim().toLowerCase();
    const locationLower = locationKeyword.trim().toLowerCase();
    const deviceIdentifierLower = deviceIdentifierKeyword.trim().toLowerCase();
    const aliasLower = aliasKeyword.trim().toLowerCase();

    const result = decoratedRows.filter(row => {
      const seenAt = new Date(row.last_seen_at).getTime();
      if (timeRange === "today" && seenAt < now - 24 * 60 * 60 * 1000) return false;
      if (timeRange === "7d" && seenAt < now - 7 * 24 * 60 * 60 * 1000) return false;
      if (timeRange === "30d" && seenAt < now - 30 * 24 * 60 * 60 * 1000) return false;

      if (pageType !== "all" && row.pageType !== pageType) return false;
      if (deviceFilter !== "all" && row.device_type !== deviceFilter) return false;
      if (visitorType === "new" && !row.isNewVisitor) return false;
      if (visitorType === "returning" && !row.isReturning) return false;
      if (visitorType === "suspicious" && row.suspicion.score < 3) return false;

      if (keywordLower) {
        const haystack = [
          row.page_path,
          row.decodedPath,
          row.visitor_hash,
          row.ip_address ?? "",
          row.referrer ?? "",
          row.org ?? "",
          row.asn ?? "",
          row.user_agent ?? "",
          row.displayVisitor,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keywordLower)) return false;
      }

      if (locationLower) {
        const geo = `${row.country ?? ""} ${row.region ?? ""} ${row.city ?? ""}`.toLowerCase();
        if (!geo.includes(locationLower)) return false;
      }

      if (deviceIdentifierLower) {
        const identifier = `${row.visitor_hash} ${row.session_id} ${row.displayVisitor}`.toLowerCase();
        if (!identifier.includes(deviceIdentifierLower)) return false;
      }

      if (aliasLower) {
        const aliasText = (row.alias ?? "").toLowerCase();
        if (!aliasText.includes(aliasLower)) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortMode === "longest-dwell") {
        return (b.dwell_seconds ?? 0) - (a.dwell_seconds ?? 0);
      }

      if (sortMode === "most-suspicious") {
        return (
          b.suspicion.score - a.suspicion.score ||
          Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at)
        );
      }

      return Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at);
    });

    return result;
  }, [
    decoratedRows,
    deviceFilter,
    deviceIdentifierKeyword,
    keyword,
    aliasKeyword,
    locationKeyword,
    pageType,
    sortMode,
    timeRange,
    visitorType,
  ]);

  React.useEffect(() => {
    if (!selectedSessionId && filteredRows[0]) {
      setSelectedSessionId(filteredRows[0].sessionKey);
      return;
    }

    if (
      selectedSessionId &&
      !filteredRows.some(row => row.sessionKey === selectedSessionId)
    ) {
      setSelectedSessionId(filteredRows[0]?.sessionKey ?? null);
    }
  }, [filteredRows, selectedSessionId]);

  const selectedSession = React.useMemo(
    () =>
      filteredRows.find(row => row.sessionKey === selectedSessionId) ??
      filteredRows[0] ??
      null,
    [filteredRows, selectedSessionId]
  );

  React.useEffect(() => {
    setSessionPage(1);
  }, [timeRange, pageType, deviceFilter, visitorType, sortMode, keyword, locationKeyword, deviceIdentifierKeyword, aliasKeyword]);

  React.useEffect(() => {
    setAliasInput(selectedSession?.alias ?? "");
  }, [selectedSession]);

  const totalSessionPages = Math.max(1, Math.ceil(filteredRows.length / SESSION_PAGE_SIZE));

  React.useEffect(() => {
    if (sessionPage > totalSessionPages) {
      setSessionPage(totalSessionPages);
    }
  }, [sessionPage, totalSessionPages]);

  const pagedRows = React.useMemo(() => {
    const start = (sessionPage - 1) * SESSION_PAGE_SIZE;
    return filteredRows.slice(start, start + SESSION_PAGE_SIZE);
  }, [filteredRows, sessionPage]);

  const averageViews =
    overview && overview.total_visitors > 0
      ? (overview.total_views / overview.total_visitors).toFixed(2)
      : "--";

  const returningRate =
    overview && overview.total_visitors > 0
      ? (overview.returning_visitors / overview.total_visitors) * 100
      : 0;

  const bounceSessions = React.useMemo(
    () =>
      filteredRows.filter(
        row => (row.dwell_seconds ?? 0) <= 3 && (row.max_scroll_percent ?? 0) < 10
      ),
    [filteredRows]
  );
  const engagedSessions = React.useMemo(
    () =>
      filteredRows.filter(
        row =>
          (row.dwell_seconds ?? 0) >= 45 ||
          (row.max_scroll_percent ?? 0) >= 60 ||
          (row.interaction_count ?? 0) >= 4
      ),
    [filteredRows]
  );
  const hiddenHeavySessions = React.useMemo(
    () =>
      filteredRows.filter(
        row =>
          (row.hidden_seconds ?? 0) > 0 &&
          (row.hidden_seconds ?? 0) > (row.visible_seconds ?? 0)
      ),
    [filteredRows]
  );

  const countryChart = React.useMemo(
    () => aggregateCount(filteredRows, row => row.country || row.region || UI_TEXT.labels.unknown, 6),
    [filteredRows]
  );
  const cityChart = React.useMemo(
    () => aggregateCount(filteredRows, row => row.city || row.region || row.country || UI_TEXT.labels.unknown, 8),
    [filteredRows]
  );
  const deviceChart = React.useMemo(
    () =>
      aggregateCount(
        filteredRows,
        row =>
          [row.device_type, row.os]
            .map(item => safeDisplay(item, ""))
            .filter(Boolean)
            .join(" / ") || UI_TEXT.labels.unknown,
        6
      ),
    [filteredRows]
  );
  const pageChart = React.useMemo(
    () => aggregateCount(filteredRows, row => row.decodedPath, 6),
    [filteredRows]
  );
  const dwellPageChart = React.useMemo(
    () => aggregateDwell(filteredRows, 6),
    [filteredRows]
  );
  const geoPoints = React.useMemo(() => buildGeoPoints(filteredRows), [filteredRows]);

  const hourlyBuckets = React.useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    filteredRows.forEach(row => {
      const hour = getHourBucket(row.last_seen_at);
      if (hour >= 0) buckets[hour].count += 1;
    });
    return buckets;
  }, [filteredRows]);

  const insights = React.useMemo(() => {
    if (filteredRows.length === 0) return [];

    const topCountry = countryChart[0];
    const topPage = pageChart[0];
    const topHour = getTopHour(filteredRows);
    const suspiciousCount = filteredRows.filter(row => row.suspicion.score >= 3).length;
    const desktopCount = filteredRows.filter(row => row.device_type === "Desktop").length;

    return [
      {
        label: UI_TEXT.insights.audience,
        text: `${formatPercent((desktopCount / filteredRows.length) * 100)} ${
          UI_LOCALE === "zh-CN"
            ? "的会话来自桌面端，移动端更像零碎浏览。"
            : "of sessions come from desktop devices, while mobile looks more glance-based."
        }`,
      },
      {
        label: UI_TEXT.insights.geography,
        text: topCountry
          ? `${
              UI_LOCALE === "zh-CN" ? "当前最活跃来源地区是" : "The most active source region is"
            } ${topCountry.label} (${topCountry.count}).`
          : UI_TEXT.empty,
      },
      {
        label: UI_TEXT.insights.timing,
        text:
          topHour >= 0
            ? `${
                UI_LOCALE === "zh-CN" ? "访问高峰集中在" : "Peak activity clusters around"
              } ${String(topHour).padStart(2, "0")}:00.`
            : UI_TEXT.empty,
      },
      {
        label: UI_TEXT.insights.content,
        text: topPage
          ? `${
              UI_LOCALE === "zh-CN" ? "当前最受关注页面是" : "The hottest page right now is"
            } ${topPage.label}.`
          : UI_TEXT.empty,
      },
      {
        label: UI_TEXT.insights.anomaly,
        text:
          suspiciousCount > 0
            ? `${
                UI_LOCALE === "zh-CN"
                  ? "存在"
                  : "There are"
              } ${suspiciousCount} ${
                UI_LOCALE === "zh-CN"
                  ? "条高风险会话，优先检查网络情报、时区冲突和访问链路。"
                  : "high-risk sessions. Start with network intel, timezone mismatches, and the visit journey."
              }`
            : UI_TEXT.metrics.noSignals,
      },
    ];
  }, [countryChart, filteredRows, pageChart]);

  const highlightStats = React.useMemo(() => {
    const suspiciousRows = filteredRows.filter(row => row.suspicion.score >= 3);
    const longestDwell = filteredRows.slice().sort((a, b) => b.dwell_seconds - a.dwell_seconds)[0];
    const mostActiveVisitorEntry = [...visitorSessionCountMap.entries()].sort((a, b) => b[1] - a[1])[0];
    const deepestReader = filteredRows
      .slice()
      .sort(
        (a, b) =>
          (b.max_scroll_percent ?? 0) - (a.max_scroll_percent ?? 0) ||
          (b.interaction_count ?? 0) - (a.interaction_count ?? 0) ||
          b.dwell_seconds - a.dwell_seconds
      )[0];

    return {
      suspiciousCount: suspiciousRows.length,
      longestDwell,
      mostActiveVisitor: mostActiveVisitorEntry,
      deepestReader,
    };
  }, [filteredRows, visitorSessionCountMap]);

  const selectedJourney = React.useMemo(
    () =>
      selectedSession ? buildVisitorJourney(filteredRows, selectedSession.visitor_hash) : [],
    [filteredRows, selectedSession]
  );

  const toggleIpReveal = (sessionKey: string) => {
    setRevealedIpIds(current =>
      current.includes(sessionKey)
        ? current.filter(item => item !== sessionKey)
        : [...current, sessionKey]
    );
  };

  const saveAlias = React.useCallback(() => {
    if (!selectedSession) return;
    const nextValue = aliasInput.trim();
    setVisitorAliases(current => {
      const next = { ...current };
      if (nextValue) {
        next[selectedSession.visitor_hash] = nextValue;
      } else {
        delete next[selectedSession.visitor_hash];
      }
      writeVisitorAliases(next);
      return next;
    });
  }, [aliasInput, selectedSession]);

  const removeAlias = React.useCallback(() => {
    if (!selectedSession) return;
    setAliasInput("");
    setVisitorAliases(current => {
      const next = { ...current };
      delete next[selectedSession.visitor_hash];
      writeVisitorAliases(next);
      return next;
    });
  }, [selectedSession]);

  return (
    <section className="visitors-panel rounded-[2rem] border border-border/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 shadow-[0_25px_90px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-accent sm:text-3xl">
          {UI_TEXT.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-skin-base/75">
          {UI_TEXT.subtitle}
        </p>
      </header>

      {!unlocked && (
        <>
          <form
            className="mb-4 flex flex-col gap-3 md:flex-row md:items-center"
            onSubmit={event => {
              event.preventDefault();
              if (!password.trim()) return;
              void loadData(password.trim());
            }}
          >
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={UI_TEXT.passwordPlaceholder}
              className="w-full rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm outline-none ring-accent/40 focus:ring-2 md:max-w-md"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-skin-inverted transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? UI_TEXT.loading : UI_TEXT.unlock}
            </button>
          </form>

          <label className="inline-flex items-center gap-2 text-xs text-skin-base/70">
            <input
              type="checkbox"
              checked={remember}
              onChange={event => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-border bg-background accent-accent"
            />
            {UI_TEXT.remember}
          </label>
        </>
      )}

      {error && (
        <p className="mb-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          {debugError && (
            <span className="mt-1 block text-xs text-red-300/90">
              {UI_TEXT.debugPrefix}: {debugError}
            </span>
          )}
        </p>
      )}

      {unlocked && (
        <>
          <div className="mb-5 flex items-center justify-end">
            <button
              type="button"
              onClick={() => void loadData(password.trim())}
              disabled={loading}
              className="rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? UI_TEXT.loading : UI_TEXT.refresh}
            </button>
          </div>

          <div className="mb-8 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={UI_TEXT.overview.totalViews} value={formatNumber(overview?.total_views)} />
            <StatCard label={UI_TEXT.overview.totalVisitors} value={formatNumber(overview?.total_visitors)} />
            <StatCard label={UI_TEXT.overview.totalSessions} value={formatNumber(overview?.total_sessions)} />
            <StatCard label={UI_TEXT.overview.avgViews} value={averageViews} />
            <StatCard label={UI_TEXT.overview.avgDwell} value={formatDwell(overview?.avg_dwell_seconds)} />
            <StatCard label={UI_TEXT.overview.returningRate} value={formatPercent(returningRate)} />
            <StatCard label={UI_TEXT.overview.newVisitors7d} value={formatNumber(overview?.new_visitors_7d)} />
            <StatCard label={UI_TEXT.overview.lastVisit} value={formatTime(overview?.last_visit_at ?? null)} />
          </div>

          <section className="mb-8 rounded-[1.35rem] border border-border/40 bg-background/40 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-skin-base">{UI_TEXT.filtersTitle}</h3>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(value => !value)}
                className="text-xs text-accent transition hover:opacity-80"
              >
                {showAdvancedFilters ? UI_TEXT.hideFilters : UI_TEXT.moreFilters}
              </button>
            </div>

            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
              <FilterSelect
                label={UI_TEXT.filters.period}
                value={timeRange}
                onChange={value => setTimeRange(value as TimeRange)}
                options={[
                  ["all", UI_TEXT.filterOptions.all],
                  ["today", UI_TEXT.filterOptions.today],
                  ["7d", UI_TEXT.filterOptions.days7],
                  ["30d", UI_TEXT.filterOptions.days30],
                ]}
              />
              <FilterSelect
                label={UI_TEXT.filters.pageType}
                value={pageType}
                onChange={value => setPageType(value as PageType)}
                options={[
                  ["all", UI_TEXT.filterOptions.all],
                  ["blog", UI_TEXT.filterOptions.blog],
                  ["story", UI_TEXT.filterOptions.story],
                  ["diary", UI_TEXT.filterOptions.diary],
                  ["visitors", UI_TEXT.filterOptions.visitors],
                  ["other", UI_TEXT.filterOptions.other],
                ]}
              />
              <FilterSelect
                label={UI_TEXT.filters.device}
                value={deviceFilter}
                onChange={value => setDeviceFilter(value as DeviceFilter)}
                options={[
                  ["all", UI_TEXT.filterOptions.all],
                  ["Desktop", UI_TEXT.filterOptions.desktop],
                  ["Mobile", UI_TEXT.filterOptions.mobile],
                  ["Tablet", UI_TEXT.filterOptions.tablet],
                ]}
              />
              <FilterSelect
                label={UI_TEXT.filters.visitorType}
                value={visitorType}
                onChange={value => setVisitorType(value as VisitorTypeFilter)}
                options={[
                  ["all", UI_TEXT.filterOptions.all],
                  ["new", UI_TEXT.filterOptions.newVisitor],
                  ["returning", UI_TEXT.filterOptions.returning],
                  ["suspicious", UI_TEXT.filterOptions.suspicious],
                ]}
              />
              <FilterSelect
                label={UI_TEXT.filters.sort}
                value={sortMode}
                onChange={value => setSortMode(value as SortMode)}
                options={[
                  ["latest", UI_TEXT.filterOptions.latest],
                  ["longest-dwell", UI_TEXT.filterOptions.longestDwell],
                  ["most-suspicious", UI_TEXT.filterOptions.mostSuspicious],
                ]}
              />
            </div>

            {showAdvancedFilters && (
              <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                <FilterInput
                  label={UI_TEXT.filters.keyword}
                  value={keyword}
                  onChange={setKeyword}
                  placeholder="page / visitor / IP / org / UA"
                />
                <FilterInput
                  label={UI_TEXT.filters.location}
                  value={locationKeyword}
                  onChange={setLocationKeyword}
                  placeholder="Hong Kong / Tokyo / Beijing"
                />
                <FilterInput
                  label={UI_TEXT.filters.deviceId}
                  value={deviceIdentifierKeyword}
                  onChange={setDeviceIdentifierKeyword}
                  placeholder="visitor hash / session id"
                />
                <FilterInput
                  label={UI_TEXT.filters.alias}
                  value={aliasKeyword}
                  onChange={setAliasKeyword}
                  placeholder="Me / iPhone / Test device"
                />
              </div>
            )}
          </section>

          {filteredRows.length === 0 ? (
            <p className="text-sm text-skin-base/75">{UI_TEXT.empty}</p>
          ) : (
            <>
              <section className="mb-8">
                <h3 className="mb-4 text-base font-semibold text-skin-base">{UI_TEXT.insightsTitle}</h3>
                <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                  {insights.map(card => (
                    <InsightPanel key={card.label} label={card.label} text={card.text} />
                  ))}
                </div>
              </section>

              <section className="mb-8">
                <h3 className="mb-4 text-base font-semibold text-skin-base">{UI_TEXT.chartsTitle}</h3>
                <div className="grid gap-3 xl:grid-cols-2">
                  <ChartCard title={UI_TEXT.charts.countries}>
                    <BarList data={countryChart} />
                  </ChartCard>
                  <ChartCard title={UI_TEXT.charts.cities}>
                    <BarList data={cityChart} />
                  </ChartCard>
                  <ChartCard title={UI_TEXT.charts.devices}>
                    <BarList data={deviceChart} truncateLabel />
                  </ChartCard>
                  <ChartCard title={UI_TEXT.charts.pages}>
                    <BarList data={pageChart} truncateLabel />
                  </ChartCard>
                  <ChartCard title={UI_TEXT.charts.dwellPages}>
                    <BarList data={dwellPageChart} truncateLabel />
                  </ChartCard>
                  <ChartCard title={UI_TEXT.charts.hours}>
                    <HourlyHeatStrip data={hourlyBuckets} />
                  </ChartCard>
                </div>
              </section>

              <section className="mb-8 grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
                <ChartCard title={UI_TEXT.geoTitle}>
                  <p className="mb-3 text-xs text-skin-base/65">{UI_TEXT.metrics.mapHint}</p>
                  <GeoRadarMap points={geoPoints} />
                </ChartCard>

                <ChartCard title={UI_TEXT.behaviorTitle}>
                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                    <HighlightCard
                      label={UI_TEXT.labels.bounceRate}
                      value={formatPercent((bounceSessions.length / filteredRows.length) * 100)}
                      detail={`${bounceSessions.length} ${UI_TEXT.metrics.sessions}`}
                    />
                    <HighlightCard
                      label={UI_TEXT.labels.engagedSessions}
                      value={formatPercent((engagedSessions.length / filteredRows.length) * 100)}
                      detail={`${engagedSessions.length} ${UI_TEXT.metrics.sessions}`}
                    />
                    <HighlightCard
                      label={UI_TEXT.labels.hiddenHeavy}
                      value={formatPercent((hiddenHeavySessions.length / filteredRows.length) * 100)}
                      detail={`${hiddenHeavySessions.length} ${UI_TEXT.metrics.sessions}`}
                    />
                  </div>
                </ChartCard>
              </section>

              <section className="mb-8 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                <HighlightCard
                  label={UI_TEXT.labels.suspiciousSessions}
                  value={String(highlightStats.suspiciousCount)}
                  detail={
                    UI_LOCALE === "zh-CN"
                      ? "包含代理/机房、自动化 UA、时区冲突等信号"
                      : "Includes hosting/proxy, automation UA, timezone mismatch, and short-session signals"
                  }
                />
                <HighlightCard
                  label={UI_TEXT.labels.longestDwell}
                  value={highlightStats.longestDwell ? formatDwell(highlightStats.longestDwell.dwell_seconds) : "--"}
                  detail={highlightStats.longestDwell?.decodedPath ?? "--"}
                />
                <HighlightCard
                  label={UI_TEXT.labels.mostActiveVisitor}
                  value={
                    highlightStats.mostActiveVisitor
                      ? getVisitorDisplayName(highlightStats.mostActiveVisitor[0], visitorAliases)
                      : "--"
                  }
                  detail={
                    highlightStats.mostActiveVisitor
                      ? `${highlightStats.mostActiveVisitor[1]} ${UI_TEXT.metrics.sessions}`
                      : "--"
                  }
                />
                <HighlightCard
                  label={UI_TEXT.labels.deepestReader}
                  value={highlightStats.deepestReader ? formatPercent(highlightStats.deepestReader.max_scroll_percent ?? 0) : "--"}
                  detail={
                    highlightStats.deepestReader
                      ? `${formatNumber(highlightStats.deepestReader.interaction_count)} interactions`
                      : "--"
                  }
                />
              </section>

              <section className="mb-8 rounded-[1.35rem] border border-border/40 bg-background/45 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-skin-base">{UI_TEXT.sessionsTitle}</h3>
                    <span className="text-xs text-skin-base/60">
                      {filteredRows.length} / {rows.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-skin-base/65">
                    <button
                      type="button"
                      onClick={() => setSessionPage(page => Math.max(1, page - 1))}
                      disabled={sessionPage <= 1}
                      className="rounded-full border border-border/40 px-3 py-1.5 transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {UI_TEXT.paginationPrev}
                    </button>
                    <span>
                      {formatTemplate(UI_TEXT.paginationSummary, {
                        current: sessionPage,
                        total: totalSessionPages,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSessionPage(page => Math.min(totalSessionPages, page + 1))}
                      disabled={sessionPage >= totalSessionPages}
                      className="rounded-full border border-border/40 px-3 py-1.5 transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {UI_TEXT.paginationNext}
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.15rem] border border-border/30 bg-background/40">
                  <div className="hidden grid-cols-[170px_minmax(320px,1.8fr)_180px_170px_90px_120px] gap-4 border-b border-border/25 bg-background/70 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-skin-base/45 xl:grid">
                    <span>{UI_TEXT.metrics.lastSeen}</span>
                    <span>{UI_TEXT.metrics.visitPath}</span>
                    <span>{UI_TEXT.filters.device}</span>
                    <span>{UI_TEXT.filters.deviceId}</span>
                    <span>{UI_TEXT.metrics.dwell}</span>
                    <span>{UI_TEXT.metrics.ip}</span>
                  </div>

                  <div className="divide-y divide-border/20">
                    {pagedRows.map(row => (
                      <button
                        key={row.sessionKey}
                        type="button"
                        onClick={() => setSelectedSessionId(row.sessionKey)}
                        className={`grid w-full gap-3 px-4 py-3 text-left transition xl:grid-cols-[170px_minmax(320px,1.8fr)_180px_170px_90px_120px] xl:items-center xl:gap-4 ${
                          selectedSessionId === row.sessionKey
                            ? "bg-accent/10"
                            : "bg-transparent hover:bg-background/70"
                        }`}
                      >
                        <div className="text-[12px] text-skin-base/62">{formatTime(row.last_seen_at)}</div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-skin-base">{row.decodedPath}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-skin-base/55">
                            <span>{row.locationLabel || "--"}</span>
                            <span>{formatPercent(row.max_scroll_percent ?? 0)} scroll</span>
                            <span>{formatNumber(row.interaction_count)} interactions</span>
                            {selectedSessionId === row.sessionKey ? <span className="text-accent">{UI_TEXT.selectedHint}</span> : null}
                          </div>
                        </div>
                        <div className="min-w-0 text-[12px] text-skin-base/72">
                          <div className="truncate">{[
                            safeDisplay(row.device_type, ""),
                            safeDisplay(row.os, ""),
                            safeDisplay(row.browser, ""),
                          ].filter(Boolean).join(" / ") || "--"}</div>
                          <div className="mt-1 truncate text-[11px] text-skin-base/52">{row.network_type || row.timezone || "--"}</div>
                        </div>
                        <div className="min-w-0 text-[12px] text-skin-base/72">
                          <div className="truncate">{row.displayVisitor}</div>
                          <div className="mt-1 truncate text-[11px] text-skin-base/52">{maskVisitorHash(row.visitor_hash)}</div>
                        </div>
                        <div className="text-[12px] text-skin-base/72">
                          <div>{formatDwell(row.dwell_seconds)}</div>
                          <div className="mt-1"><RiskPill suspicion={row.suspicion} compact /></div>
                        </div>
                        <div className="text-[12px] text-skin-base/72">{maskIp(row.ip_address)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/20 pt-3 text-xs text-skin-base/60">
                  <span>{formatTemplate(UI_TEXT.paginationSummary, { current: sessionPage, total: totalSessionPages })}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSessionPage(page => Math.max(1, page - 1))}
                      disabled={sessionPage <= 1}
                      className="rounded-full border border-border/40 px-3 py-1.5 transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {UI_TEXT.paginationPrev}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionPage(page => Math.min(totalSessionPages, page + 1))}
                      disabled={sessionPage >= totalSessionPages}
                      className="rounded-full border border-border/40 px-3 py-1.5 transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {UI_TEXT.paginationNext}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.35rem] border border-border/40 bg-background/45 p-4">
                <h3 className="mb-4 text-base font-semibold text-skin-base">{UI_TEXT.detailsTitle}</h3>

                {selectedSession ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                      <div className="space-y-3">
                        <DetailGroup label={UI_TEXT.metrics.fullUrl} value={selectedSession.page_path} mono />
                        <DetailGroup label={UI_TEXT.metrics.decodedUrl} value={selectedSession.decodedPath} />
                        <DetailGroup
                          label={UI_TEXT.metrics.referrer}
                          value={safeDisplay(selectedSession.referrer, UI_TEXT.labels.direct)}
                          mono
                        />
                      </div>

                      <div className="space-y-3">
                        <DetailGroup
                          label={UI_TEXT.aliasTitle}
                          value={selectedSession.displayVisitor}
                          action={
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={saveAlias}
                                className="text-xs text-accent"
                              >
                                {UI_TEXT.aliasSave}
                              </button>
                              {selectedSession.alias ? (
                                <button
                                  type="button"
                                  onClick={removeAlias}
                                  className="text-xs text-skin-base/65"
                                >
                                  {UI_TEXT.aliasRemove}
                                </button>
                              ) : null}
                            </div>
                          }
                        >
                          <input
                            value={aliasInput}
                            onChange={event => setAliasInput(event.target.value)}
                            placeholder={UI_TEXT.aliasPlaceholder}
                            className="mt-2 w-full rounded-xl border border-border/40 bg-background/70 px-3 py-2 text-[13px] text-skin-base outline-none ring-accent/40 focus:ring-2"
                          />
                        </DetailGroup>
                        <DetailGroup
                          label={UI_TEXT.metrics.ip}
                          value={
                            revealedIpIds.includes(selectedSession.sessionKey)
                              ? safeDisplay(selectedSession.ip_address)
                              : maskIp(selectedSession.ip_address)
                          }
                          action={
                            selectedSession.ip_address ? (
                              <button
                                type="button"
                                onClick={() => toggleIpReveal(selectedSession.sessionKey)}
                                className="text-xs text-accent"
                              >
                                {revealedIpIds.includes(selectedSession.sessionKey)
                                  ? UI_TEXT.hideIp
                                  : UI_TEXT.revealIp}
                              </button>
                            ) : undefined
                          }
                          mono
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <DetailGroup label={UI_TEXT.metrics.geo} value={selectedSession.locationLabel || "--"} />
                      <DetailGroup
                        label={UI_TEXT.metrics.network}
                        value={[
                          safeDisplay(selectedSession.org, ""),
                          safeDisplay(selectedSession.asn, ""),
                          safeDisplay(selectedSession.ip_timezone, ""),
                        ]
                          .filter(Boolean)
                          .join(" / ") || "--"}
                      />
                      <DetailGroup
                        label={UI_TEXT.metrics.environment}
                        value={[
                          safeDisplay(selectedSession.device_type, ""),
                          safeDisplay(selectedSession.os, ""),
                          safeDisplay(selectedSession.browser, ""),
                          safeDisplay(selectedSession.language, ""),
                          safeDisplay(selectedSession.timezone, ""),
                          safeDisplay(selectedSession.network_type, ""),
                          selectedSession.color_scheme ? `${selectedSession.color_scheme} scheme` : "",
                        ]
                          .filter(Boolean)
                          .join(" / ") || "--"}
                      />
                      <DetailGroup
                        label={UI_TEXT.metrics.behavior}
                        value={[
                          `${formatPercent(selectedSession.max_scroll_percent ?? 0)} scroll`,
                          `${formatNumber(selectedSession.interaction_count)} interactions`,
                          `${formatNumber(selectedSession.heartbeat_count)} heartbeats`,
                          `${formatDwell(selectedSession.visible_seconds)} visible`,
                          `${formatDwell(selectedSession.hidden_seconds)} hidden`,
                          selectedSession.screen_width && selectedSession.screen_height
                            ? `${selectedSession.screen_width}x${selectedSession.screen_height} screen`
                            : "",
                          selectedSession.viewport_width && selectedSession.viewport_height
                            ? `${selectedSession.viewport_width}x${selectedSession.viewport_height} viewport`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      />
                      <DetailGroup
                        label={UI_TEXT.metrics.suspiciousReason}
                        value={
                          selectedSession.suspicion.reasons.length > 0
                            ? formatRiskReasons(selectedSession.suspicion.reasons)
                            : UI_TEXT.metrics.noSignals
                        }
                      />
                      <DetailGroup label={UI_TEXT.metrics.firstSeen} value={formatTime(selectedSession.visit_started_at)} />
                      <DetailGroup label={UI_TEXT.metrics.lastSeen} value={formatTime(selectedSession.last_seen_at)} />
                    </div>

                    <div className="rounded-[1.1rem] border border-border/35 bg-background/55 p-3">
                      <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-skin-base/55">
                        {UI_TEXT.timelineTitle}
                      </div>
                      <JourneyList rows={selectedJourney} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-skin-base/70">{UI_TEXT.empty}</p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
};

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-border/40 bg-background/55 px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="text-[11px] uppercase tracking-[0.16em] text-skin-base/55">{props.label}</div>
      <div className="mt-1.5 text-lg font-semibold text-accent">{props.value}</div>
    </div>
  );
}

function FilterSelect(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-skin-base/65">{props.label}</span>
      <select
        value={props.value}
        onChange={event => props.onChange(event.target.value)}
        className="w-full rounded-2xl border border-border/50 bg-background/70 px-3 py-2.5 text-[13px] outline-none ring-accent/40 focus:ring-2"
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-skin-base/65">{props.label}</span>
      <input
        value={props.value}
        onChange={event => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-2xl border border-border/50 bg-background/70 px-3 py-2.5 text-[13px] outline-none ring-accent/40 focus:ring-2"
      />
    </label>
  );
}

function InsightPanel(props: { label: string; text: string }) {
  return (
    <div className="rounded-[1.15rem] border border-border/40 bg-background/50 p-3.5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-accent/70">{props.label}</div>
      <p className="mt-1.5 text-[13px] leading-5 text-skin-base/80">{props.text}</p>
    </div>
  );
}

function ChartCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-border/40 bg-background/45 p-4">
      <h4 className="mb-3 text-[13px] font-semibold text-skin-base">{props.title}</h4>
      {props.children}
    </div>
  );
}

function BarList(props: { data: ChartDatum[]; truncateLabel?: boolean }) {
  const max = props.data[0]?.count ?? 1;

  return (
    <div className="space-y-2.5">
      {props.data.map(item => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[12px] text-skin-base/70">
            <span className={props.truncateLabel ? "truncate pr-3" : ""}>{item.label}</span>
            <span>{item.meta ?? item.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border/25">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,197,94,0.9),rgba(59,130,246,0.9))]"
              style={{ width: `${Math.max((item.count / max) * 100, 8)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HourlyHeatStrip(props: { data: Array<{ hour: number; count: number }> }) {
  const max = Math.max(...props.data.map(item => item.count), 1);

  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-6 2xl:grid-cols-8">
      {props.data.map(item => {
        const alpha = item.count === 0 ? 0.08 : Math.min(0.18 + item.count / max, 1);
        return (
          <div
            key={item.hour}
            className="rounded-2xl border border-border/30 px-2.5 py-2.5 text-center"
            style={{ backgroundColor: `rgba(59,130,246,${alpha})` }}
          >
            <div className="text-xs text-skin-base/60">
              {String(item.hour).padStart(2, "0")}:00
            </div>
            <div className="mt-1 text-[13px] font-semibold text-skin-base">{item.count}</div>
          </div>
        );
      })}
    </div>
  );
}

function GeoRadarMap(props: { points: GeoPoint[] }) {
  const width = 720;
  const height = 320;
  const max = Math.max(...props.points.map(point => point.count), 1);

  const project = (longitude: number, latitude: number) => ({
    x: ((longitude + 180) / 360) * width,
    y: ((90 - latitude) / 180) * height,
  });

  return props.points.length === 0 ? (
    <div className="rounded-[1.2rem] border border-dashed border-border/40 bg-background/35 px-4 py-12 text-center text-sm text-skin-base/60">
      {UI_TEXT.labels.mapEmpty}
    </div>
  ) : (
    <div className="overflow-hidden rounded-[1.35rem] border border-border/35 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.15),transparent_52%),linear-gradient(180deg,rgba(15,23,42,0.45),rgba(15,23,42,0.08))] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
        {[0.2, 0.4, 0.6, 0.8].map(ratio => (
          <line
            key={`v-${ratio}`}
            x1={width * ratio}
            y1={0}
            x2={width * ratio}
            y2={height}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}
        {[0.25, 0.5, 0.75].map(ratio => (
          <line
            key={`h-${ratio}`}
            x1={0}
            y1={height * ratio}
            x2={width}
            y2={height * ratio}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}

        {props.points.map(point => {
          const { x, y } = project(point.longitude, point.latitude);
          const radius = 3 + (point.count / max) * 9;
          return (
            <g key={`${point.label}:${point.latitude}:${point.longitude}`}>
              <circle cx={x} cy={y} r={radius * 1.8} fill="rgba(59,130,246,0.08)" />
              <circle cx={x} cy={y} r={radius} fill="rgba(34,197,94,0.75)" />
            </g>
          );
        })}
      </svg>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {props.points.slice(0, 6).map(point => (
          <div
            key={`${point.label}-legend`}
            className="rounded-xl border border-border/25 bg-background/35 px-3 py-2 text-[11px] text-skin-base/70"
          >
            <div className="truncate font-medium text-skin-base">{point.label}</div>
            <div>{point.count} {UI_TEXT.metrics.sessions}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightCard(props: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.2rem] border border-border/40 bg-background/50 p-3.5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-skin-base/55">{props.label}</div>
      <div className="mt-1.5 text-base font-semibold text-accent">{props.value}</div>
      <p className="mt-1.5 text-[13px] leading-5 text-skin-base/70">{props.detail}</p>
    </div>
  );
}

function RiskPill(props: { suspicion: SuspicionResult; compact?: boolean }) {
  const label =
    props.suspicion.level === "high"
      ? "High"
      : props.suspicion.level === "watch"
        ? "Watch"
        : "Low";

  return (
    <span
      className={`inline-flex rounded-full border ${
        props.compact ? "px-2 py-0.5" : "px-2.5 py-1"
      } text-[11px] ${getRiskTone(props.suspicion.level)}`}
    >
      {label}
    </span>
  );
}

function DetailGroup(props: {
  label: string;
  value: string;
  action?: React.ReactNode;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.05rem] border border-border/35 bg-background/55 p-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-skin-base/55">{props.label}</div>
        {props.action}
      </div>
      <div
        className={`text-[13px] leading-5 text-skin-base/85 ${
          props.mono ? "break-all font-mono text-[12px]" : ""
        }`}
      >
        {props.value}
      </div>
      {props.children}
    </div>
  );
}

function JourneyList(props: { rows: DecoratedSession[] }) {
  if (props.rows.length === 0) {
    return <p className="text-sm text-skin-base/65">{UI_TEXT.empty}</p>;
  }

  return (
    <div className="space-y-2">
      {props.rows.map(row => (
        <div
          key={row.sessionKey}
          className="rounded-xl border border-border/25 bg-background/35 px-3 py-2"
        >
          <div className="text-[11px] text-skin-base/60">{formatTime(row.last_seen_at)}</div>
          <div className="mt-1 text-[13px] text-skin-base">{row.decodedPath}</div>
          <div className="mt-1 text-[11px] text-skin-base/60">
            {formatDwell(row.dwell_seconds)} • {formatPercent(row.max_scroll_percent ?? 0)} scroll
          </div>
        </div>
      ))}
    </div>
  );
}

export default VisitorsInfoPanel;
