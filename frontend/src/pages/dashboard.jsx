"use client";
import { useEffect, useState } from "react";
import { reportsApi, payrollApi } from "../utils/api";

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_COLORS = {
  draft:           { bg: "rgba(79,123,255,.12)",  color: "#6b95ff" },
  calculated:      { bg: "rgba(79,123,255,.12)",  color: "#6b95ff" },
  hr_review:       { bg: "rgba(245,166,35,.12)",  color: "#f5a623" },
  client_approval: { bg: "rgba(245,166,35,.12)",  color: "#f5a623" },
  bank_file:       { bg: "rgba(168,85,247,.12)",  color: "#a855f7" },
  payslip_release: { bg: "rgba(20,184,166,.12)",  color: "#14b8a6" },
  completed:       { bg: "rgba(34,201,132,.12)",  color: "#22c984" },
  rejected:        { bg: "rgba(232,66,90,.12)",   color: "#e8425a" },
};

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: s.bg, color: s.color }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {status?.replace(/_/g, " ")}
    </span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function KpiCard({ label, value, change, changeUp, iconBg, iconColor, icon: Icon }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 6 }}>{label}</div>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon style={{ width: 16, height: 16 }} />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "var(--txt)", lineHeight: 1, letterSpacing: "-.5px", fontFamily: "'DM Mono', monospace" }}>{value}</div>
      {change && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11, color: changeUp ? "var(--green)" : "var(--red)" }}>
          {changeUp ? "▲" : "▼"} {change}
        </div>
      )}
    </Card>
  );
}

function MiniBarChart({ data, currentMonth }) {
  if (!data.length) return <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--txt3)", fontSize: 12 }}>No data yet</div>;
  const max = Math.max(...data.map(d => d.total_gross || 0), 1);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80, padding: "0 4px" }}>
      {data.map((d, i) => {
        const h = Math.max(4, Math.round((d.total_gross / max) * 70));
        const isCurrent = d.month === currentMonth;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: isCurrent ? "var(--accent)" : "var(--bg4)" }} />
            <div style={{ fontSize: 10, color: isCurrent ? "var(--accent)" : "var(--txt3)" }}>{MONTH_NAMES[d.month]}</div>
          </div>
        );
      })}
    </div>
  );
}

const DONUT_COLORS = ["#4f7bff","#22c984","#f5a623","#a855f7","#5a6280"];
const DONUT_LABELS = ["Engineering","Operations","Sales","HR & Admin","Others"];

