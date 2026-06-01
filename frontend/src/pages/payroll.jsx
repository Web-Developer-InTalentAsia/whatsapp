"use client";
import { useState, useEffect } from "react";
import { Plus, Calculator, ArrowRight, Download, FileSpreadsheet } from "lucide-react";
import { payrollApi, reportsApi, authApi, employeeApi } from "../utils/api";
import { exportXlsx, monthTag } from "../utils/exportXlsx";
import toast from "react-hot-toast";

const STATUS_ORDER = ["draft","calculated","hr_review","client_approval","bank_file","payslip_release","completed"];

const STEP_LABELS = [
  ["Attendance","Finalized"],
  ["Leave","Processed"],
  ["Payroll","Calculated"],
  ["HR","Review"],
  ["Client","Approval"],
  ["Bank","File"],
  ["Payslip","Release"],
];
const ACTIVE_STEP_IDX = { draft:2, calculated:3, hr_review:4, client_approval:5, bank_file:6, payslip_release:7, completed:7 };

function PaySteps({ status }) {
  const activeIdx = ACTIVE_STEP_IDX[status] ?? 2;
  const items = [];
  STEP_LABELS.forEach((label, i) => {
    const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
    items.push(
      <div key={`s${i}`} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1 }}>
        <div style={{
          width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, border:"2px solid",
          ...(state==="done"  ? { background:"#1a9f6a", borderColor:"var(--green)", color:"#fff" }
            : state==="active"? { background:"var(--accent)", borderColor:"var(--accent2)", color:"#fff" }
            :                   { background:"var(--bg3)", borderColor:"var(--border)", color:"var(--txt3)" }),
        }}>
          {state==="done" ? "✓" : i+1}
        </div>
        <div style={{ fontSize:10, color:state==="active"?"var(--txt)":"var(--txt3)", textAlign:"center", lineHeight:1.3 }}>
          {label[0]}<br/>{label[1]}
        </div>
      </div>
    );
    if (i < STEP_LABELS.length - 1) {
      items.push(
        <div key={`l${i}`} style={{
          flex:1, height:1.5, alignSelf:"flex-start", marginTop:13, marginLeft:-2, marginRight:-2,
          background: state==="done"   ? "var(--green)"
                    : state==="active" ? "linear-gradient(90deg,var(--green),var(--border))"
                    :                    "var(--border)",
        }} />
      );
    }
  });
  return <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:16 }}>{items}</div>;
}
const STATUS_LABELS = { draft:"Draft", calculated:"Calculated", hr_review:"HR Review", client_approval:"Client Approval", bank_file:"Bank File", payslip_release:"Payslip Release", completed:"Completed", rejected:"Rejected" };
const NEXT_STATUS = { draft:"calculated", calculated:"hr_review", hr_review:"client_approval", client_approval:"bank_file", bank_file:"payslip_release", payslip_release:"completed" };
const SENSITIVE = new Set(["bank_file","payslip_release","completed"]);

const STATUS_STYLE = {
  draft:            { background: "rgba(90,98,128,0.15)", color: "var(--txt2)" },
  calculated:       { background: "rgba(79,123,255,0.15)", color: "var(--accent2)" },
  hr_review:        { background: "rgba(245,166,35,0.15)", color: "var(--amber)" },
  client_approval:  { background: "rgba(168,85,247,0.15)", color: "var(--purple)" },
  bank_file:        { background: "rgba(20,184,166,0.15)", color: "var(--teal)" },
  payslip_release:  { background: "rgba(79,123,255,0.15)", color: "var(--accent)" },
  completed:        { background: "rgba(34,201,132,0.15)", color: "var(--green)" },
  rejected:         { background: "rgba(232,66,90,0.15)", color: "var(--red)" },
};

