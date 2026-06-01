"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Calendar, Plus, X, Check, Trash2,
  RefreshCw, Users, Gift, BarChart2, Download,
} from "lucide-react";
import { leaveApi, employeeApi, authApi } from "../utils/api";
import { exportXlsx, todayTag } from "../utils/exportXlsx";
import toast from "react-hot-toast";

// ─── Colour palette for leave type avatars ──────────────────────────────────
const TYPE_COLORS = [
  { bg: "linear-gradient(135deg,#4f7bff,#818cf8)", text: "#fff", dot: "#4f7bff" },
  { bg: "linear-gradient(135deg,#10b981,#34d399)", text: "#fff", dot: "#10b981" },
  { bg: "linear-gradient(135deg,#f59e0b,#fbbf24)", text: "#fff", dot: "#f59e0b" },
  { bg: "linear-gradient(135deg,#ef4444,#f87171)", text: "#fff", dot: "#ef4444" },
  { bg: "linear-gradient(135deg,#8b5cf6,#a78bfa)", text: "#fff", dot: "#8b5cf6" },
  { bg: "linear-gradient(135deg,#06b6d4,#22d3ee)", text: "#fff", dot: "#06b6d4" },
  { bg: "linear-gradient(135deg,#ec4899,#f9a8d4)", text: "#fff", dot: "#ec4899" },
  { bg: "linear-gradient(135deg,#14b8a6,#2dd4bf)", text: "#fff", dot: "#14b8a6" },
];