function DonutChart({ total }) {
  const circumference = 2 * Math.PI * 32;
  const slices = [0.40, 0.26, 0.16, 0.10, 0.08];
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width="90" height="90" viewBox="0 0 90 90" style={{ flexShrink: 0 }}>
        <circle cx="45" cy="45" r="32" fill="none" stroke="var(--bg3)" strokeWidth="14" />
        {slices.map((pct, i) => {
          const dash = pct * circumference;
          const el = (
            <circle key={i} cx="45" cy="45" r="32" fill="none"
              stroke={DONUT_COLORS[i]} strokeWidth="14"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
        <text x="45" y="49" textAnchor="middle" fill="var(--txt)" fontSize="14" fontWeight="600" fontFamily="'DM Mono',monospace">{total || "—"}</text>
      </svg>
      <div style={{ flex: 1 }}>
        {DONUT_LABELS.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: DONUT_COLORS[i], flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: "var(--txt2)", flex: 1 }}>{label}</div>
            <div style={{ fontSize: 11, color: "var(--txt)", fontFamily: "'DM Mono',monospace" }}>{Math.round((slices[i] * (total || 0)))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ACTIVITY = [
  { color: "rgba(34,201,132,.12)", iconColor: "var(--green)", icon: "✓", text: <><strong>Payroll period</strong> approved by client admin</>, time: "2 min ago" },
  { color: "rgba(245,166,35,.12)", iconColor: "var(--amber)", icon: "⚠", text: <><strong>APIT Table 02</strong> needs recalculation</>, time: "18 min ago" },
  { color: "rgba(79,123,255,.12)",  iconColor: "var(--accent)", icon: "↑", text: <><strong>Bank detail change</strong> requested (OTP sent)</>, time: "34 min ago" },
  { color: "rgba(168,85,247,.12)", iconColor: "var(--purple)", icon: "📋", text: <><strong>4 leave requests</strong> pending approval</>, time: "1h ago" },
  { color: "rgba(34,201,132,.12)", iconColor: "var(--green)", icon: "👤", text: <><strong>New employee</strong> onboarded</>, time: "2h ago" },
];

export default function DashboardPage() {
  const [kpis, setKpis]     = useState(null);
  const [trend, setTrend]   = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    async function load() {
      try {
        const [kpiRes, trendRes, periodsRes] = await Promise.all([
          reportsApi.dashboardKpis(),
          reportsApi.payrollCostTrend(currentYear),
          payrollApi.listPeriods({ year: currentYear }),
        ]);
        setKpis(kpiRes.data);
        setTrend(trendRes.data || []);
        setPeriods((periodsRes.data || []).slice(0, 5));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentYear]);

  const fmt = n => new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(n || 0);
  const fmtM = n => `${((n || 0) / 1_000_000).toFixed(1)}M`;

  const totalGross = trend.reduce((s, d) => s + (d.total_gross || 0), 0);
  const totalEpf   = trend.reduce((s, d) => s + (d.total_gross || 0) * 0.12, 0);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
      <div style={{ width: 32, height: 32, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <KpiCard label="Total Headcount" value={fmt(kpis?.active_employees)} change="vs last month" changeUp icon={Users} iconBg="rgba(79,123,255,.12)" iconColor="var(--accent)" />
        <KpiCard label="Payroll This Month" value={`LKR ${fmtM(kpis?.total_net_pay)}`} change={`LKR ${fmt(kpis?.total_net_pay)}`} changeUp icon={DollarSign} iconBg="rgba(34,201,132,.12)" iconColor="var(--green)" />
        <KpiCard label="Pending Approvals" value={kpis?.pending_payroll_approvals || 0} change="items require action" changeUp={false} icon={AlertTriangle} iconBg="rgba(245,166,35,.12)" iconColor="var(--amber)" />
        <KpiCard label="Current Period" value={kpis?.latest_period?.status?.replace(/_/g," ") || "—"} change={kpis?.latest_period?.name || ""} changeUp icon={CheckCircle} iconBg="rgba(168,85,247,.12)" iconColor="var(--purple)" />
      </div>

      {/* Companies table + Activity feed */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--txt)" }}>Recent Payroll Periods</div>
              <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 1 }}>{currentYear} · All periods</div>
            </div>
            <span style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer" }}>View all →</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Period","Status","Pay Date","Working Days"].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 500, color: "var(--txt3)", textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", letterSpacing: ".3px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "24px 12px", textAlign: "center", fontSize: 12, color: "var(--txt3)" }}>No payroll periods yet</td></tr>
              ) : periods.map(p => (
                <tr key={p.id} style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                  onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}
                >
                  <td style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--txt)", fontWeight: 500, borderBottom: "1px solid var(--border)" }}>{p.period_name || p.name}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--txt2)", borderBottom: "1px solid var(--border)" }}>{p.pay_date || "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--txt2)", borderBottom: "1px solid var(--border)", fontFamily: "'DM Mono',monospace" }}>{p.working_days || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--txt)", marginBottom: 14 }}>
            <span className="live-dot" />Live Activity
          </div>
          {ACTIVITY.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < ACTIVITY.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, background: a.color, color: a.iconColor }}>{a.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.5 }}>{a.text}</div>
                <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 2 }}>{a.time}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--txt)" }}>Monthly Payroll Spend</div>
            <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 1 }}>LKR · {currentYear}</div>
          </div>
          <MiniBarChart data={trend} currentMonth={currentMonth} />
          <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />
          <div style={{ display: "flex", gap: 20 }}>
            <div><div style={{ fontSize: 11, color: "var(--txt3)" }}>Gross YTD</div><div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'DM Mono',monospace" }}>LKR {fmtM(totalGross)}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--txt3)" }}>EPF Est.</div><div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'DM Mono',monospace" }}>LKR {fmtM(totalEpf)}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--txt3)" }}>Net Pay</div><div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'DM Mono',monospace" }}>LKR {fmtM(kpis?.total_net_pay)}</div></div>
          </div>
        </Card>

        <Card>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--txt)" }}>Headcount by Category</div>
            <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 1 }}>Active employees</div>
          </div>
          <DonutChart total={kpis?.active_employees} />
        </Card>
      </div>

    </div>
  );
}

// inline icon components to avoid extra imports
function Users({ style }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={style}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function DollarSign({ style }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={style}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function AlertTriangle({ style }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={style}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function CheckCircle({ style }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={style}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>; }
