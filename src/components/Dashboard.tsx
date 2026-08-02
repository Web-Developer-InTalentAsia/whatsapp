import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gauge,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldAlert,
  TimerReset,
  UserRoundX,
  Users,
} from "lucide-react";

interface RecruiterPerformance {
  userId: number;
  name: string;
  assignedOpen: number;
  awaiting: number;
  overdue: number;
  manualRepliesToday: number;
  avgResponseMinutes: number | null;
  withinSlaPercent: number | null;
}

interface OverdueQueueItem {
  conversationId: number;
  contactName: string;
  assignedUserName: string;
  waitingMinutes: number;
  status: string;
}

interface DashboardStats {
  todayMessages: number;
  openConversations: number;
  unreadConversations: number;
  needingHumanReply: number;
  aiSuggestionsPending: number;
  workflowActive: number;
  awaitingResponse: number;
  overdueConversations: number;
  dueSoonConversations: number;
  unassignedAwaiting: number;
  avgFirstResponseMinutes: number | null;
  withinSlaPercent: number | null;
  oldestWaitingMinutes: number;
  responseSlaMinutes: number;
  unassignedEscalationMinutes: number;
  numberSummary: { name: string; inbound: number; outbound: number }[];
  userReplySummary: { name: string; manual: number; ai: number }[];
  recruiterPerformance: RecruiterPerformance[];
  overdueQueue: OverdueQueueItem[];
  generatedAt: string;
}

interface DashboardProps {
  token: string;
  onNavigateToInbox: () => void;
}

