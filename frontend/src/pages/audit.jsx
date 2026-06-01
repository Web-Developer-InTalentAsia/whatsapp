"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { complianceApi } from "../utils/api";
import toast from "react-hot-toast";

function pad(n) { return String(n).padStart(2, "0"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function thirtyDaysAgo() {
  const d = new Date(Date.now() - 30 * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const S = {
  card:         { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 },
  label:        { fontSize: 11, color: "var(--txt3)", marginBottom: 4, display: "block" },
  input:        { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "6px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" },
  btnSecondary: { background: "var(--bg3)", color: "var(--txt2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  th:           { padding: "10px 12px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" },
};

const ACTION_STYLE = {
  create: { background: "rgba(34,201,132,0.12)", color: "var(--green)" },
  update: { background: "rgba(79,123,255,0.12)", color: "var(--accent2)" },
  delete: { background: "rgba(232,66,90,0.12)", color: "var(--red)" },
  login:  { background: "rgba(20,184,166,0.12)", color: "var(--teal)" },
  logout: { background: "var(--bg3)", color: "var(--txt2)" },
};

function ActionBadge({ action }) {
  const key = Object.keys(ACTION_STYLE).find((k) => action?.toLowerCase().includes(k)) || "";
  const st = ACTION_STYLE[key] || { background: "var(--bg4)", color: "var(--txt2)" };
  return <span style={{ ...st, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{action}</span>;
}

function PayloadModal({ log, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ ...S.card, padding: 24, width: 560, maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>Audit Entry Detail</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--txt3)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, fontSize: 12 }}>
          {[
            ["Action",        log.action],
            ["Resource",      `${log.resource_type} / ${log.resource_id || "—"}`],
            ["User",          log.user_email],
            ["IP Address",    log.ip_address || "—"],
            ["Timestamp",     new Date(log.created_at).toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 16 }}>
              <span style={{ color: "var(--txt3)", minWidth: 80 }}>{k}</span>
              <span style={{ color: "var(--txt2)" }}>{v}</span>
            </div>
          ))}
        </div>
        {log.payload && (
          <>
            <p style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 6 }}>Payload</p>
            <pre style={{
              flex: 1, overflowY: "auto", background: "var(--bg3)", border: "1px solid var(--border)",
              borderRadius: 6, padding: 12, fontSize: 11, color: "var(--txt2)", fontFamily: "DM Mono,monospace",
              whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filters, setFilters] = useState({
    resource_type: "",
    action: "",
    start_date: thirtyDaysAgo(),
    end_date: todayStr(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (filters.resource_type) params.resource_type = filters.resource_type;
      if (filters.action) params.action = filters.action;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      const res = await complianceApi.getAuditLog(params);
      setLogs(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      if (e.response?.status === 403) {
        toast.error("Auditor role required to view audit log");
      } else {
        toast.error("Failed to load audit log");
      }
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const RESOURCE_TYPES = ["", "employee", "payroll_period", "payslip", "leave_request", "attendance", "user", "compliance"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {selectedLog && <PayloadModal log={selectedLog} onClose={() => setSelectedLog(null)} />}

      {/* Header */}
      <div>
        <p style={{ fontSize: 18, fontWeight: 600, color: "var(--txt)" }}>Audit Log</p>
        <p style={{ fontSize: 12, color: "var(--txt3)" }}>Immutable record of all system actions — {total} entries</p>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={S.label}>Resource Type</label>
          <select value={filters.resource_type} onChange={(e) => { setFilters({ ...filters, resource_type: e.target.value }); setPage(1); }} style={S.input}>
            {RESOURCE_TYPES.map((r) => <option key={r} value={r}>{r || "All types"}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Action Contains</label>
          <input type="text" placeholder="e.g. create, update…" value={filters.action} onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1); }}
            style={{ ...S.input, width: 180 }} />
        </div>
        <div>
          <label style={S.label}>From</label>
          <input type="date" value={filters.start_date} onChange={(e) => { setFilters({ ...filters, start_date: e.target.value }); setPage(1); }} style={S.input} />
        </div>
        <div>
          <label style={S.label}>To</label>
          <input type="date" value={filters.end_date} onChange={(e) => { setFilters({ ...filters, end_date: e.target.value }); setPage(1); }} style={S.input} />
        </div>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={S.th}>Timestamp</th>
                <th style={S.th}>User</th>
                <th style={S.th}>Action</th>
                <th style={S.th}>Resource</th>
                <th style={S.th}>Resource ID</th>
                <th style={S.th}>IP Address</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "40px 0", textAlign: "center", color: "var(--txt3)" }}>Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "40px 0", textAlign: "center", color: "var(--txt3)" }}>No audit entries found</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                  onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}>
                  <td style={{ padding: "9px 12px", color: "var(--txt3)", fontFamily: "DM Mono,monospace", fontSize: 11, whiteSpace: "nowrap" }}>
                    {new Date(log.created_at).toLocaleString("en-LK", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td style={{ padding: "9px 12px", color: "var(--txt2)", fontSize: 11 }}>{log.user_email || "system"}</td>
                  <td style={{ padding: "9px 12px" }}><ActionBadge action={log.action} /></td>
                  <td style={{ padding: "9px 12px", color: "var(--txt2)" }}>{log.resource_type || "—"}</td>
                  <td style={{ padding: "9px 12px", color: "var(--txt3)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>
                    {log.resource_id ? `${log.resource_id.slice(0, 12)}…` : "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: "var(--txt3)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{log.ip_address || "—"}</td>
                  <td style={{ padding: "9px 12px" }}>
                    {log.payload && (
                      <button onClick={() => setSelectedLog(log)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                        <Eye style={{ width: 12, height: 12 }} /> View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--txt3)" }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ ...S.btnSecondary, padding: "4px 8px", opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ ...S.btnSecondary, padding: "4px 8px", opacity: page === totalPages ? 0.4 : 1 }}>
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
