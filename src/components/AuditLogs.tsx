import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  Download,
  Filter,
  Globe2,
  LogIn,
  MonitorSmartphone,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  TriangleAlert,
  UserRound,
  Users,
  X,
} from "lucide-react";

import type {
  AuditCategory,
  AuditLog,
  AuditSeverity,
  AuthLoginAttempt,
  SecurityAuditSummary,
  UserSessionActivity,
} from "../types.ts";

interface AuditLogsProps {
  token: string;
}

type SecurityTab = "audit" | "logins" | "sessions";
type OutcomeFilter = "all" | "success" | "failed";

interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface SummaryResponse extends SecurityAuditSummary {
  suspiciousLoginThreshold?: number;
  suspiciousLoginWindowMinutes?: number;
}

const CATEGORY_OPTIONS: Array<{ value: "all" | AuditCategory; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "auth", label: "Authentication" },
  { value: "authorization", label: "Authorization" },
  { value: "configuration", label: "Configuration" },
  { value: "data", label: "Data" },
  { value: "messaging", label: "Messaging" },
  { value: "automation", label: "Automation" },
  { value: "security", label: "Security" },
  { value: "activity", label: "Activity" },
];

const SEVERITY_OPTIONS: Array<{ value: "all" | AuditSeverity; label: string }> = [
  { value: "all", label: "All severities" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "success", label: "Success" },
  { value: "info", label: "Info" },
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function compactUserAgent(value?: string | null) {
  if (!value) return "Unknown device";
  if (/Edg\//i.test(value)) return "Microsoft Edge";
  if (/Chrome\//i.test(value)) return "Google Chrome";
  if (/Firefox\//i.test(value)) return "Mozilla Firefox";
  if (/Safari\//i.test(value) && !/Chrome\//i.test(value)) return "Safari";
  return value.length > 72 ? `${value.slice(0, 69)}…` : value;
}

function severityClasses(severity: AuditSeverity) {
  switch (severity) {
    case "critical":
      return "border-rose-900/60 bg-rose-950/45 text-rose-300";
    case "warning":
      return "border-amber-900/60 bg-amber-950/45 text-amber-300";
    case "success":
      return "border-emerald-900/60 bg-emerald-950/45 text-emerald-300";
    default:
      return "border-sky-900/60 bg-sky-950/45 text-sky-300";
  }
}

function parseMetadata(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && Object.keys(parsed as object).length === 0) return null;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export default function AuditLogs({ token }: AuditLogsProps) {
  const [activeTab, setActiveTab] = useState<SecurityTab>("audit");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [auditResponse, setAuditResponse] = useState<PagedResponse<AuditLog>>({ items: [], total: 0, page: 1, pageSize: 50 });
  const [loginResponse, setLoginResponse] = useState<PagedResponse<AuthLoginAttempt>>({ items: [], total: 0, page: 1, pageSize: 50 });
  const [sessionResponse, setSessionResponse] = useState<PagedResponse<UserSessionActivity>>({ items: [], total: 0, page: 1, pageSize: 50 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<"all" | AuditCategory>("all");
  const [severity, setSeverity] = useState<"all" | AuditSeverity>("all");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch, category, severity, outcome]);

  const authHeaders = useMemo(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const loadSummary = useCallback(async () => {
    const response = await fetch("/api/security/summary", { headers: authHeaders, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load security summary.");
    setSummary(data as SummaryResponse);
  }, [authHeaders]);

  const loadActiveTab = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (outcome !== "all") params.set("outcome", outcome);

    let endpoint = "/api/audit-logs";
    if (activeTab === "audit") {
      if (category !== "all") params.set("category", category);
      if (severity !== "all") params.set("severity", severity);
    } else if (activeTab === "logins") {
      endpoint = "/api/security/login-attempts";
    } else {
      endpoint = "/api/security/sessions";
      params.delete("outcome");
    }

    const response = await fetch(`${endpoint}?${params.toString()}`, { headers: authHeaders, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load security data.");

    if (activeTab === "audit") setAuditResponse(data as PagedResponse<AuditLog>);
    if (activeTab === "logins") setLoginResponse(data as PagedResponse<AuthLoginAttempt>);
    if (activeTab === "sessions") setSessionResponse(data as PagedResponse<UserSessionActivity>);
  }, [activeTab, authHeaders, category, debouncedSearch, outcome, page, severity]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadSummary(), loadActiveTab()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load security audit information.");
    } finally {
      setLoading(false);
    }
  }, [loadActiveTab, loadSummary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeResponse = activeTab === "audit"
    ? auditResponse
    : activeTab === "logins"
      ? loginResponse
      : sessionResponse;
  const totalPages = Math.max(1, Math.ceil(activeResponse.total / activeResponse.pageSize));

  const exportAudit = async () => {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (category !== "all") params.set("category", category);
      if (severity !== "all") params.set("severity", severity);
      if (outcome !== "all") params.set("outcome", outcome);
      const response = await fetch(`/api/security/audit-export.csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not export the audit trail.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `intalent-security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export the audit trail.");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setSeverity("all");
    setOutcome("all");
  };

  const summaryCards = [
    { label: "Audit Events · 24h", value: summary?.auditEvents24h ?? 0, icon: Activity, tone: "text-sky-300 bg-sky-950/45 border-sky-900/50" },
    { label: "Failed Logins · 24h", value: summary?.failedLoginAttempts24h ?? 0, icon: LogIn, tone: "text-amber-300 bg-amber-950/45 border-amber-900/50" },
    { label: "Critical Events · 7d", value: summary?.criticalEvents7d ?? 0, icon: ShieldAlert, tone: "text-rose-300 bg-rose-950/45 border-rose-900/50" },
    { label: "Active Users · 24h", value: summary?.activeUsers24h ?? 0, icon: Users, tone: "text-emerald-300 bg-emerald-950/45 border-emerald-900/50" },
    { label: "Active Sessions", value: summary?.activeSessions ?? 0, icon: MonitorSmartphone, tone: "text-violet-300 bg-violet-950/45 border-violet-900/50" },
    { label: "Suspicious IPs · 24h", value: summary?.suspiciousIps24h ?? 0, icon: Globe2, tone: "text-orange-300 bg-orange-950/45 border-orange-900/50" },
  ];

  return (
    <div className="mx-auto max-w-[1480px] space-y-5 p-4 font-sans text-zinc-100 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-100">
            <Shield className="h-6 w-6 text-emerald-400" />
            Security Audits & User Activity
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
            Review authentication attempts, administrator actions, permission failures, active sessions and system-generated security events. Passwords, access tokens and API keys are never stored in this audit trail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === "audit" && (
            <button
              type="button"
              onClick={() => void exportAudit()}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-emerald-800 hover:text-emerald-300 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-900/60 bg-emerald-950/35 px-3.5 py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-950/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-white/[0.07] bg-[#0c1115] p-4 shadow-xl">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl border ${card.tone}`}><Icon className="h-4.5 w-4.5" /></div>
              <p className="text-2xl font-black text-zinc-100">{loading && !summary ? "—" : card.value}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{card.label}</p>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1"><p className="font-semibold">Security data could not be loaded</p><p className="mt-1 text-xs text-rose-300/80">{error}</p></div>
          <button type="button" onClick={() => setError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c1115] shadow-xl">
        <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {([
              ["audit", "Audit Trail", Shield],
              ["logins", "Login Security", LogIn],
              ["sessions", "User Sessions", MonitorSmartphone],
            ] as Array<[SecurityTab, string, React.ComponentType<{ className?: string }>]>).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${activeTab === id ? "bg-emerald-600 text-white" : "border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-zinc-500">
            Showing {activeResponse.total === 0 ? 0 : (page - 1) * activeResponse.pageSize + 1}–{Math.min(page * activeResponse.pageSize, activeResponse.total)} of {activeResponse.total}
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/[0.07] bg-zinc-950/35 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className={`${activeTab === "audit" ? "xl:col-span-2" : "xl:col-span-3"} relative`}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={activeTab === "sessions" ? "Search user, email, IP, browser or path…" : "Search action, actor, email, IP or details…"}
              className="w-full rounded-xl border border-zinc-800 bg-[#090d10] py-2.5 pl-9 pr-3 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-emerald-700"
            />
          </div>
          {activeTab === "audit" && (
            <>
              <select value={category} onChange={event => setCategory(event.target.value as "all" | AuditCategory)} className="rounded-xl border border-zinc-800 bg-[#090d10] px-3 py-2.5 text-xs text-zinc-300 outline-none focus:border-emerald-700">
                {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={severity} onChange={event => setSeverity(event.target.value as "all" | AuditSeverity)} className="rounded-xl border border-zinc-800 bg-[#090d10] px-3 py-2.5 text-xs text-zinc-300 outline-none focus:border-emerald-700">
                {SEVERITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </>
          )}
          {activeTab !== "sessions" && (
            <select value={outcome} onChange={event => setOutcome(event.target.value as OutcomeFilter)} className="rounded-xl border border-zinc-800 bg-[#090d10] px-3 py-2.5 text-xs text-zinc-300 outline-none focus:border-emerald-700">
              <option value="all">All outcomes</option>
              <option value="success">Successful</option>
              <option value="failed">Failed / blocked</option>
            </select>
          )}
          <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-xs font-semibold text-zinc-500 hover:text-zinc-300">
            <Filter className="h-4 w-4" /> Clear filters
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-sm text-zinc-500">Loading verified security records…</div>
          ) : activeTab === "audit" ? (
            auditResponse.items.length === 0 ? <EmptyState text="No audit records matched these filters." /> : (
              <table className="w-full min-w-[1180px] text-left text-xs text-zinc-300">
                <thead><tr className="border-b border-zinc-800 bg-zinc-900/45 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="p-4">Time</th><th className="p-4">Actor</th><th className="p-4">Event</th><th className="p-4">Outcome</th><th className="p-4">Request / Resource</th><th className="p-4">IP</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {auditResponse.items.map(log => (
                    <tr key={log.id} onClick={() => setSelectedLog(log)} className="cursor-pointer transition hover:bg-white/[0.025]">
                      <td className="whitespace-nowrap p-4 font-mono text-[10px] text-zinc-500">{formatDate(log.timestamp)}</td>
                      <td className="p-4"><p className="font-semibold text-zinc-200">{log.userName || log.userEmail || "System"}</p><p className="mt-1 max-w-[190px] truncate text-[10px] text-zinc-600">{log.userEmail || "Automated process"}</p></td>
                      <td className="p-4"><div className="flex flex-wrap gap-1.5"><span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${severityClasses(log.severity)}`}>{log.severity}</span><span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-[9px] font-bold uppercase text-zinc-400">{log.category}</span></div><p className="mt-2 font-semibold text-zinc-200">{log.action}</p><p className="mt-1 max-w-[460px] line-clamp-2 leading-4 text-zinc-500">{log.details}</p></td>
                      <td className="p-4">{log.success ? <span className="inline-flex items-center gap-1.5 text-emerald-400"><CircleCheck className="h-4 w-4" /> Success</span> : <span className="inline-flex items-center gap-1.5 text-rose-400"><CircleX className="h-4 w-4" /> Failed</span>}</td>
                      <td className="p-4"><p className="font-mono text-[10px] text-zinc-400">{[log.requestMethod, log.requestPath].filter(Boolean).join(" ") || "—"}</p><p className="mt-1 text-[10px] text-zinc-600">{[log.resourceType, log.resourceId].filter(Boolean).join(": ") || "No resource"}</p></td>
                      <td className="p-4 font-mono text-[10px] text-zinc-500">{log.ipAddress || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : activeTab === "logins" ? (
            loginResponse.items.length === 0 ? <EmptyState text="No login attempts matched these filters." /> : (
              <table className="w-full min-w-[900px] text-left text-xs text-zinc-300">
                <thead><tr className="border-b border-zinc-800 bg-zinc-900/45 text-[10px] font-bold uppercase tracking-wider text-zinc-500"><th className="p-4">Time</th><th className="p-4">Account</th><th className="p-4">Outcome</th><th className="p-4">IP Address</th><th className="p-4">Device</th><th className="p-4">Request ID</th></tr></thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {loginResponse.items.map(attempt => <tr key={attempt.id} className="hover:bg-white/[0.025]"><td className="whitespace-nowrap p-4 font-mono text-[10px] text-zinc-500">{formatDate(attempt.attemptedAt)}</td><td className="p-4"><p className="font-semibold text-zinc-200">{attempt.userName || attempt.email}</p><p className="mt-1 text-[10px] text-zinc-600">{attempt.email}</p></td><td className="p-4">{attempt.success ? <span className="inline-flex items-center gap-1.5 text-emerald-400"><CircleCheck className="h-4 w-4" /> Successful</span> : <div><span className="inline-flex items-center gap-1.5 text-rose-400"><CircleX className="h-4 w-4" /> Failed</span><p className="mt-1 text-[10px] text-zinc-600">{attempt.failureReason || "Rejected"}</p></div>}</td><td className="p-4 font-mono text-[10px] text-zinc-500">{attempt.ipAddress || "—"}</td><td className="p-4 text-zinc-500" title={attempt.userAgent || ""}>{compactUserAgent(attempt.userAgent)}</td><td className="p-4 font-mono text-[10px] text-zinc-600">{attempt.requestId || "—"}</td></tr>)}
                </tbody>
              </table>
            )
          ) : (
            sessionResponse.items.length === 0 ? <EmptyState text="No user sessions matched this search." /> : (
              <table className="w-full min-w-[1050px] text-left text-xs text-zinc-300">
                <thead><tr className="border-b border-zinc-800 bg-zinc-900/45 text-[10px] font-bold uppercase tracking-wider text-zinc-500"><th className="p-4">User</th><th className="p-4">State</th><th className="p-4">First Seen</th><th className="p-4">Last Active</th><th className="p-4">IP / Device</th><th className="p-4">Last API Path</th><th className="p-4">Requests</th></tr></thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {sessionResponse.items.map(session => <tr key={session.id} className="hover:bg-white/[0.025]"><td className="p-4"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400"><UserRound className="h-4 w-4" /></div><div><p className="font-semibold text-zinc-200">{session.userName}</p><p className="mt-0.5 text-[10px] text-zinc-600">{session.userEmail} · {session.userRole.replace(/_/g, " ")}</p></div></div></td><td className="p-4">{session.isActive ? <span className="rounded-full border border-emerald-900/60 bg-emerald-950/45 px-2.5 py-1 text-[9px] font-bold uppercase text-emerald-300">Active now</span> : session.loggedOutAt ? <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[9px] font-bold uppercase text-zinc-500">Logged out</span> : <span className="rounded-full border border-amber-900/60 bg-amber-950/45 px-2.5 py-1 text-[9px] font-bold uppercase text-amber-300">Inactive</span>}</td><td className="p-4 font-mono text-[10px] text-zinc-500">{formatDate(session.firstSeenAt)}</td><td className="p-4 font-mono text-[10px] text-zinc-400">{formatDate(session.lastSeenAt)}{session.loggedOutAt && <p className="mt-1 text-zinc-600">Logout: {formatDate(session.loggedOutAt)}</p>}</td><td className="p-4"><p className="font-mono text-[10px] text-zinc-400">{session.ipAddress || "—"}</p><p className="mt-1 text-[10px] text-zinc-600" title={session.userAgent || ""}>{compactUserAgent(session.userAgent)}</p></td><td className="max-w-[260px] truncate p-4 font-mono text-[10px] text-zinc-500" title={session.lastPath || ""}>{session.lastPath || "—"}</td><td className="p-4 font-mono text-zinc-400">{session.requestCount}</td></tr>)}
                </tbody>
              </table>
            )
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3">
          <p className="text-[10px] text-zinc-600">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(previous => Math.max(1, previous - 1))} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 disabled:opacity-35"><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage(previous => Math.min(totalPages, previous + 1))} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 disabled:opacity-35">Next <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={() => setSelectedLog(null)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/[0.09] bg-[#0b1115] shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="sticky top-0 flex items-start justify-between border-b border-white/[0.07] bg-[#0b1115] p-5">
              <div><div className="flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${severityClasses(selectedLog.severity)}`}>{selectedLog.severity}</span><span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[9px] font-bold uppercase text-zinc-400">{selectedLog.category}</span></div><h2 className="mt-3 text-lg font-bold text-zinc-100">{selectedLog.action}</h2><p className="mt-1 text-xs text-zinc-500">Audit record #{selectedLog.id} · {formatDate(selectedLog.timestamp)}</p></div>
              <button type="button" onClick={() => setSelectedLog(null)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Detail label="Actor" value={selectedLog.userName || selectedLog.userEmail || "System"} />
              <Detail label="Outcome" value={selectedLog.success ? "Successful" : "Failed / blocked"} />
              <Detail label="IP Address" value={selectedLog.ipAddress || "—"} mono />
              <Detail label="Device" value={compactUserAgent(selectedLog.userAgent)} />
              <Detail label="Request" value={[selectedLog.requestMethod, selectedLog.requestPath].filter(Boolean).join(" ") || "—"} mono />
              <Detail label="Request ID" value={selectedLog.requestId || "—"} mono />
              <Detail label="Resource" value={[selectedLog.resourceType, selectedLog.resourceId].filter(Boolean).join(": ") || "—"} mono />
              <div className="md:col-span-2"><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">Details</p><div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs leading-5 text-zinc-300">{selectedLog.details}</div></div>
              {parseMetadata(selectedLog.metadata) && <div className="md:col-span-2"><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">Sanitized metadata</p><pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 font-mono text-[10px] leading-5 text-zinc-400">{parseMetadata(selectedLog.metadata)}</pre></div>}
            </div>
          </div>
        </div>
      )}

      {summary && (
        <p className="flex items-center gap-2 text-[10px] text-zinc-600"><Clock3 className="h-3.5 w-3.5" /> Security snapshot generated {formatDate(summary.generatedAt)}. Repeated login failures are flagged after {summary.suspiciousLoginThreshold ?? 5} attempts within {summary.suspiciousLoginWindowMinutes ?? 15} minutes.</p>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-16 text-center"><Shield className="mx-auto h-9 w-9 text-zinc-800" /><p className="mt-3 text-sm text-zinc-500">{text}</p></div>;
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">{label}</p><p className={`rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-300 ${mono ? "font-mono" : ""}`}>{value}</p></div>;
}
