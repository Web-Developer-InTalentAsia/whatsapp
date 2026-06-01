"use client";
import { useState, useEffect } from "react";
import { Check, X, ArrowRight } from "lucide-react";
import { leaveApi, payrollApi, authApi } from "../utils/api";
import toast from "react-hot-toast";

const S = {
  card:         { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 },
  label:        { fontSize: 11, color: "var(--txt3)", marginBottom: 4, display: "block" },
  input:        { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "6px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none", resize: "none" },
  btnPrimary:   { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnSecondary: { background: "var(--bg3)", color: "var(--txt2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnGreen:     { background: "rgba(34,201,132,0.15)", color: "var(--green)", border: "1px solid rgba(34,201,132,0.3)", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnRed:       { background: "rgba(232,66,90,0.15)", color: "var(--red)", border: "1px solid rgba(232,66,90,0.3)", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  th:           { padding: "10px 12px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" },
};

const LEAVE_STATUS_STYLE = {
  pending:             { background: "rgba(245,166,35,0.12)", color: "var(--amber)" },
  supervisor_approved: { background: "rgba(79,123,255,0.12)", color: "var(--accent2)" },
  hr_approved:         { background: "rgba(168,85,247,0.12)", color: "var(--purple)" },
  client_approved:     { background: "rgba(20,184,166,0.12)", color: "var(--teal)" },
};

const PAYROLL_STATUS_STYLE = {
  hr_review:       { background: "rgba(245,166,35,0.12)", color: "var(--amber)" },
  client_approval: { background: "rgba(168,85,247,0.12)", color: "var(--purple)" },
};

const NEXT_PAYROLL = { hr_review: "client_approval", client_approval: "bank_file" };
const NEXT_PAYROLL_LABEL = { hr_review: "Client Approval", client_approval: "Bank File" };
const SENSITIVE_STATUSES = new Set(["bank_file"]);

function Badge({ label, style }) {
  return <span style={{ ...style, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{label}</span>;
}

function OtpModal({ onConfirm, onCancel, loading }) {
  const [otp, setOtp] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ ...S.card, padding: 24, width: 360 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--txt)", marginBottom: 6 }}>OTP Verification</p>
        <p style={{ fontSize: 12, color: "var(--txt2)", marginBottom: 16 }}>Enter the 6-digit code sent to your email.</p>
        <input type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000" style={{ ...S.input, textAlign: "center", fontSize: 22, letterSpacing: 8, padding: "10px 0" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => onConfirm(otp)} disabled={otp.length !== 6 || loading}
            style={{ ...S.btnPrimary, flex: 1, justifyContent: "center", opacity: (otp.length !== 6 || loading) ? 0.5 : 1 }}>
            {loading ? "Verifying…" : "Confirm"}
          </button>
          <button onClick={onCancel} style={{ ...S.btnSecondary, flex: 1, justifyContent: "center" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const currentYear = new Date().getFullYear();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("leave");
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [pendingPeriod, setPendingPeriod] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [leaveRes, typesRes, periodsRes] = await Promise.all([
        leaveApi.listRequests({ status: "pending,supervisor_approved,hr_approved,client_approved" }),
        leaveApi.listTypes(),
        payrollApi.listPeriods({ year: currentYear }),
      ]);
      setLeaveRequests(leaveRes.data?.items || []);
      setLeaveTypes(typesRes.data || []);
      const pending = (periodsRes.data || []).filter((p) => ["hr_review", "client_approval"].includes(p.status));
      setPayrollPeriods(pending);
    } catch { toast.error("Failed to load approvals"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [currentYear]);

  async function handleLeaveAction(requestId, actionFn, action) {
    setActionLoading(true);
    try {
      await actionFn(requestId, action, actionNote || undefined);
      toast.success(`Request ${action}d`);
      setSelectedLeave(null);
      setActionNote("");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Action failed"); }
    finally { setActionLoading(false); }
  }

  async function initiatePayrollTransition(period) {
    const nextStatus = NEXT_PAYROLL[period.status];
    if (!nextStatus) return;
    if (SENSITIVE_STATUSES.has(nextStatus)) {
      setPendingPeriod({ period, nextStatus });
      try { await authApi.requestSensitiveOtp("bank_file_release"); setShowOtp(true); }
      catch { toast.error("Failed to send OTP"); }
    } else {
      doPayrollTransition(period, nextStatus, null);
    }
  }

  async function doPayrollTransition(period, nextStatus, otpCode) {
    setActionLoading(true);
    try {
      await payrollApi.transitionStatus(period.id, nextStatus, otpCode);
      toast.success(`Moved to: ${NEXT_PAYROLL_LABEL[period.status]}`);
      setShowOtp(false);
      setPendingPeriod(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Transition failed"); }
    finally { setActionLoading(false); }
  }

  const pendingLeave = leaveRequests.length;
  const pendingPayroll = payrollPeriods.length;
  const total = pendingLeave + pendingPayroll;

  const TABS = [
    { key: "leave",   label: `Leave (${pendingLeave})` },
    { key: "payroll", label: `Payroll (${pendingPayroll})` },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {showOtp && pendingPeriod && (
        <OtpModal
          onConfirm={(c) => doPayrollTransition(pendingPeriod.period, pendingPeriod.nextStatus, c)}
          onCancel={() => { setShowOtp(false); setPendingPeriod(null); }}
          loading={actionLoading}
        />
      )}

      {/* Header */}
      <div>
        <p style={{ fontSize: 18, fontWeight: 600, color: "var(--txt)" }}>Pending Approvals</p>
        <p style={{ fontSize: 12, color: "var(--txt3)" }}>{total} item{total !== 1 ? "s" : ""} require action</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          ["Leave Requests",    pendingLeave,   "rgba(245,166,35,0.12)",  "var(--amber)"],
          ["Payroll Periods",   pendingPayroll, "rgba(168,85,247,0.12)",  "var(--purple)"],
          ["Total Pending",     total,          "rgba(79,123,255,0.12)",  "var(--accent)"],
        ].map(([label, val, bg, color]) => (
          <div key={label} style={{ ...S.card, padding: 16 }}>
            <p style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 600, color, fontFamily: "DM Mono,monospace", letterSpacing: "-.5px" }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: 4, width: "fit-content" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "5px 16px", fontSize: 12, fontWeight: 500, borderRadius: 5, border: "none",
            cursor: "pointer", fontFamily: "inherit",
            background: tab === t.key ? "var(--accent)" : "transparent",
            color: tab === t.key ? "#fff" : "var(--txt2)",
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
          <div style={{ width: 28, height: 28, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      ) : tab === "leave" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
          <div style={S.card}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={S.th}>Employee</th>
                    <th style={S.th}>Type</th>
                    <th style={S.th}>Period</th>
                    <th style={{ ...S.th, textAlign: "center" }}>Days</th>
                    <th style={S.th}>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: "32px 0", textAlign: "center", color: "var(--txt3)" }}>No pending leave requests</td></tr>
                  ) : leaveRequests.map((r) => (
                    <tr key={r.id} onClick={() => { setSelectedLeave(r); setActionNote(""); }}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: selectedLeave?.id === r.id ? "var(--bg3)" : "" }}
                      onMouseEnter={e => { if (selectedLeave?.id !== r.id) e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)"); }}
                      onMouseLeave={e => { if (selectedLeave?.id !== r.id) e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = ""); }}>
                      <td style={{ padding: "10px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{r.employee_id?.slice(0, 8)}…</td>
                      <td style={{ padding: "10px 12px", color: "var(--txt2)" }}>{leaveTypes.find((lt) => lt.id === r.leave_type_id)?.name || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "var(--txt3)", fontSize: 11 }}>{r.start_date} — {r.end_date}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: "var(--txt)", fontWeight: 600 }}>{r.total_days}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <Badge label={r.status?.replace(/_/g, " ")} style={LEAVE_STATUS_STYLE[r.status] || { background: "var(--bg3)", color: "var(--txt2)" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            {selectedLeave ? (
              <div style={{ ...S.card, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>Review Request</p>
                  <Badge label={selectedLeave.status?.replace(/_/g, " ")} style={LEAVE_STATUS_STYLE[selectedLeave.status] || { background: "var(--bg3)", color: "var(--txt2)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[["Period", `${selectedLeave.start_date} — ${selectedLeave.end_date}`], ["Days", selectedLeave.total_days]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--txt3)" }}>{k}</span>
                      <span style={{ color: "var(--txt)", fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                  {selectedLeave.reason && <p style={{ fontSize: 11, color: "var(--txt2)", background: "var(--bg3)", padding: "8px 10px", borderRadius: 6 }}>{selectedLeave.reason}</p>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <textarea value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Note (optional)" rows={2}
                    style={{ ...S.input, fontSize: 11 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    {selectedLeave.status === "pending" && <>
                      <button onClick={() => handleLeaveAction(selectedLeave.id, leaveApi.supervisorAction, "approve")} disabled={actionLoading} style={S.btnGreen}><Check style={{ width: 12, height: 12 }} /> Approve</button>
                      <button onClick={() => handleLeaveAction(selectedLeave.id, leaveApi.supervisorAction, "reject")} disabled={actionLoading} style={S.btnRed}><X style={{ width: 12, height: 12 }} /> Reject</button>
                    </>}
                    {selectedLeave.status === "supervisor_approved" && <>
                      <button onClick={() => handleLeaveAction(selectedLeave.id, leaveApi.hrAction, "approve")} disabled={actionLoading} style={S.btnGreen}>HR Approve</button>
                      <button onClick={() => handleLeaveAction(selectedLeave.id, leaveApi.hrAction, "reject")} disabled={actionLoading} style={S.btnRed}>HR Reject</button>
                    </>}
                    {selectedLeave.status === "hr_approved" && <>
                      <button onClick={() => handleLeaveAction(selectedLeave.id, leaveApi.clientAction, "approve")} disabled={actionLoading} style={S.btnGreen}>Client Approve</button>
                      <button onClick={() => handleLeaveAction(selectedLeave.id, leaveApi.clientAction, "reject")} disabled={actionLoading} style={S.btnRed}>Client Reject</button>
                    </>}
                    {selectedLeave.status === "client_approved" && <>
                      <button onClick={() => handleLeaveAction(selectedLeave.id, leaveApi.finalAction, "approve")} disabled={actionLoading} style={S.btnGreen}>Final Approve</button>
                      <button onClick={() => handleLeaveAction(selectedLeave.id, leaveApi.finalAction, "reject")} disabled={actionLoading} style={S.btnRed}>Final Reject</button>
                    </>}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ ...S.card, padding: 40, textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>Select a request to review</div>
            )}
          </div>
        </div>
      ) : (
        /* Payroll approvals */
        <div style={S.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={S.th}>Period</th>
                  <th style={S.th}>Current Stage</th>
                  <th style={S.th}>Pay Date</th>
                  <th style={S.th}>Next Action</th>
                </tr>
              </thead>
              <tbody>
                {payrollPeriods.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: "32px 0", textAlign: "center", color: "var(--txt3)" }}>No payroll periods awaiting approval</td></tr>
                ) : payrollPeriods.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                    onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}>
                    <td style={{ padding: "10px 12px", color: "var(--txt)", fontWeight: 500 }}>{p.period_name}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={p.status?.replace(/_/g, " ")} style={PAYROLL_STATUS_STYLE[p.status] || { background: "var(--bg3)", color: "var(--txt2)" }} />
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--txt2)" }}>{p.pay_date || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <button onClick={() => initiatePayrollTransition(p)} disabled={actionLoading} style={{ ...S.btnPrimary, opacity: actionLoading ? 0.6 : 1 }}>
                        <ArrowRight style={{ width: 12, height: 12 }} /> Move to {NEXT_PAYROLL_LABEL[p.status]}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
