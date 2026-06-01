"use client";
import { useState, useEffect } from "react";
import { Download, BarChart3, Users, DollarSign, FileSpreadsheet } from "lucide-react";
import { reportsApi, payrollApi } from "../utils/api";
import { exportXlsx, monthTag } from "../utils/exportXlsx";
import toast from "react-hot-toast";

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const S = {
  card:         { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 },
  label:        { fontSize: 11, color: "var(--txt3)", marginBottom: 4, display: "block" },
  input:        { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "6px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" },
  btnPrimary:   { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnSecondary: { background: "var(--bg3)", color: "var(--txt2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  th:           { padding: "10px 12px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" },
  thRight:      { padding: "10px 12px", textAlign: "right", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" },
};

function fmt(n) { return (n || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 }); }
function fmtM(n) { return `${((n || 0) / 1_000_000).toFixed(2)}M`; }

function BarChart({ data, year }) {
  if (!data.length) return (
    <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--txt3)", fontSize: 12 }}>No data yet</div>
  );
  const max = Math.max(...data.map((d) => d.total_gross || 0), 1);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 120, padding: "0 4px" }}>
      {data.map((d, i) => {
        const h = Math.max(6, Math.round(((d.total_gross || 0) / max) * 100));
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`LKR ${fmt(d.total_gross)}`}>
            <div style={{ fontSize: 9, color: "var(--txt3)", fontFamily: "DM Mono,monospace" }}>{fmtM(d.total_gross)}</div>
            <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: "var(--accent)", opacity: 0.85 }} />
            <div style={{ fontSize: 10, color: "var(--txt3)" }}>{MONTH_NAMES[d.month]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [trend, setTrend] = useState([]);
  const [deptCost, setDeptCost] = useState(null);
  const [headcount, setHeadcount] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deptLoading, setDeptLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadBase() {
      setLoading(true);
      try {
        const [trendRes, hcRes, periodsRes] = await Promise.all([
          reportsApi.payrollCostTrend(year),
          reportsApi.headcount(undefined),
          payrollApi.listPeriods({ year }),
        ]);
        setTrend(trendRes.data || []);
        setHeadcount(hcRes.data);
        const ps = periodsRes.data || [];
        setPeriods(ps);
        if (ps.length > 0) setSelectedPeriod(ps[0].id);
      } catch { toast.error("Failed to load reports"); }
      finally { setLoading(false); }
    }
    loadBase();
  }, [year]);

  useEffect(() => {
    if (!selectedPeriod) return;
    setDeptLoading(true);
    reportsApi.departmentCost(selectedPeriod)
      .then((r) => setDeptCost(r.data))
      .catch(() => setDeptCost(null))
      .finally(() => setDeptLoading(false));
  }, [selectedPeriod]);

  async function exportEpfEtf() {
    if (!selectedPeriod) { toast.error("Select a period first"); return; }
    setDownloading(true);
    try {
      const period = periods.find(p => p.id === selectedPeriod);
      const res = await payrollApi.listPayslips(selectedPeriod);
      const slips = res.data || [];
      const tag = period ? monthTag(new Date(period.start_date)) : "export";
      const headers = ["Employee ID","EPF No.","Basic (LKR)","EPF Employee 8%","EPF Employer 12%","ETF 3%","Total EPF","Gross (LKR)"];
      const rows = slips.map(s => [
        s.employee_id, s.epf_number || "", s.basic_salary || 0,
        s.epf_employee || 0, s.epf_employer || 0, s.etf || 0,
        ((s.epf_employee||0) + (s.epf_employer||0)), s.gross_salary || 0,
      ]);
      exportXlsx(`epf_etf_${tag}.xlsx`, "EPF ETF", headers, rows);
      toast.success("EPF/ETF Excel downloaded");
    } catch { toast.error("Export failed"); }
    finally { setDownloading(false); }
  }

  async function exportApit() {
    if (!selectedPeriod) { toast.error("Select a period first"); return; }
    setDownloading(true);
    try {
      const period = periods.find(p => p.id === selectedPeriod);
      const res = await payrollApi.listPayslips(selectedPeriod);
      const slips = res.data || [];
      const tag = period ? monthTag(new Date(period.start_date)) : "export";
      const headers = ["Employee ID","Tax File No.","Table","Gross (LKR)","EPF Deduction","Taxable Income","APIT (LKR)"];
      const rows = slips.map(s => [
        s.employee_id, s.tax_file_number || "", s.tax_table_code || "01",
        s.gross_salary || 0, s.epf_employee || 0,
        (s.gross_salary||0) - (s.epf_employee||0), s.apit || 0,
      ]);
      exportXlsx(`apit_${tag}.xlsx`, "APIT", headers, rows);
      toast.success("APIT Excel downloaded");
    } catch { toast.error("Export failed"); }
    finally { setDownloading(false); }
  }

  async function downloadFile(type) {
    if (!selectedPeriod) { toast.error("Select a period first"); return; }
    setDownloading(true);
    try {
      const res = type === "csv"
        ? await reportsApi.downloadPayrollCsv(selectedPeriod)
        : await reportsApi.downloadBankFile(selectedPeriod);
      const period = periods.find((p) => p.id === selectedPeriod);
      const name = period?.period_name || selectedPeriod;
      const ext = type === "csv" ? "csv" : "txt";
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = `${type}_${name}.${ext}`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch { toast.error("Download failed"); }
    finally { setDownloading(false); }
  }

  const totalGross = trend.reduce((s, d) => s + (d.total_gross || 0), 0);
  const totalNet   = trend.reduce((s, d) => s + (d.total_net || 0), 0);
  const totalApit  = trend.reduce((s, d) => s + (d.total_apit || 0), 0);
  const totalEpf   = trend.reduce((s, d) => s + (d.total_epf || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--txt)" }}>Reports & Statutory Filings</p>
          <p style={{ fontSize: 12, color: "var(--txt3)" }}>Payroll analytics and downloadable reports</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={year} onChange={(e) => setYear(+e.target.value)} style={S.input}>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Report cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { icon: "📄", title: "Payroll Summary Report",      sub: "Monthly · All companies · PDF / Excel",   action: () => downloadFile("csv") },
          { icon: "🏛", title: "EPF / ETF Contribution Report", sub: "IRD format · Employee-wise · Bank file", action: null },
          { icon: "📊", title: "APIT Workings Report",         sub: "Table 01–08 · Tax schedules · IRD",       action: null },
          { icon: "🕐", title: "OT & Attendance Report",       sub: "Exception report · Hikvision data",       action: null },
          { icon: "🏦", title: "Bank Transfer File",           sub: "BOC / HNB / Sampath / Commercial",        action: () => downloadFile("bank") },
          { icon: "📅", title: "Leave & No-Pay Report",        sub: "Monthly · Department-wise",               action: null },
        ].map(({ icon, title, sub, action }) => (
          <div key={title} style={{ ...S.card, padding: 16, cursor: "pointer" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--txt)" }}>{title}</p>
            <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 4 }}>{sub}</p>
            <button
              onClick={action || (() => toast("Select a period then click Download below", { icon: "ℹ️" }))}
              disabled={downloading}
              style={{ ...S.btnSecondary, width: "100%", justifyContent: "center", marginTop: 12, fontSize: 11, opacity: downloading ? 0.5 : 1 }}
            >Generate →</button>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
          <div style={{ width: 28, height: 28, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {[
              ["YTD Gross", `LKR ${fmtM(totalGross)}`, "rgba(79,123,255,0.12)", "var(--accent)"],
              ["YTD Net Pay", `LKR ${fmtM(totalNet)}`, "rgba(34,201,132,0.12)", "var(--green)"],
              ["YTD EPF Total", `LKR ${fmtM(totalEpf)}`, "rgba(245,166,35,0.12)", "var(--amber)"],
              ["YTD APIT", `LKR ${fmtM(totalApit)}`, "rgba(232,66,90,0.12)", "var(--red)"],
            ].map(([label, value, bg, color]) => (
              <div key={label} style={{ ...S.card, padding: 16 }}>
                <p style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: 18, fontWeight: 600, color, fontFamily: "DM Mono,monospace", letterSpacing: "-.5px" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            {/* Monthly spend chart */}
            <div style={{ ...S.card, padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--txt)" }}>Monthly Payroll Spend</p>
                <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 2 }}>Gross salary · {year}</p>
              </div>
              <BarChart data={trend} year={year} />
              <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  ["Gross YTD",  fmtM(totalGross), "var(--txt)"],
                  ["Net YTD",    fmtM(totalNet),   "var(--green)"],
                  ["EPF Total",  fmtM(totalEpf),   "var(--amber)"],
                  ["APIT",       fmtM(totalApit),  "var(--red)"],
                ].map(([k, v, c]) => (
                  <div key={k}>
                    <p style={{ fontSize: 11, color: "var(--txt3)" }}>{k}</p>
                    <p style={{ fontSize: 12, fontWeight: 500, fontFamily: "DM Mono,monospace", color: c }}>LKR {v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Headcount */}
            <div style={{ ...S.card, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--txt)", marginBottom: 16 }}>Headcount</p>
              {headcount ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    ["Active",      headcount.active,      "var(--green)"],
                    ["Probation",   headcount.probation,   "var(--amber)"],
                    ["Contract",    headcount.contract,    "var(--accent2)"],
                    ["Part-Time",   headcount.part_time,   "var(--purple)"],
                    ["Intern",      headcount.intern,      "var(--teal)"],
                  ].filter(([, v]) => v > 0).map(([label, val, color]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--txt2)" }}>{label}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color, fontFamily: "DM Mono,monospace" }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--txt3)" }}>Total</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--txt)", fontFamily: "DM Mono,monospace" }}>{headcount.total || 0}</span>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--txt3)" }}>No headcount data</p>
              )}
            </div>
          </div>

          {/* Period-level reports */}
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, alignItems: "start" }}>
            {/* Period selector */}
            <div style={S.card}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--txt3)", textTransform: "uppercase", letterSpacing: ".5px" }}>Period</p>
              </div>
              {periods.length === 0 ? (
                <p style={{ padding: "20px 16px", fontSize: 12, color: "var(--txt3)", textAlign: "center" }}>No periods</p>
              ) : periods.map((p) => (
                <button key={p.id} onClick={() => setSelectedPeriod(p.id)} style={{
                  width: "100%", padding: "10px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  background: selectedPeriod === p.id ? "var(--bg3)" : "transparent",
                  borderLeft: `2px solid ${selectedPeriod === p.id ? "var(--accent)" : "transparent"}`,
                  border: "none", borderBottom: "1px solid var(--border)", color: "var(--txt)", fontSize: 12, fontWeight: 500,
                }}>{p.period_name}</button>
              ))}
            </div>

            {/* Downloads + dept cost */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Download actions */}
              <div style={{ ...S.card, padding: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)", marginBottom: 12 }}>Downloads</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => downloadFile("csv")} disabled={!selectedPeriod || downloading} style={{ ...S.btnSecondary, opacity: (!selectedPeriod || downloading) ? 0.5 : 1 }}>
                    <Download style={{ width: 13, height: 13 }} /> Payroll CSV
                  </button>
                  <button onClick={exportEpfEtf} disabled={!selectedPeriod || downloading} style={{ ...S.btnSecondary, opacity: (!selectedPeriod || downloading) ? 0.5 : 1 }}>
                    <FileSpreadsheet style={{ width: 13, height: 13 }} /> EPF/ETF Excel
                  </button>
                  <button onClick={exportApit} disabled={!selectedPeriod || downloading} style={{ ...S.btnSecondary, opacity: (!selectedPeriod || downloading) ? 0.5 : 1 }}>
                    <FileSpreadsheet style={{ width: 13, height: 13 }} /> APIT Excel
                  </button>
                  <button onClick={() => downloadFile("bank")} disabled={!selectedPeriod || downloading} style={{ ...S.btnSecondary, opacity: (!selectedPeriod || downloading) ? 0.5 : 1 }}>
                    <Download style={{ width: 13, height: 13 }} /> Bank File
                  </button>
                </div>
              </div>

              {/* Department cost */}
              <div style={S.card}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)" }}>Department Cost</p>
                </div>
                <div style={{ overflowX: "auto" }}>
                  {deptLoading ? (
                    <p style={{ padding: "24px", textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>Loading…</p>
                  ) : !deptCost || !deptCost.departments?.length ? (
                    <p style={{ padding: "24px", textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>Select a period to view department cost</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={S.th}>Department</th>
                          <th style={{ ...S.th, textAlign: "center" }}>Headcount</th>
                          <th style={S.thRight}>Gross (LKR)</th>
                          <th style={S.thRight}>Net Pay (LKR)</th>
                          <th style={S.thRight}>EPF (LKR)</th>
                          <th style={S.thRight}>ETF (LKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deptCost.departments.map((d, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                            onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}>
                            <td style={{ padding: "9px 12px", color: "var(--txt)", fontWeight: 500 }}>{d.department_name || "Unassigned"}</td>
                            <td style={{ padding: "9px 12px", textAlign: "center", color: "var(--txt2)" }}>{d.headcount}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--txt2)", fontFamily: "DM Mono,monospace" }}>{fmt(d.total_gross)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--green)", fontFamily: "DM Mono,monospace" }}>{fmt(d.total_net)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--amber)", fontFamily: "DM Mono,monospace" }}>{fmt(d.total_epf)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--amber)", fontFamily: "DM Mono,monospace" }}>{fmt(d.total_etf)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
