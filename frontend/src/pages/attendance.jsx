"use client";
import { useState, useEffect } from "react";
import { Clock, Check, RefreshCw, Wifi, WifiOff, Plus, Download } from "lucide-react";
import { attendanceApi } from "../utils/api";
import { exportXlsx, todayTag } from "../utils/exportXlsx";
import toast from "react-hot-toast";

function pad(n) { return String(n).padStart(2, "0"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function monthRange() {
  const d = new Date();
  const first = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  return { start: first, end: todayStr() };
}

const S = {
  card:         { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 },
  label:        { fontSize: 11, color: "var(--txt3)", marginBottom: 4, display: "block" },
  input:        { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "6px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none" },
  btnPrimary:   { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnSecondary: { background: "var(--bg3)", color: "var(--txt2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnGreen:     { background: "rgba(34,201,132,0.15)", color: "var(--green)", border: "1px solid rgba(34,201,132,0.3)", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  th:           { padding: "10px 12px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" },
};

function Badge({ children, color }) {
  const map = {
    green:  { background: "rgba(34,201,132,0.12)", color: "var(--green)" },
    teal:   { background: "rgba(20,184,166,0.12)",  color: "var(--teal)" },
    gray:   { background: "var(--bg3)", color: "var(--txt2)" },
  };
  const st = map[color] || map.gray;
  return <span style={{ ...st, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{children}</span>;
}

export default function AttendancePage() {
  const range = monthRange();
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState("records");
  const [showManual, setShowManual] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [manualForm, setManualForm] = useState({ employee_id: "", work_date: todayStr(), check_in: "", check_out: "", notes: "" });
  const [deviceForm, setDeviceForm] = useState({ device_serial: "", device_name: "", ip_address: "", port: 80, username: "admin", password: "" });
  const [filters, setFilters] = useState({ start_date: range.start, end_date: range.end });
  const [selected, setSelected] = useState([]);

  async function loadRecords() {
    setLoading(true);
    try {
      const res = await attendanceApi.list({ ...filters, page: 1, page_size: 100 });
      setRecords(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch { toast.error("Failed to load attendance"); }
    finally { setLoading(false); }
  }

  async function loadDevices() {
    try {
      const res = await attendanceApi.listDevices();
      setDevices(res.data || []);
    } catch {}
  }

  useEffect(() => { loadRecords(); loadDevices(); }, []);
  useEffect(() => { loadRecords(); }, [filters]);

  function handleExport() {
    if (!records.length) { toast.error("No records to export"); return; }
    const headers = ["Date","Employee ID","Check In","Check Out","OT Minutes","Source","Status"];
    const rows = records.map(r => [
      r.work_date,
      r.employee_id,
      r.check_in ? new Date(r.check_in).toLocaleTimeString("en-LK",{hour:"2-digit",minute:"2-digit"}) : "",
      r.check_out ? new Date(r.check_out).toLocaleTimeString("en-LK",{hour:"2-digit",minute:"2-digit"}) : "",
      r.ot_minutes || 0,
      r.check_in_source || "manual",
      r.is_approved ? "Approved" : "Pending",
    ]);
    exportXlsx(`attendance_${todayTag()}.xlsx`, "Attendance", headers, rows);
    toast.success("Excel downloaded");
  }

  async function handleApprove() {
    if (!selected.length) return;
    try {
      await attendanceApi.approve(selected);
      toast.success(`Approved ${selected.length} records`);
      setSelected([]);
      loadRecords();
    } catch { toast.error("Approval failed"); }
  }

  async function handleSync() {
    setSyncing(true);
    const now = new Date();
    try {
      await attendanceApi.sync({ start_time: new Date(now - 3600000).toISOString(), end_time: now.toISOString() });
      toast.success("Sync triggered");
      loadRecords();
    } catch { toast.error("Sync failed"); }
    finally { setSyncing(false); }
  }

  async function submitManual(e) {
    e.preventDefault();
    try {
      const payload = { ...manualForm };
      if (payload.check_in) payload.check_in = new Date(manualForm.work_date + "T" + manualForm.check_in).toISOString();
      if (payload.check_out) payload.check_out = new Date(manualForm.work_date + "T" + manualForm.check_out).toISOString();
      await attendanceApi.createManual(payload);
      toast.success("Attendance entry saved");
      setShowManual(false);
      loadRecords();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to save"); }
  }

  async function submitAddDevice(e) {
    e.preventDefault();
    try {
      await attendanceApi.addDevice(deviceForm);
      toast.success("Device added");
      setShowAddDevice(false);
      loadDevices();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to add device"); }
  }

  async function testDevice(id) {
    try {
      const res = await attendanceApi.testDevice(id);
      toast[res.data.connected ? "success" : "error"](res.data.connected ? "Connected!" : "Connection failed");
    } catch { toast.error("Test failed"); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--txt)" }}>Attendance</p>
          <p style={{ fontSize: 12, color: "var(--txt3)" }}>{total} records</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSync} disabled={syncing} style={{ ...S.btnSecondary, opacity: syncing ? 0.6 : 1 }}>
            <RefreshCw style={{ width: 13, height: 13, animation: syncing ? "spin 1s linear infinite" : "none" }} /> Sync Hikvision
          </button>
          <button onClick={handleExport} style={S.btnSecondary}>
            <Download style={{ width: 13, height: 13 }} /> Export Excel
          </button>
          <button onClick={() => setShowManual(true)} style={S.btnPrimary}>
            <Plus style={{ width: 13, height: 13 }} /> Manual Entry
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: 4, width: "fit-content" }}>
        {["records", "devices"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "5px 16px", fontSize: 12, fontWeight: 500, borderRadius: 5, border: "none",
            cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
            background: tab === t ? "var(--accent)" : "transparent",
            color: tab === t ? "#fff" : "var(--txt2)",
          }}>{t}</button>
        ))}
      </div>

      {/* Manual entry form */}
      {showManual && (
        <div style={{ ...S.card, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)", marginBottom: 16 }}>Manual Attendance Entry</p>
          <form onSubmit={submitManual} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              ["Employee ID", "employee_id", "text"],
              ["Work Date", "work_date", "date"],
              ["Check In (HH:MM)", "check_in", "time"],
              ["Check Out (HH:MM)", "check_out", "time"],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label style={S.label}>{label}</label>
                <input type={type} value={manualForm[key]} onChange={(e) => setManualForm({ ...manualForm, [key]: e.target.value })} style={S.input} />
              </div>
            ))}
            <div style={{ gridColumn: "span 2" }}>
              <label style={S.label}>Notes</label>
              <input type="text" value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} style={S.input} />
            </div>
            <div style={{ gridColumn: "span 2", display: "flex", gap: 8 }}>
              <button type="submit" style={S.btnPrimary}>Save</button>
              <button type="button" onClick={() => setShowManual(false)} style={S.btnSecondary}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {tab === "records" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            {[["From", "start_date"], ["To", "end_date"]].map(([label, key]) => (
              <div key={key}>
                <label style={S.label}>{label}</label>
                <input type="date" value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} style={{ ...S.input, width: "auto" }} />
              </div>
            ))}
            {selected.length > 0 && (
              <button onClick={handleApprove} style={S.btnGreen}>
                <Check style={{ width: 13, height: 13 }} /> Approve Selected ({selected.length})
              </button>
            )}
          </div>

          <div style={S.card}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 36 }}>
                      <input type="checkbox" onChange={(e) => setSelected(e.target.checked ? records.map((r) => r.id) : [])} style={{ accentColor: "var(--accent)" }} />
                    </th>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Employee</th>
                    <th style={S.th}>Check In</th>
                    <th style={S.th}>Check Out</th>
                    <th style={S.th}>Source</th>
                    <th style={{ ...S.th, textAlign: "right" }}>OT Min</th>
                    <th style={S.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ padding: "32px 0", textAlign: "center", color: "var(--txt3)" }}>Loading…</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: "32px 0", textAlign: "center", color: "var(--txt3)" }}>No records</td></tr>
                  ) : records.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                      onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}>
                      <td style={{ padding: "9px 12px" }}>
                        <input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((id) => id !== r.id))} style={{ accentColor: "var(--accent)" }} />
                      </td>
                      <td style={{ padding: "9px 12px", color: "var(--txt)", fontWeight: 500 }}>{r.work_date}</td>
                      <td style={{ padding: "9px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{r.employee_id?.slice(0, 8)}…</td>
                      <td style={{ padding: "9px 12px", color: "var(--txt2)" }}>{r.check_in ? new Date(r.check_in).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td style={{ padding: "9px 12px", color: "var(--txt2)" }}>{r.check_out ? new Date(r.check_out).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <Badge color={r.check_in_source === "hikvision" ? "teal" : "gray"}>{r.check_in_source || "manual"}</Badge>
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--amber)", fontFamily: "DM Mono,monospace" }}>{r.ot_minutes || 0}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <Badge color={r.is_approved ? "green" : "gray"}>{r.is_approved ? "Approved" : "Pending"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "devices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <button onClick={() => setShowAddDevice(true)} style={S.btnPrimary}>
              <Plus style={{ width: 13, height: 13 }} /> Add Device
            </button>
          </div>

          {showAddDevice && (
            <div style={{ ...S.card, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)", marginBottom: 16 }}>Add Hikvision Device</p>
              <form onSubmit={submitAddDevice} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["Serial Number", "device_serial"], ["Device Name", "device_name"], ["IP Address", "ip_address"], ["Port", "port", "number"], ["Username", "username"], ["Password", "password", "password"]].map(([label, key, type = "text"]) => (
                  <div key={key}>
                    <label style={S.label}>{label}</label>
                    <input type={type} value={deviceForm[key]} onChange={(e) => setDeviceForm({ ...deviceForm, [key]: type === "number" ? +e.target.value : e.target.value })} style={S.input} />
                  </div>
                ))}
                <div style={{ gridColumn: "span 2", display: "flex", gap: 8 }}>
                  <button type="submit" style={S.btnPrimary}>Add</button>
                  <button type="button" onClick={() => setShowAddDevice(false)} style={S.btnSecondary}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
            {devices.length === 0 ? (
              <div style={{ ...S.card, padding: 32, textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>No devices configured</div>
            ) : devices.map((d) => (
              <div key={d.id} style={{ ...S.card, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--txt)" }}>{d.device_name}</p>
                    <p style={{ fontSize: 11, color: "var(--txt3)", fontFamily: "DM Mono,monospace" }}>{d.ip_address}:{d.port}</p>
                  </div>
                  {d.is_active
                    ? <Wifi style={{ width: 18, height: 18, color: "var(--green)" }} />
                    : <WifiOff style={{ width: 18, height: 18, color: "var(--red)" }} />}
                </div>
                <p style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 4 }}>Serial: {d.device_serial} · {d.location || "No location"}</p>
                <p style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 12 }}>Last sync: {d.last_sync_at ? new Date(d.last_sync_at).toLocaleString() : "Never"}</p>
                <button onClick={() => testDevice(d.id)} style={S.btnSecondary}>Test Connection</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