const STATUS_META = {
  pending:            { label: "Pending",         color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  supervisor_approved:{ label: "Supv. Approved",  color: "#06b6d4", bg: "rgba(6,182,212,0.12)"   },
  hr_approved:        { label: "HR Approved",      color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  client_approved:    { label: "Client Approved",  color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  approved:           { label: "Approved",         color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  rejected:           { label: "Rejected",         color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  cancelled:          { label: "Cancelled",        color: "#6b7280", bg: "rgba(107,114,128,0.12)"},
};

const DEFAULT_LEAVE_TYPES = [
  { code: "AL",  name: "Annual Leave",    days_entitled: 21, is_paid: true,  is_carry_forward: true,  max_carry_days: 7,  is_medical: false, requires_document: false },
  { code: "CL",  name: "Casual Leave",    days_entitled: 7,  is_paid: true,  is_carry_forward: false, max_carry_days: 0,  is_medical: false, requires_document: false },
  { code: "ML",  name: "Medical Leave",   days_entitled: 14, is_paid: true,  is_carry_forward: false, max_carry_days: 0,  is_medical: true,  requires_document: true  },
  { code: "MAT", name: "Maternity Leave", days_entitled: 84, is_paid: true,  is_carry_forward: false, max_carry_days: 0,  is_medical: true,  requires_document: true  },
];

const SL_HOLIDAYS_2026 = [
  { name: "Thai Pongal",              holiday_date: "2026-01-14", is_paid: true, is_recurring: true },
  { name: "Independence Day",         holiday_date: "2026-02-04", is_paid: true, is_recurring: true },
  { name: "Maha Sivarathri",          holiday_date: "2026-02-26", is_paid: true, is_recurring: false },
  { name: "Milad un-Nabi",            holiday_date: "2026-03-20", is_paid: true, is_recurring: false },
  { name: "Sinhala New Year Eve",     holiday_date: "2026-04-13", is_paid: true, is_recurring: true },
  { name: "Sinhala & Tamil New Year", holiday_date: "2026-04-14", is_paid: true, is_recurring: true },
  { name: "May Day",                  holiday_date: "2026-05-01", is_paid: true, is_recurring: true },
  { name: "Vesak Full Moon Poya",     holiday_date: "2026-05-13", is_paid: true, is_recurring: false },
  { name: "Poson Full Moon Poya",     holiday_date: "2026-06-11", is_paid: true, is_recurring: false },
  { name: "Nikini Full Moon Poya",    holiday_date: "2026-08-08", is_paid: true, is_recurring: false },
  { name: "Christmas Day",            holiday_date: "2026-12-25", is_paid: true, is_recurring: true },
];

const S = {
  card:     { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 },
  label:    { fontSize: 11, color: "var(--txt3)", marginBottom: 4, display: "block" },
  input:    { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "7px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none" },
  select:   { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "7px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none", cursor: "pointer" },
  btnPri:   { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnSec:   { background: "var(--bg3)", color: "var(--txt2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnDanger:{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
  return (
    <span style={{ background: m.bg, color: m.color, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>
      {m.label}
    </span>
  );
}

function TypeAvatar({ name, idx, size = 40 }) {
  const c = TYPE_COLORS[idx % TYPE_COLORS.length];
  const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "LV";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.3, fontWeight: 700, color: c.text, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function DonutChart({ segments, size = 120 }) {
  const r = 44, cx = 60, cy = 60, strokeW = 12;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const arcs = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const dash = (seg.value / total) * circumference;
    const gap  = circumference - dash;
    arcs.push(
      <circle key={i} cx={cx} cy={cy} r={r} fill="none"
        stroke={seg.color} strokeWidth={strokeW}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "60px 60px" }}
      />
    );
    offset += dash;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeW} />
      {arcs}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--txt)">{total}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="var(--txt3)">Total</text>
    </svg>
  );
}

function MiniBar({ data, height = 80 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: "100%", borderRadius: "3px 3px 0 0", background: d.color || "var(--accent)", height: `${(d.value / max) * (height - 20)}px`, minHeight: d.value > 0 ? 4 : 2, opacity: d.value > 0 ? 1 : 0.3, transition: "height .3s" }} />
          <span style={{ fontSize: 9, color: "var(--txt3)", textAlign: "center", lineHeight: 1.2 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, width, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--txt3)", cursor: "pointer", padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({ requests, holidays, balances, leaveTypes, loading, isAdmin }) {
  const now = new Date();
  const newCount      = requests.filter(r => r.status === "pending").length;
  const approvedCount = requests.filter(r => r.status === "approved").length;
  const rejectedCount = requests.filter(r => r.status === "rejected").length;
  const cancelledCount = requests.filter(r => r.status === "cancelled").length;

  const upcoming    = holidays.filter(h => new Date(h.holiday_date) >= now).sort((a,b) => new Date(a.holiday_date) - new Date(b.holiday_date));
  const nextHoliday = upcoming[0];

  const donutSegs = leaveTypes.map((lt, i) => {
    const bal = balances.find(b => b.leave_type_id === lt.id);
    return { value: bal ? Math.max(0, bal.remaining) : lt.days_entitled, color: TYPE_COLORS[i % TYPE_COLORS.length].dot, name: lt.name };
  }).filter(s => s.value > 0);

  // Recent requests for table (last 8)
  const recentReqs = [...requests].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)).slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Top stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "New Requests",      value: newCount,       color: "#4f7bff", bg: "rgba(79,123,255,0.08)",  icon: "📋" },
          { label: "Approved",          value: approvedCount,  color: "#10b981", bg: "rgba(16,185,129,0.08)", icon: "✅" },
          { label: "Rejected",          value: rejectedCount,  color: "#ef4444", bg: "rgba(239,68,68,0.08)",  icon: "❌" },
          { label: "Cancelled",         value: cancelledCount, color: "#6b7280", bg: "rgba(107,114,128,0.08)",icon: "🚫" },
        ].map(k => (
          <div key={k.label} style={{ ...S.card, padding: "18px 20px", borderLeft: `3px solid ${k.color}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 8, fontWeight: 500 }}>{k.label}</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: "var(--txt)", fontFamily: "DM Mono,monospace", lineHeight: 1 }}>
                  {loading ? <span style={{ fontSize: 20, color: "var(--txt3)" }}>—</span> : k.value}
                </div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{k.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Next holiday banner ── */}
      {nextHoliday && (
        <div style={{ background: "linear-gradient(135deg,rgba(79,123,255,0.1),rgba(168,85,247,0.07))", border: "1px solid rgba(79,123,255,0.2)", borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#4f7bff,#a855f7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(79,123,255,0.3)" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{new Date(nextHoliday.holiday_date).getDate()}</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.8)" }}>{new Date(nextHoliday.holiday_date).toLocaleString("default", { month: "short" }).toUpperCase()}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--txt3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>Next Holiday</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--txt)" }}>{nextHoliday.name}</div>
            <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
              {new Date(nextHoliday.holiday_date).toLocaleDateString("en-LK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {nextHoliday.is_paid && <span style={{ marginLeft: 8, color: "#10b981" }}>· Paid Holiday</span>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
            {(() => {
              const diff = Math.ceil((new Date(nextHoliday.holiday_date) - now) / (1000*60*60*24));
              return <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, background: "rgba(79,123,255,0.12)", padding: "4px 10px", borderRadius: 6 }}>{diff <= 0 ? "Today!" : `In ${diff} day${diff !== 1 ? "s" : ""}`}</span>;
            })()}
          </div>
        </div>
      )}

      {/* ── Main 3-column grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 220px", gap: 12, alignItems: "start" }}>

        {/* LEFT: Available Leave donut */}
        <div style={{ ...S.card, padding: "16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)", marginBottom: 14 }}>Available Leave</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <DonutChart segments={donutSegs.length ? donutSegs : [{ value: 1, color: "#374151" }]} size={130} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leaveTypes.slice(0, 6).map((lt, i) => {
              const bal = balances.find(b => b.leave_type_id === lt.id);
              const rem = bal ? Math.max(0, bal.remaining) : lt.days_entitled;
              const used = bal ? bal.used_days : 0;
              const total = bal ? bal.entitled_days : lt.days_entitled;
              const pct = total > 0 ? Math.min(100, (rem / total) * 100) : 0;
              return (
                <div key={lt.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLORS[i % TYPE_COLORS.length].dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "var(--txt2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>{lt.name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--txt)", fontFamily: "DM Mono,monospace" }}>{rem}/{total}</span>
                  </div>
                  <div style={{ height: 4, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: TYPE_COLORS[i % TYPE_COLORS.length].dot, borderRadius: 2, transition: "width .4s" }} />
                  </div>
                </div>
              );
            })}
            {leaveTypes.length === 0 && <span style={{ fontSize: 11, color: "var(--txt3)", textAlign: "center", padding: "8px 0" }}>No leave types configured</span>}
          </div>
        </div>

        {/* CENTRE: Total Leave Requests table */}
        <div style={{ ...S.card }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Calendar size={14} color="var(--accent)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>Total Leave Requests</span>
              <span style={{ fontSize: 11, color: "var(--txt3)", background: "var(--bg3)", padding: "1px 7px", borderRadius: 10 }}>{requests.length}</span>
            </div>
            {/* Status legend */}
            <div style={{ display: "flex", gap: 10 }}>
              {[["pending","#f59e0b","Requested"],["approved","#10b981","Approved"],["cancelled","#6b7280","Cancelled"],["rejected","#ef4444","Rejected"]].map(([s,c,l]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
                  <span style={{ fontSize: 10, color: "var(--txt3)" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Employee","Leave Type","Start Date","End Date","Days","Status"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)" }}>Loading…</td></tr>
                ) : recentReqs.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "28px 0", textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>No leave requests yet</td></tr>
                ) : recentReqs.map(r => {
                  const lt = leaveTypes.find(t => t.id === r.leave_type_id);
                  const ltIdx = leaveTypes.findIndex(t => t.id === r.leave_type_id);
                  const c = TYPE_COLORS[ltIdx >= 0 ? ltIdx % TYPE_COLORS.length : 0];
                  const sm = STATUS_META[r.status] || { label: r.status, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
                  return (
                    <tr key={r.id}
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                      onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}
                    >
                      <td style={{ padding: "8px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: c.text, flexShrink: 0 }}>
                            {r.employee_name ? r.employee_name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "??"}
                          </div>
                          <span style={{ color: "var(--txt)", fontWeight: 500, fontSize: 11 }}>{r.employee_name || "—"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ color: c.dot, fontWeight: 500, fontSize: 11 }}>{lt?.name || "—"}</span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{r.start_date}</td>
                      <td style={{ padding: "8px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{r.end_date}</td>
                      <td style={{ padding: "8px 12px", color: "var(--txt)", fontFamily: "DM Mono,monospace", fontWeight: 600, fontSize: 11 }}>{r.total_days}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ background: sm.bg, color: sm.color, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                          {sm.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Upcoming holidays */}
        <div style={{ ...S.card }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 7 }}>
            <Gift size={13} color="var(--accent)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)" }}>Upcoming Holidays</span>
          </div>
          {upcoming.length === 0 ? (
            <div style={{ padding: "20px 14px", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
              No more holidays<br />scheduled this year
            </div>
          ) : upcoming.slice(0, 8).map((h, idx) => {
            const d = new Date(h.holiday_date);
            const isNext = idx === 0;
            return (
              <div key={h.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", background: isNext ? "rgba(79,123,255,0.04)" : "" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: isNext ? "linear-gradient(135deg,#4f7bff,#a855f7)" : "var(--bg3)", border: `1px solid ${isNext ? "transparent" : "var(--border2)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isNext ? "#fff" : "var(--txt)", lineHeight: 1 }}>{d.getDate()}</span>
                  <span style={{ fontSize: 8, color: isNext ? "rgba(255,255,255,0.8)" : "var(--txt3)" }}>{d.toLocaleString("default",{month:"short"}).toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: isNext ? "var(--txt)" : "var(--txt2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                  <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 1 }}>
                    {d.toLocaleDateString("en-LK",{weekday:"short"})}
                    {h.is_paid && <span style={{ color: "#10b981", marginLeft: 4 }}>· Paid</span>}
                  </div>
                </div>
                {isNext && <span style={{ fontSize: 9, color: "#fff", background: "#4f7bff", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>Next</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── My Requests Tab ──────────────────────────────────────────────────────────
function RequestsTab({ requests, balances, leaveTypes, loading, onRefresh, currentUser }) {
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected]   = useState([]);
  const [form, setForm]           = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.leave_type_id || !form.start_date || !form.end_date) { toast.error("Fill all required fields"); return; }
    setSubmitting(true);
    try {
      await leaveApi.submitRequest(form);
      toast.success("Leave request submitted");
      setShowModal(false);
      setForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to submit"); }
    finally { setSubmitting(false); }
  }

  async function handleCancel(id) {
    if (!confirm("Cancel this leave request?")) return;
    try { await leaveApi.cancel(id); toast.success("Cancelled"); onRefresh(); }
    catch (err) { toast.error(err.response?.data?.detail || "Cannot cancel"); }
  }

  const toggleSelect = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(s => s.length === requests.length ? [] : requests.map(r => r.id));
  const isEmployee = currentUser?.role === "employee";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Leave type summary cards */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "thin" }}>
        {leaveTypes.map((lt, i) => {
          const bal = balances.find(b => b.leave_type_id === lt.id);
          const c = TYPE_COLORS[i % TYPE_COLORS.length];
          return (
            <div key={lt.id} style={{ ...S.card, minWidth: 155, flexShrink: 0, overflow: "hidden", position: "relative" }}>
              <div style={{ height: 3, background: c.bg }} />
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <TypeAvatar name={lt.name} idx={i} size={32} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--txt)", lineHeight: 1.3, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lt.name}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    ["Available", bal ? Math.max(0, bal.remaining) : lt.days_entitled],
                    ["Carry Fwd", bal ? bal.carried_forward : 0],
                    ["Total",     bal ? bal.entitled_days    : lt.days_entitled],
                    ["Used",      bal ? bal.used_days        : 0],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--txt)", fontFamily: "DM Mono,monospace" }}>{val}</div>
                      <div style={{ fontSize: 9, color: "var(--txt3)" }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {leaveTypes.length === 0 && (
          <div style={{ color: "var(--txt3)", fontSize: 12, padding: "16px 0" }}>No leave types configured. Ask HR to add leave types.</div>
        )}
      </div>

      {/* Requests table */}
      <div style={{ ...S.card }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={14} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>My Leave Requests</span>
            <span style={{ fontSize: 11, color: "var(--txt3)", background: "var(--bg3)", padding: "2px 8px", borderRadius: 10 }}>{requests.length}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {["pending","approved","rejected"].map(s => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_META[s]?.color }} />
                  <span style={{ fontSize: 10, color: "var(--txt3)" }}>{STATUS_META[s]?.label}</span>
                </div>
              ))}
            </div>
            {isEmployee && (
              <button onClick={() => setShowModal(true)} style={S.btnPri}>
                <Plus size={13} /> Apply Leave
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", width: 36 }}>
                  <input type="checkbox" checked={selected.length === requests.length && requests.length > 0} onChange={toggleAll} style={{ cursor: "pointer" }} />
                </th>
                {["Leave Type","From","To","Days","Status","Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "28px 0", textAlign: "center", color: "var(--txt3)" }}>Loading…</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "28px 0", textAlign: "center", color: "var(--txt3)" }}>No leave requests found</td></tr>
              ) : requests.map(r => {
                const lt    = leaveTypes.find(t => t.id === r.leave_type_id);
                const ltIdx = leaveTypes.findIndex(t => t.id === r.leave_type_id);
                const c     = TYPE_COLORS[ltIdx >= 0 ? ltIdx % TYPE_COLORS.length : 0];
                const canCancel = ["pending","supervisor_approved","hr_approved"].includes(r.status);
                return (
                  <tr key={r.id}
                    style={{ borderBottom: "1px solid var(--border)", background: selected.includes(r.id) ? "rgba(79,123,255,0.04)" : "" }}
                    onMouseEnter={e => !selected.includes(r.id) && e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                    onMouseLeave={e => !selected.includes(r.id) && e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}
                  >
                    <td style={{ padding: "9px 12px" }}>
                      <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: c.text, flexShrink: 0 }}>
                          {lt ? lt.name.slice(0, 2).toUpperCase() : "LV"}
                        </div>
                        <span style={{ color: "var(--txt)", fontWeight: 500 }}>{lt?.name || "Unknown"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{r.start_date}</td>
                    <td style={{ padding: "9px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{r.end_date}</td>
                    <td style={{ padding: "9px 12px", color: "var(--txt)", fontFamily: "DM Mono,monospace", fontWeight: 600 }}>{r.total_days}</td>
                    <td style={{ padding: "9px 12px" }}><StatusBadge status={r.status} /></td>
                    <td style={{ padding: "9px 12px" }}>
                      {canCancel && (
                        <button onClick={() => handleCancel(r.id)} style={S.btnDanger}>
                          <X size={11} /> Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title="Create Leave Request" onClose={() => setShowModal(false)} width={500}>
          {/* Available days for selected type */}
          {form.leave_type_id && (() => {
            const lt = leaveTypes.find(t => t.id === form.leave_type_id);
            const bal = balances.find(b => b.leave_type_id === form.leave_type_id);
            const avail = bal ? Math.max(0, bal.remaining) : lt?.days_entitled || 0;
            return (
              <div style={{ background: "rgba(79,123,255,0.08)", border: "1px solid rgba(79,123,255,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--txt2)" }}>Available Leaves</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)", fontFamily: "DM Mono,monospace" }}>{avail} days</span>
              </div>
            );
          })()}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>Leave Type *</label>
              <select value={form.leave_type_id} onChange={e => setForm({ ...form, leave_type_id: e.target.value })} style={S.select} required>
                <option value="">— Select leave type —</option>
                {leaveTypes.map((lt, i) => {
                  const bal = balances.find(b => b.leave_type_id === lt.id);
                  const avail = bal ? Math.max(0, bal.remaining) : lt.days_entitled;
                  return <option key={lt.id} value={lt.id}>{lt.name} — {avail} days available</option>;
                })}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={S.label}>Start Date *</label>
                <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} style={S.input} required />
              </div>
              <div>
                <label style={S.label}>Start Day Type</label>
                <select value={form.start_type || "full"} onChange={e => setForm({ ...form, start_type: e.target.value })} style={S.select}>
                  <option value="full">Full Day</option>
                  <option value="half_am">Half Day (AM)</option>
                  <option value="half_pm">Half Day (PM)</option>
                </select>
              </div>
              <div>
                <label style={S.label}>End Date *</label>
                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={S.input} required min={form.start_date} />
              </div>
              <div>
                <label style={S.label}>End Day Type</label>
                <select value={form.end_type || "full"} onChange={e => setForm({ ...form, end_type: e.target.value })} style={S.select}>
                  <option value="full">Full Day</option>
                  <option value="half_am">Half Day (AM)</option>
                  <option value="half_pm">Half Day (PM)</option>
                </select>
              </div>
            </div>

            {/* Calculated days */}
            {form.start_date && form.end_date && (() => {
              const diff = Math.max(1, Math.ceil((new Date(form.end_date) - new Date(form.start_date)) / (1000*60*60*24)) + 1);
              const isHalf = (form.start_type || "full") !== "full" || (form.end_type || "full") !== "full";
              return (
                <div style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 7, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--txt2)" }}>Requested Days</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--txt)", fontFamily: "DM Mono,monospace" }}>
                    {isHalf ? `${diff - 0.5}` : diff} day{diff !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })()}

            <div>
              <label style={S.label}>Description</label>
              <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                style={{ ...S.input, minHeight: 72, resize: "vertical" }} placeholder="Reason for leave request…" />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={() => setShowModal(false)} style={S.btnSec}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...S.btnPri, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Leave Requests Admin Tab ─────────────────────────────────────────────────
function LeaveRequestsTab({ requests, leaveTypes, loading, isAdmin, onRefresh }) {
  const [detail, setDetail]       = useState(null);
  const [actionNote, setActionNote] = useState("");
  const [actioning, setActioning] = useState(null); // request id being actioned
  const [filterStatus, setFilterStatus] = useState("");

  async function doAction(id, action) {
    setActioning(id);
    try {
      await leaveApi.adminAction(id, action, actionNote || undefined);
      toast.success(`Leave request ${action}d`);
      setDetail(null);
      setActionNote("");
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action}`);
    } finally { setActioning(null); }
  }

  const filtered = filterStatus ? requests.filter(r => r.status === filterStatus) : requests;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Status filter row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--txt3)" }}>Filter:</span>
        {[["", "All"], ["pending","Requested"], ["approved","Approved"], ["cancelled","Cancelled"], ["rejected","Rejected"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilterStatus(v)} style={{
            padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer",
            border: "1px solid", fontFamily: "inherit", transition: "all .15s",
            background: filterStatus === v ? "var(--accent)" : "var(--bg3)",
            color: filterStatus === v ? "#fff" : "var(--txt2)",
            borderColor: filterStatus === v ? "var(--accent)" : "var(--border2)",
          }}>{l} {v === "" ? `(${requests.length})` : `(${requests.filter(r => r.status === v).length})`}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {[["pending","#f59e0b","Requested"],["approved","#10b981","Approved"],["cancelled","#6b7280","Cancelled"],["rejected","#ef4444","Rejected"]].map(([s,c,l]) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
              <span style={{ fontSize: 11, color: "var(--txt3)" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...S.card }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Calendar size={14} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>Leave Requests</span>
            <span style={{ fontSize: 11, color: "var(--txt3)", background: "var(--bg3)", padding: "1px 7px", borderRadius: 10 }}>{filtered.length}</span>
          </div>
          <button onClick={() => {
            const s = document.createElement("span");
            s.style.display = "none"; document.body.appendChild(s);
            const allEl = document.querySelectorAll(".leave-req-checkbox");
            const allChecked = Array.from(allEl).every(el => el.checked);
            allEl.forEach(el => el.checked = !allChecked);
            document.body.removeChild(s);
          }} style={{ ...S.btnSec, fontSize: 11, padding: "5px 10px" }}>Select All Requests</button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", width: 36 }}>
                  <input type="checkbox" style={{ cursor: "pointer" }} />
                </th>
                {["Employee","Leave Type","Start Date","End Date","Requested Days","Status","Confirmation"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: "28px 0", textAlign: "center", color: "var(--txt3)" }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "28px 0", textAlign: "center", color: "var(--txt3)" }}>No requests found</td></tr>
              ) : filtered.map(r => {
                const lt = leaveTypes.find(t => t.id === r.leave_type_id);
                const ltIdx = leaveTypes.findIndex(t => t.id === r.leave_type_id);
                const c = TYPE_COLORS[ltIdx >= 0 ? ltIdx % TYPE_COLORS.length : 0];
                const sm = STATUS_META[r.status] || { label: r.status, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
                const isPending = r.status === "pending";
                const isActioning = actioning === r.id;
                return (
                  <tr key={r.id}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                    onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}
                    onClick={() => setDetail(r)}
                  >
                    <td style={{ padding: "9px 12px" }} onClick={e => e.stopPropagation()}>
                      <input className="leave-req-checkbox" type="checkbox" style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: c.text, flexShrink: 0 }}>
                          {r.employee_name ? r.employee_name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "??"}
                        </div>
                        <div>
                          <div style={{ color: "var(--txt)", fontWeight: 500, fontSize: 12 }}>{r.employee_name || "—"}</div>
                          {r.employee_number && <div style={{ color: "var(--txt3)", fontSize: 10, fontFamily: "DM Mono,monospace" }}>({r.employee_number})</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ color: c.dot, fontWeight: 500, fontSize: 12 }}>{lt?.name || "—"}</span>
                    </td>
                    <td style={{ padding: "9px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{r.start_date}</td>
                    <td style={{ padding: "9px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{r.end_date}</td>
                    <td style={{ padding: "9px 12px", color: "var(--txt)", fontFamily: "DM Mono,monospace", fontWeight: 600 }}>{r.total_days}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ background: sm.bg, color: sm.color, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{sm.label}</span>
                    </td>
                    <td style={{ padding: "9px 12px" }} onClick={e => e.stopPropagation()}>
                      {isAdmin && isPending ? (
                        <div style={{ display: "flex", gap: 5 }}>
                          <button
                            onClick={() => doAction(r.id, "approve")}
                            disabled={isActioning}
                            style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            {isActioning ? "…" : "✓"}
                          </button>
                          <button
                            onClick={() => doAction(r.id, "reject")}
                            disabled={isActioning}
                            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            {isActioning ? "…" : "✗"}
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--txt3)" }}>
                          {r.status === "approved" ? <span style={{ color: "#10b981" }}>Approved</span>
                          : r.status === "rejected" ? <span style={{ color: "#ef4444" }}>Rejected</span>
                          : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── One Request View modal ── */}
      {detail && (() => {
        const lt = leaveTypes.find(t => t.id === detail.leave_type_id);
        const ltIdx = leaveTypes.findIndex(t => t.id === detail.leave_type_id);
        const c = TYPE_COLORS[ltIdx >= 0 ? ltIdx % TYPE_COLORS.length : 0];
        const sm = STATUS_META[detail.status] || { label: detail.status, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
        const isPending = detail.status === "pending";
        return (
          <Modal title="Leave Request Details" onClose={() => { setDetail(null); setActionNote(""); }} width={460}>
            {/* Employee header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 0 16px", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: c.text, flexShrink: 0 }}>
                {detail.employee_name ? detail.employee_name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "??"}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--txt)" }}>{detail.employee_name || "Unknown"}</div>
                {detail.employee_number && <div style={{ fontSize: 11, color: "var(--txt3)", fontFamily: "DM Mono,monospace" }}>({detail.employee_number})</div>}
              </div>
              <span style={{ marginLeft: "auto", background: sm.bg, color: sm.color, padding: "3px 10px", borderRadius: 5, fontSize: 12, fontWeight: 600 }}>{sm.label}</span>
            </div>

            {/* Details grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[
                ["Leave Type", <span style={{ color: c.dot, fontWeight: 600 }}>{lt?.name || "—"}</span>],
                ["Days", <span style={{ fontFamily: "DM Mono,monospace", fontWeight: 700 }}>{detail.total_days}</span>],
                ["Start Date", detail.start_date],
                ["End Date", detail.end_date],
                ["Created Date", detail.created_at?.slice(0,10) || "—"],
                ["Created By", detail.employee_name || "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ background: "var(--bg3)", borderRadius: 7, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "var(--txt3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
                  <div style={{ fontSize: 13, color: "var(--txt)", fontWeight: 500 }}>{val}</div>
                </div>
              ))}
            </div>

            {detail.reason && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" }}>Leave Description</div>
                <div style={{ background: "var(--bg3)", borderRadius: 7, padding: "10px 12px", fontSize: 12, color: "var(--txt2)", lineHeight: 1.6 }}>{detail.reason}</div>
              </div>
            )}

            {/* Admin approve/reject */}
            {isAdmin && isPending && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={S.label}>Note (optional)</label>
                  <input type="text" value={actionNote} onChange={e => setActionNote(e.target.value)}
                    style={S.input} placeholder="Add a note for the employee…" />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => doAction(detail.id, "approve")}
                    disabled={actioning === detail.id}
                    style={{ flex: 1, background: "#10b981", color: "#fff", border: "none", borderRadius: 7, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: actioning === detail.id ? 0.6 : 1 }}>
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => doAction(detail.id, "reject")}
                    disabled={actioning === detail.id}
                    style={{ flex: 1, background: "#ef4444", color: "#fff", border: "none", borderRadius: 7, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: actioning === detail.id ? 0.6 : 1 }}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            )}
          </Modal>
        );
      })()}
    </div>
  );
}

// ─── Holidays Tab ─────────────────────────────────────────────────────────────
function HolidaysTab({ holidays, loading, isAdmin, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ name: "", holiday_date: "", is_paid: true, is_recurring: false });
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected]   = useState([]);
  const [seeding, setSeeding]     = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.holiday_date) { toast.error("Name and date required"); return; }
    setSubmitting(true);
    try {
      await leaveApi.createHoliday(form);
      toast.success(`"${form.name}" added`);
      setForm({ name: "", holiday_date: "", is_paid: true, is_recurring: false });
      setShowModal(false);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to create holiday"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await leaveApi.deleteHoliday(id); toast.success("Holiday deleted"); onRefresh(); }
    catch (err) { toast.error(err.response?.data?.detail || "Cannot delete"); }
  }

  async function seedHolidays() {
    setSeeding(true);
    let added = 0;
    for (const h of SL_HOLIDAYS_2026) {
      try { await leaveApi.createHoliday(h); added++; } catch (_) {}
    }
    toast.success(`Seeded ${added} Sri Lankan public holidays`);
    setSeeding(false);
    onRefresh();
  }

  const toggleSelect = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(s => s.length === holidays.length ? [] : holidays.map(h => h.id));

  return (
    <div style={{ ...S.card }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Gift size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>Public Holidays</span>
          <span style={{ fontSize: 11, color: "var(--txt3)", background: "var(--bg3)", padding: "2px 8px", borderRadius: 10 }}>{holidays.length}</span>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8 }}>
            {holidays.length === 0 && (
              <button onClick={seedHolidays} disabled={seeding} style={{ ...S.btnSec, opacity: seeding ? 0.6 : 1 }}>
                <RefreshCw size={12} /> {seeding ? "Seeding…" : "Seed SL Holidays 2026"}
              </button>
            )}
            <button onClick={() => setShowModal(true)} style={S.btnPri}>
              <Plus size={13} /> Add Holiday
            </button>
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", width: 36 }}>
                <input type="checkbox" checked={selected.length === holidays.length && holidays.length > 0} onChange={toggleAll} style={{ cursor: "pointer" }} />
              </th>
              {["Holiday Name","Start Date","End Date","Recurring","Paid","Actions"].map(h => (
                <th key={h} style={{ padding: "8px 16px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: "28px 0", textAlign: "center", color: "var(--txt3)" }}>Loading…</td></tr>
            ) : holidays.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px 0", textAlign: "center" }}>
                  <div style={{ color: "var(--txt3)", fontSize: 12 }}>No holidays configured</div>
                  {isAdmin && <div style={{ color: "var(--txt3)", fontSize: 11, marginTop: 6 }}>Click "Seed SL Holidays 2026" to add Sri Lankan public holidays automatically</div>}
                </td>
              </tr>
            ) : holidays.map(h => {
              const d = new Date(h.holiday_date);
              return (
                <tr key={h.id}
                  style={{ borderBottom: "1px solid var(--border)", background: selected.includes(h.id) ? "rgba(79,123,255,0.04)" : "" }}
                  onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                  onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = selected.includes(h.id) ? "rgba(79,123,255,0.04)" : "")}
                >
                  <td style={{ padding: "9px 16px" }}>
                    <input type="checkbox" checked={selected.includes(h.id)} onChange={() => toggleSelect(h.id)} style={{ cursor: "pointer" }} />
                  </td>
                  <td style={{ padding: "9px 16px", color: "var(--txt)", fontWeight: 500 }}>{h.name}</td>
                  <td style={{ padding: "9px 16px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{h.holiday_date}</td>
                  <td style={{ padding: "9px 16px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{h.holiday_date}</td>
                  <td style={{ padding: "9px 16px" }}>
                    {h.is_recurring
                      ? <span style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500 }}>Yes</span>
                      : <span style={{ color: "var(--txt3)", fontSize: 11 }}>No</span>}
                  </td>
                  <td style={{ padding: "9px 16px" }}>
                    {h.is_paid
                      ? <span style={{ color: "#4f7bff", background: "rgba(79,123,255,0.1)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500 }}>Paid</span>
                      : <span style={{ color: "var(--txt3)", fontSize: 11 }}>Unpaid</span>}
                  </td>
                  <td style={{ padding: "9px 16px" }}>
                    {isAdmin && (
                      <button onClick={() => handleDelete(h.id, h.name)} style={S.btnDanger}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Add Public Holiday" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>Holiday Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} placeholder="e.g. Independence Day" required />
            </div>
            <div>
              <label style={S.label}>Date *</label>
              <input type="date" value={form.holiday_date} onChange={e => setForm({ ...form, holiday_date: e.target.value })} style={S.input} required />
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--txt2)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_paid} onChange={e => setForm({ ...form, is_paid: e.target.checked })} /> Paid Holiday
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--txt2)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_recurring} onChange={e => setForm({ ...form, is_recurring: e.target.checked })} /> Recurring (Annual)
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowModal(false)} style={S.btnSec}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...S.btnPri, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Adding…" : "Add Holiday"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Leave Types Tab ──────────────────────────────────────────────────────────
function LeaveTypesTab({ leaveTypes, loading, isAdmin, onRefresh }) {
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState({ code: "", name: "", days_entitled: 14, max_carry_days: 0, is_paid: true, is_medical: false, requires_document: false, is_carry_forward: false });
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding]       = useState(false);

  async function seedDefaultTypes() {
    setSeeding(true);
    let created = 0;
    for (const lt of DEFAULT_LEAVE_TYPES) {
      try { await leaveApi.createType(lt); created++; } catch (_) {}
    }
    toast.success(`Created ${created} default leave types`);
    setSeeding(false);
    onRefresh();
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.code || !form.name) { toast.error("Code and name required"); return; }
    setSubmitting(true);
    try {
      await leaveApi.createType(form);
      toast.success(`"${form.name}" created`);
      setForm({ code: "", name: "", days_entitled: 14, max_carry_days: 0, is_paid: true, is_medical: false, requires_document: false, is_carry_forward: false });
      setShowModal(false);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {isAdmin && leaveTypes.length === 0 && (
          <button onClick={seedDefaultTypes} disabled={seeding} style={{ ...S.btnSec, opacity: seeding ? 0.6 : 1 }}>
            <RefreshCw size={12} /> {seeding ? "Creating…" : "Seed Default Types"}
          </button>
        )}
        {isAdmin && (
          <button onClick={() => setShowModal(true)} style={S.btnPri}>
            <Plus size={13} /> New Leave Type
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "28px 0", textAlign: "center", color: "var(--txt3)" }}>Loading…</div>
      ) : leaveTypes.length === 0 ? (
        <div style={{ ...S.card, padding: 36, textAlign: "center" }}>
          <Calendar size={32} color="var(--txt3)" style={{ display: "block", margin: "0 auto 12px" }} />
          <div style={{ color: "var(--txt3)", fontSize: 13 }}>No leave types configured</div>
          {isAdmin && <div style={{ color: "var(--txt3)", fontSize: 11, marginTop: 6 }}>Click "New Leave Type" to add leave categories</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {leaveTypes.map((lt, i) => {
            const c = TYPE_COLORS[i % TYPE_COLORS.length];
            return (
              <div key={lt.id} style={{ ...S.card, overflow: "hidden" }}>
                <div style={{ height: 4, background: c.bg }} />
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <TypeAvatar name={lt.name} idx={i} size={36} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>{lt.name}</div>
                      <div style={{ fontSize: 10, color: "var(--txt3)", fontFamily: "DM Mono,monospace" }}>{lt.code}</div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--txt)", fontFamily: "DM Mono,monospace" }}>{lt.days_entitled}</div>
                      <div style={{ fontSize: 9, color: "var(--txt3)" }}>days/yr</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {lt.is_paid           && <span style={{ fontSize: 10, background: "rgba(16,185,129,0.1)", color: "#10b981", padding: "2px 7px", borderRadius: 4 }}>Paid</span>}
                    {lt.is_medical        && <span style={{ fontSize: 10, background: "rgba(239,68,68,0.1)",   color: "#ef4444", padding: "2px 7px", borderRadius: 4 }}>Medical</span>}
                    {lt.is_carry_forward  && <span style={{ fontSize: 10, background: "rgba(79,123,255,0.1)", color: "var(--accent)", padding: "2px 7px", borderRadius: 4 }}>Carry Fwd</span>}
                    {lt.requires_document && <span style={{ fontSize: 10, background: "rgba(245,158,11,0.1)", color: "#f59e0b", padding: "2px 7px", borderRadius: 4 }}>Cert Req.</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="New Leave Type" onClose={() => setShowModal(false)} width={520}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
              <div>
                <label style={S.label}>Code *</label>
                <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} style={S.input} placeholder="AL" maxLength={10} required />
              </div>
              <div>
                <label style={S.label}>Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} placeholder="Annual Leave" required />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={S.label}>Days Entitled / Year</label>
                <input type="number" value={form.days_entitled} onChange={e => setForm({ ...form, days_entitled: +e.target.value })} style={S.input} min={0} />
              </div>
              <div>
                <label style={S.label}>Max Carry Forward Days</label>
                <input type="number" value={form.max_carry_days} onChange={e => setForm({ ...form, max_carry_days: +e.target.value })} style={S.input} min={0} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["is_paid","Paid Leave"],["is_medical","Medical Leave"],["is_carry_forward","Carry Forward"],["requires_document","Certificate Required"]].map(([k, label]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--txt2)", cursor: "pointer", padding: "8px 12px", background: "var(--bg3)", borderRadius: 6, border: "1px solid var(--border2)" }}>
                  <input type="checkbox" checked={form[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} /> {label}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowModal(false)} style={S.btnSec}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...S.btnPri, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Allocations Tab ──────────────────────────────────────────────────────────
function AllocationsTab({ leaveTypes, isAdmin, onRefresh }) {
  const [allocations, setAllocations] = useState([]);
  const [employees, setEmployees]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState({ employee_id: "", leave_type_id: "", year: new Date().getFullYear(), entitled_days: 14, carried_forward: 0 });
  const [submitting, setSubmitting]   = useState(false);
  const [filterEmp, setFilterEmp]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterEmp ? { employee_id: filterEmp } : {};
      const r = await leaveApi.listAllocations(params);
      setAllocations(r.data || []);
    } catch { setAllocations([]); }
    finally { setLoading(false); }
  }, [filterEmp]);

  useEffect(() => {
    load();
    employeeApi.list({ page_size: 200 }).then(r => setEmployees(r.data?.items || [])).catch(() => {});
  }, [load]);

  async function handleAllocate(e) {
    e.preventDefault();
    if (!form.employee_id || !form.leave_type_id) { toast.error("Employee and leave type required"); return; }
    setSubmitting(true);
    try {
      const res = await leaveApi.allocate(form);
      toast.success(`Allocated ${form.entitled_days} days to ${res.data.employee_name}`);
      setShowModal(false);
      setForm({ employee_id: "", leave_type_id: "", year: new Date().getFullYear(), entitled_days: 14, carried_forward: 0 });
      load();
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || "Allocation failed"); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ ...S.select, width: 230 }}>
          <option value="">All Employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} style={S.btnPri}>
            <Plus size={13} /> Allocate Leave
          </button>
        )}
      </div>

      <div style={{ ...S.card }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>Leave Allocations</span>
          <span style={{ fontSize: 11, color: "var(--txt3)", background: "var(--bg3)", padding: "2px 8px", borderRadius: 10 }}>{allocations.length}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Employee","Leave Type","Year","Entitled","Carry Fwd","Used","Pending","Remaining"].map(h => (
                  <th key={h} style={{ padding: "8px 16px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: "28px 0", textAlign: "center", color: "var(--txt3)" }}>Loading…</td></tr>
              ) : allocations.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "32px 0", textAlign: "center" }}>
                    <div style={{ color: "var(--txt3)", fontSize: 12 }}>No allocations found</div>
                    {isAdmin && <div style={{ color: "var(--txt3)", fontSize: 11, marginTop: 6 }}>Click "Allocate Leave" to create leave profiles for employees</div>}
                  </td>
                </tr>
              ) : allocations.map(a => (
                <tr key={a.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                  onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}
                >
                  <td style={{ padding: "9px 16px", color: "var(--txt)", fontWeight: 500 }}>{a.employee_name}</td>
                  <td style={{ padding: "9px 16px", color: "var(--accent)" }}>{a.leave_type_name}</td>
                  <td style={{ padding: "9px 16px", color: "var(--txt2)", fontFamily: "DM Mono,monospace" }}>{a.year}</td>
                  <td style={{ padding: "9px 16px", color: "var(--txt)", fontFamily: "DM Mono,monospace" }}>{a.entitled_days}</td>
                  <td style={{ padding: "9px 16px", color: "var(--txt2)", fontFamily: "DM Mono,monospace" }}>{a.carried_forward}</td>
                  <td style={{ padding: "9px 16px", color: "#ef4444", fontFamily: "DM Mono,monospace" }}>{a.used_days}</td>
                  <td style={{ padding: "9px 16px", color: "#f59e0b", fontFamily: "DM Mono,monospace" }}>{a.pending_days}</td>
                  <td style={{ padding: "9px 16px", fontFamily: "DM Mono,monospace", fontWeight: 600, color: a.remaining > 0 ? "#10b981" : "#ef4444" }}>{a.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title="Allocate Leave to Employee" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAllocate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>Employee *</label>
              <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} style={S.select} required>
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} — {e.employee_number}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Leave Type *</label>
              <select value={form.leave_type_id} onChange={e => setForm({ ...form, leave_type_id: e.target.value })} style={S.select} required>
                <option value="">Select leave type</option>
                {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={S.label}>Year</label>
                <input type="number" value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })} style={S.input} min={2020} max={2035} />
              </div>
              <div>
                <label style={S.label}>Entitled Days</label>
                <input type="number" value={form.entitled_days} onChange={e => setForm({ ...form, entitled_days: +e.target.value })} style={S.input} min={0} step={0.5} />
              </div>
              <div>
                <label style={S.label}>Carry Forward</label>
                <input type="number" value={form.carried_forward} onChange={e => setForm({ ...form, carried_forward: +e.target.value })} style={S.input} min={0} step={0.5} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowModal(false)} style={S.btnSec}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...S.btnPri, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Allocating…" : "Allocate"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
const TABS = [
  { key: "dashboard",      label: "Dashboard"       },
  { key: "requests",       label: "My Requests"     },
  { key: "all_requests",   label: "Leave Requests"  },
  { key: "holidays",       label: "Holidays"        },
  { key: "types",          label: "Leave Types"     },
  { key: "allocations",    label: "Allocations"     },
];

export default function LeavePage() {
  const [tab, setTab]             = useState("dashboard");
  const [user, setUser]           = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [requests, setRequests]   = useState([]);
  const [balances, setBalances]   = useState([]);
  const [holidays, setHolidays]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const year = new Date().getFullYear();

  const isAdmin = ["super_admin","payroll_admin","client_admin","hr_user"].includes(user?.role);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [typesRes, reqRes, holRes] = await Promise.allSettled([
        leaveApi.listTypes(),
        leaveApi.listRequests({ page_size: 100 }),
        leaveApi.listHolidays(year),
      ]);
      const types = typesRes.status === "fulfilled" ? typesRes.value.data : [];
      setLeaveTypes(types);
      setRequests(reqRes.status === "fulfilled" ? (reqRes.value.data?.items || []) : []);
      setHolidays(holRes.status === "fulfilled" ? holRes.value.data : []);
      if (types.length > 0) {
        try { const r = await leaveApi.getBalances({ year }); setBalances(r.data || []); } catch { setBalances([]); }
      }
    } finally { setLoading(false); }
  }, [year]);

  useEffect(() => {
    authApi.me().then(r => setUser(r.data)).catch(() => {});
    loadAll();
  }, [loadAll]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--txt)" }}>Leave Management</p>
          <p style={{ fontSize: 12, color: "var(--txt3)" }}>Manage requests, allocations, holidays, and leave policies</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => {
            if (!requests.length) { toast.error("No data"); return; }
            const headers = ["Leave Type","Employee ID","From","To","Days","Status","Reason","Created"];
            const rows = requests.map(r => [
              leaveTypes.find(t => t.id === r.leave_type_id)?.name || r.leave_type_id,
              r.employee_id, r.start_date, r.end_date, r.total_days, r.status, r.reason || "", r.created_at?.slice(0,10),
            ]);
            exportXlsx(`leave_requests_${todayTag()}.xlsx`, "Leave Requests", headers, rows);
            toast.success("Excel downloaded");
          }} style={S.btnSec}><Download size={13} /> Export</button>
          <button onClick={loadAll} style={S.btnSec} title="Refresh"><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: 4, width: "fit-content", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer",
            fontFamily: "inherit", border: "none", transition: "all .15s",
            background: tab === t.key ? "var(--accent)" : "transparent",
            color:      tab === t.key ? "#fff"           : "var(--txt2)",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard"    && <DashboardTab      requests={requests} holidays={holidays} balances={balances} leaveTypes={leaveTypes} loading={loading} isAdmin={isAdmin} />}
      {tab === "requests"     && <RequestsTab       requests={requests} balances={balances} leaveTypes={leaveTypes} loading={loading} onRefresh={loadAll} currentUser={user} />}
      {tab === "all_requests" && <LeaveRequestsTab  requests={requests} leaveTypes={leaveTypes} loading={loading} isAdmin={isAdmin} onRefresh={loadAll} />}
      {tab === "holidays"     && <HolidaysTab       holidays={holidays} loading={loading} isAdmin={isAdmin} onRefresh={loadAll} />}
      {tab === "types"        && <LeaveTypesTab     leaveTypes={leaveTypes} loading={loading} isAdmin={isAdmin} onRefresh={loadAll} />}
      {tab === "allocations"  && <AllocationsTab    leaveTypes={leaveTypes} isAdmin={isAdmin} onRefresh={loadAll} />}
    </div>
  );
}
