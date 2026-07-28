import React, { useState, useEffect } from "react";
import { Shield, Clock, User, FileText, RefreshCw, Search } from "lucide-react";

interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

interface AuditLogsProps {
  token: string;
}

export default function AuditLogs({ token }: AuditLogsProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/audit-logs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !search ||
      log.userName?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 font-sans text-zinc-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-400" />
            Security & Activity Audit Logs
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Immutable tracking of credential saves, line changes, team assignments, and AI settings modifications.
          </p>
        </div>
        
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="text-xs bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 px-4 py-2 rounded-xl font-semibold transition flex items-center gap-2 disabled:opacity-50 cursor-pointer self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Audit trail
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="absolute inset-y-0 left-3 h-4 w-4 my-auto text-zinc-500" />
        <input
          type="text"
          placeholder="Filter audit by actor, action or detail content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0c0c0e] pl-9 pr-4 py-2.5 border border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-100 placeholder-zinc-500"
        />
      </div>

      {/* Logs list table */}
      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-sm text-zinc-500">Loading immutable system audit logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-sm text-zinc-500">No activity trail matched.</div>
          ) : (
            <table className="w-full text-left border-collapse text-xs text-zinc-300">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-800 font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="p-4 w-52">Timestamp</th>
                  <th className="p-4 w-48">Actor Operator</th>
                  <th className="p-4 w-48">Action Category</th>
                  <th className="p-4">Detailed Audit Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/40">
                    <td className="p-4 font-mono text-zinc-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center font-bold text-[10px]">
                          {log.userName ? log.userName.charAt(0) : "S"}
                        </div>
                        <span className="font-semibold text-zinc-200">{log.userName || "System Autopilot"}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 uppercase tracking-wider font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400 leading-relaxed font-mono text-[11px] whitespace-pre-wrap break-all bg-zinc-950/40">
                      {log.details}
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