const S = {
  card:   { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 },
  label:  { fontSize: 11, color: "var(--txt3)", marginBottom: 4, display: "block" },
  input:  { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "6px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none" },
  btnPrimary: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnSecondary: { background: "var(--bg3)", color: "var(--txt2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
};

function StatusBadge({ status }) {
  const st = STATUS_STYLE[status] || { background: "var(--bg3)", color: "var(--txt2)" };
  return <span style={{ ...st, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{STATUS_LABELS[status] || status}</span>;
}

function OtpModal({ onConfirm, onCancel, loading }) {
  const [otp, setOtp] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ ...S.card, padding: 24, width: 360 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--txt)", marginBottom: 6 }}>OTP Verification</p>
        <p style={{ fontSize: 12, color: "var(--txt2)", marginBottom: 16 }}>Enter the 6-digit code sent to your email.</p>
        <input type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g,""))}
          placeholder="000000" style={{ ...S.input, textAlign: "center", fontSize: 22, letterSpacing: 8, padding: "10px 0" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => onConfirm(otp)} disabled={otp.length !== 6 || loading} style={{ ...S.btnPrimary, flex: 1, justifyContent: "center", opacity: (otp.length !== 6 || loading) ? 0.5 : 1 }}>
            {loading ? "Verifying…" : "Confirm"}
          </button>
          <button onClick={onCancel} style={{ ...S.btnSecondary, flex: 1, justifyContent: "center" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function PeriodSummaryCard({ summary }) {
  if (!summary) return null;
  const fmt = (n) => `LKR ${(n||0).toLocaleString("en-LK",{minimumFractionDigits:2})}`;
  const items = [
    ["Employees", summary.employee_count],
    ["Total Gross", fmt(summary.total_gross)],
    ["Total Net Pay", fmt(summary.total_net)],
    ["EPF Employee 8%", fmt(summary.total_epf_employee)],
    ["EPF Employer 12%", fmt(summary.total_epf_employer)],
    ["ETF 3%", fmt(summary.total_etf)],
    ["APIT", fmt(summary.total_apit)],
    ["Overtime", fmt(summary.total_ot)],
    ["No-Pay", fmt(summary.total_no_pay)],
    ["Employer Cost", fmt(summary.total_employer_cost)],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 12px" }}>
          <p style={{ fontSize: 10, color: "var(--txt3)" }}>{label}</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)", marginTop: 2 }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function PayrollPage() {
  const currentYear = new Date().getFullYear();
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [summary, setSummary] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [empMap, setEmpMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ year: currentYear, month: new Date().getMonth()+1, working_days: 26 });
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingTransition, setPendingTransition] = useState(null);

  async function loadPeriods() {
    setLoading(true);
    try {
      const res = await payrollApi.listPeriods({ year: currentYear });
      setPeriods(res.data || []);
    } catch { toast.error("Failed to load payroll periods"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadPeriods();
    employeeApi.list({ page_size: 200 }).then(r => {
      const m = {};
      (r.data?.items || []).forEach(e => { m[e.id] = e; });
      setEmpMap(m);
    }).catch(() => {});
  }, []);

  async function selectPeriod(period) {
    setSelectedPeriod(period);
    if (period.status !== "draft") {
      try {
        const [sumRes, slipRes] = await Promise.all([payrollApi.getPeriodSummary(period.id), payrollApi.listPayslips(period.id)]);
        setSummary(sumRes.data?.summary);
        setPayslips(slipRes.data || []);
      } catch { setSummary(null); setPayslips([]); }
    } else { setSummary(null); setPayslips([]); }
  }

  async function handleCreatePeriod() {
    try {
      await payrollApi.createPeriod(newPeriod);
      toast.success("Period created");
      setShowCreate(false);
      loadPeriods();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to create period"); }
  }

  async function handleCalculate() {
    if (!selectedPeriod) return;
    setActionLoading(true);
    try {
      await payrollApi.calculatePeriod(selectedPeriod.id);
      toast.success("Payroll calculated");
      loadPeriods();
      selectPeriod({ ...selectedPeriod, status: "calculated" });
    } catch (e) { toast.error(e.response?.data?.detail || "Calculation failed"); }
    finally { setActionLoading(false); }
  }

  async function initiateTransition(targetStatus) {
    if (SENSITIVE.has(targetStatus)) {
      setPendingTransition(targetStatus);
      const purposeMap = { bank_file:"bank_file_release", payslip_release:"payslip_release", completed:"payslip_release" };
      try { await authApi.requestSensitiveOtp(purposeMap[targetStatus]); setShowOtpModal(true); }
      catch { toast.error("Failed to send OTP"); }
    } else { await doTransition(targetStatus, null); }
  }

  async function doTransition(targetStatus, otpCode) {
    setActionLoading(true);
    try {
      const res = await payrollApi.transitionStatus(selectedPeriod.id, targetStatus, otpCode);
      toast.success(`Moved to: ${STATUS_LABELS[targetStatus]}`);
      setShowOtpModal(false); setPendingTransition(null);
      loadPeriods(); selectPeriod(res.data);
    } catch (e) { toast.error(e.response?.data?.detail || "Transition failed"); }
    finally { setActionLoading(false); }
  }

  function exportPayrollXlsx() {
    if (!payslips.length) { toast.error("No payslips to export"); return; }
    const pd = selectedPeriod;
    const filename = `payroll_${monthTag(new Date(pd.start_date))}.xlsx`;
    const headers = ["Emp No.","Full Name","Basic","Gross","OT","Allowances","No Pay","EPF Emp 8%","EPF Emplr 12%","ETF 3%","APIT","Net Pay"];
    const rows = payslips.map(s => {
      const emp = empMap[s.employee_id] || {};
      return [
        emp.employee_number || s.employee_id, emp.full_name || "",
        s.basic_salary, s.gross_salary, s.ot_amount||0,
        s.total_allowances||0, s.no_pay_deduction||0,
        s.epf_employee, s.epf_employer, s.etf_employer, s.apit, s.net_salary,
      ];
    });
    exportXlsx(filename, `Payroll ${pd.period_name}`, headers, rows);
    toast.success("Payroll Excel downloaded");
  }

  async function downloadCsv() {
    try {
      const res = await reportsApi.downloadPayrollCsv(selectedPeriod.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url; a.download = `payroll_${selectedPeriod.period_name}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  }

  async function downloadBankFile() {
    try {
      const res = await reportsApi.downloadBankFile(selectedPeriod.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url; a.download = `bank_file_${selectedPeriod.period_name}.txt`; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {showOtpModal && <OtpModal onConfirm={(c) => doTransition(pendingTransition, c)} onCancel={() => { setShowOtpModal(false); setPendingTransition(null); }} loading={actionLoading} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--txt)" }}>Payroll Run</p>
          <p style={{ fontSize: 12, color: "var(--txt3)" }}>Manage payroll periods and payslips</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={S.btnPrimary}><Plus style={{ width: 13, height: 13 }} /> New Period</button>
      </div>

      {/* Create period form */}
      {showCreate && (
        <div style={{ ...S.card, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)", marginBottom: 16 }}>Create Payroll Period</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>Year</label><input type="number" value={newPeriod.year} onChange={(e) => setNewPeriod({...newPeriod, year: +e.target.value})} style={S.input} /></div>
            <div>
              <label style={S.label}>Month</label>
              <select value={newPeriod.month} onChange={(e) => setNewPeriod({...newPeriod, month: +e.target.value})} style={S.input}>
                {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Working Days</label><input type="number" value={newPeriod.working_days} onChange={(e) => setNewPeriod({...newPeriod, working_days: +e.target.value})} style={S.input} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={handleCreatePeriod} style={S.btnPrimary}>Create</button>
            <button onClick={() => setShowCreate(false)} style={S.btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>
        {/* Period list */}
        <div style={S.card}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)" }}>{currentYear} Periods</p>
          </div>
          <div>
            {loading ? (
              <p style={{ padding: "24px 16px", textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>Loading…</p>
            ) : periods.length === 0 ? (
              <p style={{ padding: "24px 16px", textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>No periods yet</p>
            ) : periods.map((p) => (
              <button key={p.id} onClick={() => selectPeriod(p)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                background: selectedPeriod?.id === p.id ? "var(--bg3)" : "transparent",
                borderLeft: `2px solid ${selectedPeriod?.id === p.id ? "var(--accent)" : "transparent"}`,
                border: "none", borderBottom: "1px solid var(--border)",
              }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--txt)" }}>{p.period_name}</p>
                  <p style={{ fontSize: 10, color: "var(--txt3)" }}>{p.working_days}d</p>
                </div>
                <StatusBadge status={p.status} />
              </button>
            ))}
          </div>
        </div>

        {/* Period detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!selectedPeriod ? (
            <div style={{ ...S.card, padding: 40, textAlign: "center", color: "var(--txt3)", fontSize: 13 }}>Select a payroll period</div>
          ) : (
            <>
              <div style={{ ...S.card, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: "var(--txt)" }}>{selectedPeriod.period_name}</p>
                    <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 2 }}>{selectedPeriod.start_date} — {selectedPeriod.end_date}</p>
                  </div>
                  <StatusBadge status={selectedPeriod.status} />
                </div>
                <PaySteps status={selectedPeriod.status} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {selectedPeriod.status === "draft" && (
                    <button onClick={handleCalculate} disabled={actionLoading} style={{ ...S.btnPrimary, opacity: actionLoading ? 0.6 : 1 }}>
                      <Calculator style={{ width: 12, height: 12 }} />{actionLoading ? "Calculating…" : "Calculate"}
                    </button>
                  )}
                  {NEXT_STATUS[selectedPeriod.status] && selectedPeriod.status !== "draft" && (
                    <button onClick={() => initiateTransition(NEXT_STATUS[selectedPeriod.status])} disabled={actionLoading} style={{ ...S.btnPrimary, opacity: actionLoading ? 0.6 : 1 }}>
                      <ArrowRight style={{ width: 12, height: 12 }} />Move to {STATUS_LABELS[NEXT_STATUS[selectedPeriod.status]]}
                    </button>
                  )}
                  {selectedPeriod.status !== "draft" && (
                    <button onClick={exportPayrollXlsx} style={S.btnSecondary}><FileSpreadsheet style={{ width: 12, height: 12 }} />Export Excel</button>
                  )}
                  {["bank_file","payslip_release","completed"].includes(selectedPeriod.status) && (
                    <button onClick={downloadBankFile} style={S.btnSecondary}><Download style={{ width: 12, height: 12 }} />Bank File</button>
                  )}
                </div>
              </div>

              {summary && (
                <div style={{ ...S.card, padding: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)", marginBottom: 12 }}>Period Summary</p>
                  <PeriodSummaryCard summary={summary} />
                </div>
              )}

              {payslips.length > 0 && (
                <div style={S.card}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)" }}>Payslips ({payslips.length})</p>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          {["Employee","Basic","Gross","EPF 8%","APIT","Net Pay"].map((h,i) => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: i > 0 ? "right" : "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {payslips.map((s) => {
                          const emp = empMap[s.employee_id];
                          return (
                          <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "8px 12px" }}>
                              <div style={{ color: "var(--txt)", fontWeight: 500, fontSize: 12 }}>{emp?.full_name || "—"}</div>
                              <div style={{ color: "var(--txt3)", fontFamily: "DM Mono,monospace", fontSize: 10 }}>{emp?.employee_number || s.employee_id?.slice(0,8)}</div>
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--txt2)" }}>{s.basic_salary?.toLocaleString()}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--txt2)" }}>{s.gross_salary?.toLocaleString()}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--red)" }}>{s.epf_employee?.toLocaleString()}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--red)" }}>{s.apit?.toLocaleString()}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--green)", fontWeight: 600 }}>{s.net_salary?.toLocaleString()}</td>
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
