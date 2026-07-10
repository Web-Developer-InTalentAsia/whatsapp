import React, { useState, useEffect } from "react";
import { 
  Download, Filter, Calendar, BarChart2, CheckCircle, PieChart,
  Grid, MessageSquare, ArrowDownToLine, Phone, Activity, Tag
} from "lucide-react";

interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

interface MessageReport {
  id: number;
  contactName: string;
  contactPhone: string;
  whatsappNumberName: string;
  content: string;
  sender: string;
  replyType: string;
  timestamp: string;
}

interface ReportsProps {
  token: string;
  currentUser: any;
}

export default function Reports({ token, currentUser }: ReportsProps) {
  const [messages, setMessages] = useState<MessageReport[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [lineFilter, setLineFilter] = useState("all");
  const [replyTypeFilter, setReplyTypeFilter] = useState("all");
  const [senderFilter, setSenderFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [numbersList, setNumbersList] = useState<any[]>([]);

  // Fetch numbers for filter
  useEffect(() => {
    const fetchNumbers = async () => {
      try {
        const res = await fetch("/api/whatsapp_numbers", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNumbersList(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchNumbers();
  }, [token]);

  // Fetch dynamic messages history report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/reports/messages", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [token]);

  // Filter computation
  const filteredMessages = messages.filter((m) => {
    const matchesLine = lineFilter === "all" || m.whatsappNumberName === lineFilter;
    const matchesReplyType = replyTypeFilter === "all" || m.replyType === replyTypeFilter;
    const matchesSender = senderFilter === "all" || m.sender === senderFilter;
    const matchesSearch = !search || 
      m.contactName?.toLowerCase().includes(search.toLowerCase()) ||
      m.contactPhone?.includes(search) ||
      m.content?.toLowerCase().includes(search.toLowerCase());

    return matchesLine && matchesReplyType && matchesSender && matchesSearch;
  });

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredMessages.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = ["Message ID", "Contact Name", "Contact Phone", "WhatsApp Line", "Content", "Sender Type", "Reply Type", "Timestamp"];
    const rows = filteredMessages.map(m => [
      m.id,
      m.contactName || "Unknown",
      m.contactPhone,
      m.whatsappNumberName,
      `"${m.content.replace(/"/g, '""')}"`,
      m.sender,
      m.replyType || "N/A",
      new Date(m.timestamp).toLocaleString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `intalent_whatsapp_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick stats calculations
  const totalMsgs = filteredMessages.length;
  const inboundCount = filteredMessages.filter(m => m.sender === "contact").length;
  const outboundCount = filteredMessages.filter(m => m.sender === "user").length;
  const aiReplies = filteredMessages.filter(m => m.replyType === "ai").length;
  const manualReplies = filteredMessages.filter(m => m.replyType === "manual").length;
  const workflowReplies = filteredMessages.filter(m => m.replyType === "workflow").length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 font-sans text-zinc-100">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Recruiting Reports & Audits</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Analyze historical conversation data, recruiter reply methods, and download compliance audits.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="bg-emerald-600 text-white hover:bg-emerald-500 font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition shadow shadow-emerald-900/10 cursor-pointer self-start"
        >
          <Download className="h-4 w-4" />
          Export to CSV
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-xl">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Filtered Volume</span>
          <p className="text-2xl font-bold text-zinc-100 mt-1">{totalMsgs}</p>
        </div>
        <div className="bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-xl">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Inbound Received</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{inboundCount}</p>
        </div>
        <div className="bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-xl">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Team Replies</span>
          <p className="text-2xl font-bold text-indigo-400 mt-1">{outboundCount}</p>
        </div>
        <div className="bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-xl">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">AI Suggestions Used</span>
          <p className="text-2xl font-bold text-purple-400 mt-1">{aiReplies}</p>
        </div>
        <div className="bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-xl col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Workflow Autopilot</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{workflowReplies}</p>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-[#0c0c0e] p-4 border border-zinc-800 rounded-2xl shadow-xl grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-zinc-400 font-semibold block mb-1">Filter by Line</span>
          <select
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900 text-zinc-100"
          >
            <option value="all">All Channels</option>
            {numbersList.map(num => (
              <option key={num.id} value={num.displayName}>{num.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="text-zinc-400 font-semibold block mb-1">Reply Category</span>
          <select
            value={replyTypeFilter}
            onChange={(e) => setReplyTypeFilter(e.target.value)}
            className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900 text-zinc-100"
          >
            <option value="all">All Methods</option>
            <option value="manual">Manual Recruiter</option>
            <option value="ai">AI Suggestion</option>
            <option value="workflow">Workflow Autopilot</option>
          </select>
        </div>

        <div>
          <span className="text-zinc-400 font-semibold block mb-1">Sender Type</span>
          <select
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
            className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900 text-zinc-100"
          >
            <option value="all">All Senders</option>
            <option value="contact">Contact Only</option>
            <option value="user">Operator Only</option>
            <option value="system">Autopilot/Workflow</option>
          </select>
        </div>

        <div>
          <span className="text-zinc-400 font-semibold block mb-1">Quick Search content</span>
          <input
            type="text"
            placeholder="Search candidate, phone, message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900 text-zinc-100 placeholder-zinc-500"
          />
        </div>
      </div>

      {/* Grid: Audit Logs Table */}
      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-zinc-200 text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Audit Messages History Log
          </h3>
          <span className="text-xs bg-zinc-900 text-zinc-400 border border-zinc-800 px-2.5 py-1 rounded-full font-medium">Compliance Checked</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-sm text-zinc-500">Loading historical audit reports...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-sm text-zinc-500">No message records found matching selected filters.</div>
          ) : (
            <table className="w-full text-left border-collapse text-xs text-zinc-300">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-800 font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Candidate</th>
                  <th className="p-4">WhatsApp Line</th>
                  <th className="p-4">Message Log Content</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredMessages.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-900/40">
                    <td className="p-4 font-mono text-zinc-500">
                      {new Date(m.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 font-semibold text-zinc-200">
                      <div>{m.contactName || "Candidate"}</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{m.contactPhone}</div>
                    </td>
                    <td className="p-4 text-zinc-400 font-medium">
                      {m.whatsappNumberName}
                    </td>
                    <td className="p-4 text-zinc-300 max-w-sm truncate leading-relaxed" title={m.content}>
                      {m.content}
                    </td>
                    <td className="p-4 capitalize">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.sender === "contact" 
                          ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" 
                          : m.sender === "system" 
                            ? "bg-teal-950/40 text-teal-400 border border-teal-900/40" 
                            : "bg-indigo-950/40 text-indigo-400 border border-indigo-900/40"
                      }`}>
                        {m.sender}
                      </span>
                    </td>
                    <td className="p-4">
                      {m.replyType && m.replyType !== "none" ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 capitalize">
                          {m.replyType}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
