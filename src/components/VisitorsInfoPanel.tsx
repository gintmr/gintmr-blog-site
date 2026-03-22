import React from "react";
import {
  getVisitorSessionsSecure,
  getVisitorsOverviewSecure,
  type VisitorSessionRow,
  type VisitorsOverview,
} from "@/db/supabase";
import { UI_LOCALE } from "@/i18n/ui";

const STORAGE_KEY = "visitors-info-password";

const UI_TEXT =
  UI_LOCALE === "zh-CN"
    ? {
        title: "访客详情面板",
        subtitle: "此页面受密码保护，仅用于站点数据观察。",
        passwordPlaceholder: "请输入访问密码",
        unlock: "解锁",
        loading: "加载中...",
        remember: "记住密码（当前设备）",
        refresh: "刷新数据",
        wrongPassword: "密码错误或无权限，请重试。",
        empty: "暂无访客记录。",
        totalViews: "总浏览量",
        totalVisitors: "总访客数",
        totalSessions: "总会话数",
        avgViews: "人均浏览",
        lastVisit: "最近访问",
        columns: {
          time: "时间",
          page: "页面",
          device: "设备",
          os: "系统",
          browser: "浏览器",
          geo: "地理位置",
          dwell: "停留",
          visitor: "访客ID",
          ip: "IP",
          referrer: "来源",
        },
      }
    : {
        title: "Visitors Info Panel",
        subtitle: "Password protected analytics details for this site.",
        passwordPlaceholder: "Enter password",
        unlock: "Unlock",
        loading: "Loading...",
        remember: "Remember password on this device",
        refresh: "Refresh",
        wrongPassword: "Wrong password or unauthorized.",
        empty: "No visitor records yet.",
        totalViews: "Total Views",
        totalVisitors: "Total Visitors",
        totalSessions: "Total Sessions",
        avgViews: "Avg Views/Visitor",
        lastVisit: "Last Visit",
        columns: {
          time: "Time",
          page: "Page",
          device: "Device",
          os: "OS",
          browser: "Browser",
          geo: "Location",
          dwell: "Dwell",
          visitor: "Visitor ID",
          ip: "IP",
          referrer: "Referrer",
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

function formatDwell(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  if (safe < 60) return `${safe}s`;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}m ${secs}s`;
}

function maskVisitorHash(value: string) {
  if (!value) return "--";
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function maskIp(ip: string | null) {
  const text = safeDisplay(ip, "");
  if (!text) return "--";
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const matched = text.match(v4);
  if (!matched) return text;
  return `${matched[1]}.${matched[2]}.*.*`;
}

const VisitorsInfoPanel: React.FC = () => {
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [unlocked, setUnlocked] = React.useState(false);
  const [overview, setOverview] = React.useState<VisitorsOverview | null>(null);
  const [rows, setRows] = React.useState<VisitorSessionRow[]>([]);

  const loadData = React.useCallback(
    async (pass: string) => {
      setLoading(true);
      setError("");
      try {
        const [nextOverview, nextRows] = await Promise.all([
          getVisitorsOverviewSecure(pass),
          getVisitorSessionsSecure(pass, { limit: 300 }),
        ]);

        if (!nextOverview) {
          throw new Error("unauthorized");
        }

        setOverview(nextOverview);
        setRows(nextRows);
        setUnlocked(true);

        if (remember) {
          localStorage.setItem(STORAGE_KEY, pass);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        setUnlocked(false);
        setOverview(null);
        setRows([]);
        setError(UI_TEXT.wrongPassword);
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

  const averageViews =
    overview && overview.total_visitors > 0
      ? (overview.total_views / overview.total_visitors).toFixed(2)
      : "--";

  return (
    <section className="visitors-panel rounded-xl border border-border/40 bg-card/40 p-4 sm:p-6">
      <header className="mb-5">
        <h2 className="text-2xl font-semibold text-accent">{UI_TEXT.title}</h2>
        <p className="mt-1 text-sm text-skin-base/75">{UI_TEXT.subtitle}</p>
      </header>

      {!unlocked && (
        <form
          className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center"
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
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none ring-accent/40 focus:ring-2 sm:max-w-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-skin-inverted transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? UI_TEXT.loading : UI_TEXT.unlock}
          </button>
        </form>
      )}

      {!unlocked && (
        <label className="mb-5 inline-flex items-center gap-2 text-xs text-skin-base/70">
          <input
            type="checkbox"
            checked={remember}
            onChange={event => setRemember(event.target.checked)}
            className="h-4 w-4 rounded border-border bg-background accent-accent"
          />
          {UI_TEXT.remember}
        </label>
      )}

      {error && (
        <p className="mb-5 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {unlocked && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label={UI_TEXT.totalViews} value={overview?.total_views} />
            <StatCard
              label={UI_TEXT.totalVisitors}
              value={overview?.total_visitors}
            />
            <StatCard
              label={UI_TEXT.totalSessions}
              value={overview?.total_sessions}
            />
            <StatCard label={UI_TEXT.avgViews} value={averageViews} />
            <StatCard
              label={UI_TEXT.lastVisit}
              value={formatTime(overview?.last_visit_at ?? null)}
            />
          </div>

          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => void loadData(password.trim())}
              disabled={loading}
              className="rounded-md border border-border/60 bg-card/40 px-3 py-1.5 text-sm transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? UI_TEXT.loading : UI_TEXT.refresh}
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-skin-base/75">{UI_TEXT.empty}</p>
          ) : (
            <div className="overflow-auto rounded-lg border border-border/40">
              <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                <thead className="bg-card/60 text-skin-base/85">
                  <tr>
                    <Th>{UI_TEXT.columns.time}</Th>
                    <Th>{UI_TEXT.columns.page}</Th>
                    <Th>{UI_TEXT.columns.device}</Th>
                    <Th>{UI_TEXT.columns.os}</Th>
                    <Th>{UI_TEXT.columns.browser}</Th>
                    <Th>{UI_TEXT.columns.geo}</Th>
                    <Th>{UI_TEXT.columns.dwell}</Th>
                    <Th>{UI_TEXT.columns.visitor}</Th>
                    <Th>{UI_TEXT.columns.ip}</Th>
                    <Th>{UI_TEXT.columns.referrer}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const geo = [row.country, row.region, row.city]
                      .map(v => safeDisplay(v, ""))
                      .filter(Boolean)
                      .join(" / ");

                    return (
                      <tr key={`${row.page_path}:${row.visitor_hash}:${row.session_id}`} className="border-t border-border/30">
                        <Td>{formatTime(row.last_seen_at)}</Td>
                        <Td className="max-w-[280px] truncate">{row.page_path}</Td>
                        <Td>{safeDisplay(row.device_type)}</Td>
                        <Td>{safeDisplay(row.os)}</Td>
                        <Td>{safeDisplay(row.browser)}</Td>
                        <Td>{geo || "--"}</Td>
                        <Td>{formatDwell(row.dwell_seconds)}</Td>
                        <Td>{maskVisitorHash(row.visitor_hash)}</Td>
                        <Td>{maskIp(row.ip_address)}</Td>
                        <Td className="max-w-[260px] truncate">{safeDisplay(row.referrer)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};

function StatCard(props: { label: string; value: string | number | null | undefined }) {
  const value =
    props.value == null || props.value === ""
      ? "--"
      : typeof props.value === "number"
        ? props.value.toLocaleString()
        : props.value;

  return (
    <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
      <div className="text-xs text-skin-base/70">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-accent">{value}</div>
    </div>
  );
}

function Th(props: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{props.children}</th>;
}

function Td(props: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${props.className ?? ""}`}>{props.children}</td>;
}

export default VisitorsInfoPanel;
