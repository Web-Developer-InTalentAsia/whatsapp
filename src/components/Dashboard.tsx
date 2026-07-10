import React, { useState, useEffect } from "react";
import { 
  MessageSquare, Users, Clock, AlertTriangle, Cpu, CheckCircle, 
  TrendingUp, Star, Phone, Activity, ChevronRight
} from "lucide-react";

interface DashboardStats {
  todayMessages: number;
  openConversations: number;
  unreadConversations: number;
  needingHumanReply: number;
  aiSuggestionsPending: number;
  workflowActive: number;
  numberSummary: { name: string; inbound: number; outbound: number }[];
  userReplySummary: { name: string; manual: number; ai: number }[];
}

interface DashboardProps {
  token: string;
  onNavigateToInbox: () => void;
}

export default function Dashboard({ token, onNavigateToInbox }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load dashboard metrics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-10 bg-emerald-600 rounded-full animate-spin border-4 border-zinc-800 border-t-emerald-600"></div>
          <span className="mt-3 text-sm text-zinc-400">Retrieving operational statistics...</span>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Today's Messages",
      value: stats?.todayMessages || 0,
      icon: MessageSquare,
      color: "text-blue-400",
      bg: "bg-blue-950/30 border border-blue-900/30",
    },
    {
      title: "Open Threads",
      value: stats?.openConversations || 0,
      icon: Users,
      color: "text-indigo-400",
      bg: "bg-indigo-950/30 border border-indigo-900/30",
    },
    {
      title: "Unread Chats",
      value: stats?.unreadConversations || 0,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-950/30 border border-amber-900/30",
    },
    {
      title: "Needs Handover / Recruiter",
      value: stats?.needingHumanReply || 0,
      icon: AlertTriangle,
      color: "text-rose-400",
      bg: "bg-rose-950/30 border border-rose-900/30",
    },
    {
      title: "AI Suggestions Ready",
      value: stats?.aiSuggestionsPending || 0,
      icon: Cpu,
      color: "text-teal-400",
      bg: "bg-teal-950/30 border border-teal-900/30",
    },
    {
      title: "Workflow Active",
      value: stats?.workflowActive || 0,
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-950/30 border border-emerald-900/30",
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-6 font-sans">
      {/* Title block */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Recruiting Operations Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Real-time metrics for InTalent WhatsApp business lines, AI assistance, and active workflows.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={onNavigateToInbox}
              className="bg-[#0c0c0e] p-6 rounded-2xl border border-zinc-800 hover:border-zinc-700 shadow-xl transition duration-150 cursor-pointer group flex items-center justify-between"
            >
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{card.title}</p>
                <p className="text-3xl font-bold text-zinc-100 mt-2 tracking-tight group-hover:text-emerald-400 transition">
                  {card.value}
                </p>
              </div>
              <div className={`p-4 rounded-xl ${card.bg} ${card.color}`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid: Charts & summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* WhatsApp Line Activity Summary */}
        <div className="bg-[#0c0c0e] p-6 rounded-2xl border border-zinc-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-200 flex items-center gap-2 text-base">
              <Phone className="h-5 w-5 text-emerald-400" />
              Line Activity Summary
            </h3>
            <span className="text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 px-2.5 py-1 rounded-full font-medium">Live Lines</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {stats?.numberSummary.map((num) => (
              <div key={num.name} className="py-3.5 flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-200 text-sm">{num.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Primary Business Account</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block">Inbound</span>
                    <span className="font-semibold text-zinc-200 text-sm">{num.inbound}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block">Replies</span>
                    <span className="font-semibold text-zinc-200 text-sm">{num.outbound}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recruiter / Agent Performance */}
        <div className="bg-[#0c0c0e] p-6 rounded-2xl border border-zinc-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-200 flex items-center gap-2 text-base">
              <Star className="h-5 w-5 text-amber-400" />
              Recruiter & AI Activity
            </h3>
            <span className="text-xs bg-zinc-900 text-zinc-400 border border-zinc-800 px-2.5 py-1 rounded-full font-medium font-mono">Today</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {stats?.userReplySummary.map((user) => (
              <div key={user.name} className="py-3.5 flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-200 text-sm">{user.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Recruiting Consultant</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block">Manual</span>
                    <span className="font-semibold text-zinc-200 text-sm">{user.manual}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block">AI Suggestions Used</span>
                    <span className="font-semibold text-zinc-200 text-sm">{user.ai}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom CTA block */}
      <div className="bg-emerald-950/30 border border-emerald-800/50 text-zinc-100 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <h4 className="text-lg font-semibold tracking-tight text-emerald-400">Active Candidate Conversations Awaiting Reply</h4>
          <p className="text-sm text-zinc-400 mt-1">
            There are candidate messages waiting for your professional evaluation. Click to launch the inbox instantly.
          </p>
        </div>
        <button
          onClick={onNavigateToInbox}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow hover:bg-emerald-500 transition flex items-center gap-2 cursor-pointer text-sm"
        >
          Open InTalent Inbox
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
