"use client";
/**
 * Employee Self-Service (ESS) Portal
 * - View own payslips (released only)
 * - View leave balances
 * - Apply for leave
 * - View attendance summary
 */
import { useState, useEffect } from "react";
import { Download, FileText, Calendar, Clock, TrendingUp } from "lucide-react";
import { payrollApi, leaveApi, attendanceApi } from "../../utils/api";
import toast from "react-hot-toast";
import Cookies from "js-cookie";

function PayslipCard({ slip }) {
  const fmt = (n) => `LKR ${(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg">{fmt(slip.net_salary)}</h3>
          <p className="text-gray-400 text-xs">Net Pay</p>
        </div>
        <FileText className="w-5 h-5 text-indigo-400" />
      </div>
      <div className="space-y-2 text-sm border-t border-gray-700 pt-3">
        {[
          ["Basic Salary", fmt(slip.basic_salary), ""],
          ["Gross Salary", fmt(slip.gross_salary), ""],
          ["OT Amount", fmt(slip.ot_amount), "text-yellow-400"],
          ["No-Pay Deduction", `- ${fmt(slip.no_pay_deduction)}`, "text-red-400"],
          ["EPF (8%)", `- ${fmt(slip.epf_employee)}`, "text-red-400"],
          ["APIT", `- ${fmt(slip.apit)}`, "text-red-400"],
        ].map(([label, val, cls]) => (
          <div key={label} className="flex justify-between">
            <span className="text-gray-400">{label}</span>
            <span className={`font-medium ${cls || "text-white"}`}>{val}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-3 gap-2 text-center text-xs">
        <div><p className="text-gray-500">Present</p><p className="text-white font-semibold">{slip.present_days}d</p></div>
        <div><p className="text-gray-500">No Pay</p><p className="text-red-400 font-semibold">{slip.no_pay_days}d</p></div>
        <div><p className="text-gray-500">OT Hrs</p><p className="text-yellow-400 font-semibold">{slip.ot_hours}h</p></div>
      </div>
    </div>
  );
}

export default function ESSPage() {
  const [tab, setTab] = useState("payslips");
  const [payslips, setPayslips] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });

  const user = (() => {
    try { return JSON.parse(Cookies.get("user") || "{}"); } catch { return {}; }
  })();

  async function load() {
    setLoading(true);
    try {
      const [periodsRes, typesRes, balRes, reqRes] = await Promise.all([
        payrollApi.listPeriods({}),
        leaveApi.listTypes(),
        leaveApi.getBalances({}),
        leaveApi.listRequests({}),
      ]);
      const allPeriods = (periodsRes.data || []).filter((p) => p.status === "completed" || p.status === "payslip_release");
      setPeriods(allPeriods);
      setLeaveTypes(typesRes.data || []);
      setBalances(balRes.data || []);
      setLeaveRequests(reqRes.data?.items || []);
      if (allPeriods.length > 0) {
        await loadPayslips(allPeriods[0]);
      }
    } catch (e) {
      toast.error("Failed to load data");
    } finally { setLoading(false); }
  }

  async function loadPayslips(period) {
    setSelectedPeriod(period);
    try {
      const res = await payrollApi.listPayslips(period.id);
      setPayslips(res.data || []);
    } catch (e) { setPayslips([]); }
  }

  useEffect(() => { load(); }, []);

  async function submitLeave(e) {
    e.preventDefault();
    try {
      await leaveApi.submitRequest(leaveForm);
      toast.success("Leave request submitted — awaiting supervisor approval");
      setShowLeaveForm(false);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to submit"); }
  }

  async function cancelLeave(id) {
    try {
      await leaveApi.cancel(id);
      toast.success("Leave cancelled");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to cancel"); }
  }

  const TABS = [
    { key: "payslips", label: "My Payslips", icon: FileText },
    { key: "leave", label: "Leave", icon: Calendar },
    { key: "attendance", label: "Attendance", icon: Clock },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">My Portal</h1>
        <p className="text-gray-400 text-sm">Welcome, {user.full_name || "Employee"}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-xl w-fit border border-gray-700">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.key ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {tab === "payslips" && (
        <div className="space-y-4">
          {/* Period selector */}
          {periods.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {periods.map((p) => (
                <button key={p.id} onClick={() => loadPayslips(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedPeriod?.id === p.id ? "bg-indigo-600 text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}>
                  {p.period_name}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading...</div>
          ) : payslips.length === 0 ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-10 text-center text-gray-500">
              No released payslips yet
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {payslips.map((s) => <PayslipCard key={s.id} slip={s} />)}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {tab === "leave" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Leave Balances & Requests</h2>
            <button onClick={() => setShowLeaveForm(true)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg">
              Apply Leave
            </button>
          </div>

          {showLeaveForm && (
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h3 className="text-sm font-semibold text-white mb-4">Apply for Leave</h3>
              <form onSubmit={submitLeave} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Leave Type</label>
                  <select value={leaveForm.leave_type_id} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type_id: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="">Select type</option>
                    {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                  </select>
                </div>
                <div />
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                  <input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">End Date</label>
                  <input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Reason</label>
                  <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} rows={2}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white resize-none" />
                </div>
                <div className="col-span-2 flex gap-3">
                  <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg">Submit</button>
                  <button type="button" onClick={() => setShowLeaveForm(false)} className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Balances */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {balances.map((b) => (
              <div key={b.leave_type_id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{b.leave_type_name}</p>
                <p className="text-2xl font-bold text-white">{b.remaining}</p>
                <p className="text-xs text-gray-500">days available</p>
                <div className="mt-2 text-xs text-gray-500">{b.used_days} used / {b.entitled_days} entitled</div>
              </div>
            ))}
          </div>

          {/* Requests */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 text-sm font-semibold text-white">My Leave Requests</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-2 text-left text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-gray-400">Period</th>
                  <th className="px-4 py-2 text-center text-gray-400">Days</th>
                  <th className="px-4 py-2 text-left text-gray-400">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {leaveRequests.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500 text-sm">No leave requests</td></tr>
                ) : leaveRequests.map((r) => (
                  <tr key={r.id} className="border-b border-gray-700/40">
                    <td className="px-4 py-2.5 text-gray-300">{leaveTypes.find((lt) => lt.id === r.leave_type_id)?.name || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{r.start_date} — {r.end_date}</td>
                    <td className="px-4 py-2.5 text-center text-white">{r.total_days}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "approved" ? "bg-green-900 text-green-300" : r.status === "rejected" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}`}>
                        {r.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {["pending", "supervisor_approved"].includes(r.status) && (
                        <button onClick={() => cancelLeave(r.id)} className="text-xs text-red-400 hover:text-red-300">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {tab === "attendance" && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-500 text-sm">
          Attendance summary for current month will appear here.
          <br />
          <span className="text-xs text-gray-600">Feature requires your employee profile to be linked to your user account.</span>
        </div>
      )}
    </div>
  );
}