function formatMinutes(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}h ${minutes}m`;
}

export default function Dashboard({ token, onNavigateToInbox }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchStats = async (background = false) => {
    if (background) setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load dashboard metrics.");
      setStats(data);
      setError("");
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
      setError(err instanceof Error ? err.message : "Could not load dashboard metrics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchStats();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchStats(true);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-emerald-500" />
          <span className="mt-3 text-sm text-zinc-400">Loading response-time operations…</span>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Awaiting Response",
      value: stats?.awaitingResponse || 0,
      detail: `${stats?.dueSoonConversations || 0} due soon`,
      icon: Clock3,
      tone: "text-sky-300 border-sky-900/50 bg-sky-950/30",
    },
    {
      title: "SLA Overdue",
      value: stats?.overdueConversations || 0,
      detail: `${stats?.responseSlaMinutes || 15}m target`,
      icon: ShieldAlert,
      tone: "text-red-300 border-red-900/50 bg-red-950/30",
    },
    {
      title: "Unassigned Queue",
      value: stats?.unassignedAwaiting || 0,
      detail: `Escalates after ${stats?.unassignedEscalationMinutes || 5}m`,
      icon: UserRoundX,
      tone: "text-amber-300 border-amber-900/50 bg-amber-950/30",
    },
    {
      title: "Average First Response",
      value: formatMinutes(stats?.avgFirstResponseMinutes),
      detail: "Today",
      icon: TimerReset,
      tone: "text-violet-300 border-violet-900/50 bg-violet-950/30",
    },
    {
      title: "Within SLA",
      value: stats?.withinSlaPercent === null || stats?.withinSlaPercent === undefined
        ? "—"
        : `${stats.withinSlaPercent}%`,
      detail: "Completed response cycles today",
      icon: Gauge,
      tone: "text-emerald-300 border-emerald-900/50 bg-emerald-950/30",
    },
    {
      title: "Recruiter Handover",
      value: stats?.needingHumanReply || 0,
      detail: `${stats?.unreadConversations || 0} unread chats`,
      icon: AlertTriangle,
      tone: "text-rose-300 border-rose-900/50 bg-rose-950/30",
    },
    {
      title: "Open Conversations",
      value: stats?.openConversations || 0,
      detail: `${stats?.todayMessages || 0} messages today`,
      icon: Users,
      tone: "text-indigo-300 border-indigo-900/50 bg-indigo-950/30",
    },
    {
      title: "Workflow Active",
      value: stats?.workflowActive || 0,
      detail: `${stats?.aiSuggestionsPending || 0} AI suggestions ready`,
      icon: CheckCircle2,
      tone: "text-teal-300 border-teal-900/50 bg-teal-950/30",
    },
  ];

  return (
    <div className="mx-auto max-w-[1540px] space-y-7 p-4 font-sans sm:p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-gradient-to-br from-emerald-500/[0.09] via-[#10171d] to-[#0b1014] p-6 shadow-2xl sm:p-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-300">
              <Activity className="h-3.5 w-3.5" /> Live SLA operations
            </div>
            <h1 className="text-2xl font-bold tracking-[-.03em] text-zinc-100 sm:text-3xl">Recruiter Response Performance</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Track first-response targets, overdue conversations, recruiter workload, and unassigned escalations across every WhatsApp line.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-[10px] text-zinc-500">
              <div>Auto refresh: 30 seconds</div>
              <div>{stats?.generatedAt ? new Date(stats.generatedAt).toLocaleTimeString() : "—"}</div>
            </div>
            <button
              type="button"
              onClick={() => void fetchStats(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <button
              type="button"
              key={card.title}
              onClick={onNavigateToInbox}
              className="metric-card group flex items-center justify-between rounded-2xl p-5 text-left transition-all duration-200"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{card.title}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-100 transition group-hover:text-emerald-300">{card.value}</p>
                <p className="mt-1 truncate text-[11px] text-zinc-500">{card.detail}</p>
              </div>
              <div className={`rounded-xl border p-3.5 ${card.tone}`}><Icon className="h-6 w-6" /></div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1.4fr]">
        <section className="premium-card rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-200">
              <AlertTriangle className="h-5 w-5 text-red-400" /> Oldest Overdue Queue
            </h2>
            <button type="button" onClick={onNavigateToInbox} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">Open inbox</button>
          </div>
          {stats?.overdueQueue?.length ? (
            <div className="divide-y divide-zinc-800/80">
              {stats.overdueQueue.map(item => (
                <button
                  type="button"
                  key={item.conversationId}
                  onClick={onNavigateToInbox}
                  className="flex w-full items-center justify-between gap-4 py-3.5 text-left transition hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-200">{item.contactName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">{item.assignedUserName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-red-300">{formatMinutes(item.waitingMinutes)}</p>
                    <p className="text-[9px] uppercase tracking-wide text-red-500">waiting</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-sm font-semibold text-zinc-300">No overdue conversations</p>
              <p className="mt-1 text-xs text-zinc-500">Every waiting thread is currently within SLA.</p>
            </div>
          )}
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Oldest active wait</span>
              <span className="font-semibold text-zinc-200">{formatMinutes(stats?.oldestWaitingMinutes || 0)}</span>
            </div>
          </div>
        </section>

        <section className="premium-card overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 sm:px-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-200">
              <Gauge className="h-5 w-5 text-emerald-400" /> Recruiter Performance Today
            </h2>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-semibold text-zinc-500">SLA {stats?.responseSlaMinutes || 15}m</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-zinc-950/50 text-[10px] uppercase tracking-wider text-zinc-600">
                <tr>
                  <th className="px-5 py-3 font-semibold sm:px-6">Recruiter</th>
                  <th className="px-3 py-3 font-semibold">Assigned</th>
                  <th className="px-3 py-3 font-semibold">Awaiting</th>
                  <th className="px-3 py-3 font-semibold">Overdue</th>
                  <th className="px-3 py-3 font-semibold">Manual Replies</th>
                  <th className="px-3 py-3 font-semibold">Avg Response</th>
                  <th className="px-5 py-3 font-semibold sm:px-6">Within SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {stats?.recruiterPerformance?.length ? stats.recruiterPerformance.map(recruiter => (
                  <tr key={recruiter.userId} className="text-xs text-zinc-300 hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-semibold text-zinc-200 sm:px-6">{recruiter.name}</td>
                    <td className="px-3 py-3.5">{recruiter.assignedOpen}</td>
                    <td className="px-3 py-3.5">{recruiter.awaiting}</td>
                    <td className={`px-3 py-3.5 font-semibold ${recruiter.overdue > 0 ? "text-red-300" : "text-zinc-500"}`}>{recruiter.overdue}</td>
                    <td className="px-3 py-3.5">{recruiter.manualRepliesToday}</td>
                    <td className="px-3 py-3.5">{formatMinutes(recruiter.avgResponseMinutes)}</td>
                    <td className="px-5 py-3.5 sm:px-6">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                        recruiter.withinSlaPercent === null
                          ? "border-zinc-800 text-zinc-500"
                          : recruiter.withinSlaPercent >= 90
                            ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
                            : recruiter.withinSlaPercent >= 70
                              ? "border-amber-800/60 bg-amber-950/30 text-amber-300"
                              : "border-red-800/60 bg-red-950/30 text-red-300"
                      }`}>
                        {recruiter.withinSlaPercent === null ? "—" : `${recruiter.withinSlaPercent}%`}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-xs text-zinc-500">No recruiter response activity recorded today.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="premium-card rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-200"><Phone className="h-5 w-5 text-emerald-400" /> Line Activity Today</h3>
            <span className="rounded-full border border-emerald-900/40 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-400">Live lines</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {stats?.numberSummary?.length ? stats.numberSummary.map(number => (
              <div key={number.name} className="flex items-center justify-between py-3.5">
                <div><p className="text-sm font-medium text-zinc-200">{number.name}</p><p className="mt-0.5 text-xs text-zinc-500">WhatsApp business line</p></div>
                <div className="flex items-center gap-6 text-right">
                  <div><span className="block text-xs text-zinc-500">Inbound</span><span className="text-sm font-semibold text-zinc-200">{number.inbound}</span></div>
                  <div><span className="block text-xs text-zinc-500">Responses</span><span className="text-sm font-semibold text-zinc-200">{number.outbound}</span></div>
                </div>
              </div>
            )) : <p className="py-10 text-center text-xs text-zinc-500">No line activity today.</p>}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/70 to-cyan-950/30 p-6 shadow-2xl md:p-8">
          <MessageSquare className="h-8 w-8 text-emerald-400" />
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-emerald-300">Protect the response SLA</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            Assign unowned conversations quickly and prioritize red overdue threads. SLA alerts are also saved in the notification center for the assigned recruiter and line owners.
          </p>
          <button
            type="button"
            onClick={onNavigateToInbox}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-emerald-500"
          >
            Open SLA queue <ChevronRight className="h-4 w-4" />
          </button>
        </section>
      </div>
    </div>
  );
}
