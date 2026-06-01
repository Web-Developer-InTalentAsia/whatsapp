"use client";
import { useState, useEffect } from "react";
import { Building2, Users, ShieldCheck, Globe, Plus, Camera, RefreshCw } from "lucide-react";
import { authApi, employeeApi, leaveApi } from "../utils/api";
import toast from "react-hot-toast";

const DEFAULT_DEPTS = [
  { code: "IT",  name: "Information Technology" },
  { code: "HR",  name: "Human Resources" },
  { code: "FIN", name: "Finance" },
  { code: "OPS", name: "Operations" },
  { code: "SAL", name: "Sales" },
];
const DEFAULT_LEAVE_TYPES = [
  { code: "AL",  name: "Annual Leave",    days_entitled: 21, is_paid: true,  is_carry_forward: true,  max_carry_days: 7,  is_medical: false, requires_document: false },
  { code: "CL",  name: "Casual Leave",    days_entitled: 7,  is_paid: true,  is_carry_forward: false, max_carry_days: 0,  is_medical: false, requires_document: false },
  { code: "ML",  name: "Medical Leave",   days_entitled: 14, is_paid: true,  is_carry_forward: false, max_carry_days: 0,  is_medical: true,  requires_document: true  },
  { code: "MAT", name: "Maternity Leave", days_entitled: 84, is_paid: true,  is_carry_forward: false, max_carry_days: 0,  is_medical: true,  requires_document: true  },
];

const S = {
  card:         { background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:10 },
  label:        { fontSize:11, color:"var(--txt3)", marginBottom:4, display:"block" },
  input:        { background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:6, color:"var(--txt)", padding:"6px 10px", fontSize:12, fontFamily:"inherit", width:"100%", outline:"none" },
  btnPrimary:   { background:"var(--accent)", color:"#fff", border:"none", borderRadius:6, padding:"6px 14px", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:5 },
  btnSecondary: { background:"var(--bg3)", color:"var(--txt2)", border:"1px solid var(--border2)", borderRadius:6, padding:"6px 14px", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:5 },
  divider:      { height:1, background:"var(--border)", margin:"14px 0" },
  row:          { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid var(--border)" },
};

function InfoRow({ label, value, sub, badge }) {
  return (
    <div style={S.row}>
      <div>
        <p style={{ fontSize:12, color:"var(--txt2)" }}>{label}</p>
        {sub && <p style={{ fontSize:10, color:"var(--txt3)", marginTop:1 }}>{sub}</p>}
      </div>
      <div style={{ textAlign:"right" }}>
        {badge ? badge : <span style={{ fontSize:13, fontFamily:"DM Mono,monospace", color:"var(--txt)" }}>{value || "—"}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <p style={{ fontSize:11, fontWeight:500, color:"var(--txt3)", textTransform:"uppercase", letterSpacing:".8px", marginBottom:10, marginTop:4 }}>{children}</p>;
}

export default function SettingsPage() {
  const [user, setUser]             = useState(null);
  const [departments, setDepartments] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [deptForm, setDeptForm]     = useState({ code:"", name:"" });
  const [creatingDept, setCreatingDept] = useState(false);
  const [seedingDepts, setSeedingDepts] = useState(false);
  const [seedingLeave, setSeedingLeave] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [logoUrl, setLogoUrl]       = useState(null);

  useEffect(() => {
    authApi.me().then(r => setUser(r.data)).catch(() => {});
    loadDepts();
    leaveApi.listTypes().then(r => setLeaveTypes(r.data || [])).catch(() => {});
  }, []);

  async function loadDepts() {
    setDeptLoading(true);
    try {
      const r = await employeeApi.listDepartments();
      setDepartments(r.data || []);
    } catch { /* silent */ }
    finally { setDeptLoading(false); }
  }

  async function seedDepts() {
    setSeedingDepts(true);
    let created = 0;
    for (const d of DEFAULT_DEPTS) {
      try { await employeeApi.createDepartment(d.code, d.name, null); created++; } catch (_) {}
    }
    toast.success(`Created ${created} default departments`);
    setSeedingDepts(false);
    loadDepts();
  }

  async function seedLeaveTypes() {
    setSeedingLeave(true);
    let created = 0;
    for (const lt of DEFAULT_LEAVE_TYPES) {
      try { await leaveApi.createType(lt); created++; } catch (_) {}
    }
    toast.success(`Created ${created} default leave types`);
    setSeedingLeave(false);
    leaveApi.listTypes().then(r => setLeaveTypes(r.data || [])).catch(() => {});
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) { toast.error("Logo must be under 500 KB"); return; }
    const url = URL.createObjectURL(file);
    setLogoUrl(url);
    toast.success("Logo preview updated (saved locally for this session)");
  }

  async function handleCreateDept(e) {
    e.preventDefault();
    if (!deptForm.code || !deptForm.name) { toast.error("Code and name required"); return; }
    setCreatingDept(true);
    try {
      await employeeApi.createDepartment(deptForm.code, deptForm.name, null);
      toast.success(`Department "${deptForm.name}" created`);
      setDeptForm({ code:"", name:"" });
      setShowDeptForm(false);
      loadDepts();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to create department"); }
    finally { setCreatingDept(false); }
  }

  const role = user?.role || "";
  const isAdmin = ["super_admin","payroll_admin","client_admin"].includes(role);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Header */}
      <div>
        <p style={{ fontSize:18, fontWeight:600, color:"var(--txt)" }}>Company Settings</p>
        <p style={{ fontSize:12, color:"var(--txt3)" }}>Configuration and organisation management</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {/* Company Profile */}
        <div style={S.card}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
            <Building2 style={{ width:15, height:15, color:"var(--accent)" }} />
            <p style={{ fontSize:13, fontWeight:600, color:"var(--txt)" }}>Company Profile</p>
          </div>
          <div style={{ padding:"0 16px" }}>
            <div style={{ padding:"16px 0 8px", display:"flex", alignItems:"center", gap:12 }}>
              {/* Logo upload area */}
              <div style={{ position:"relative", flexShrink:0 }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" style={{ width:56, height:56, borderRadius:12, objectFit:"contain", background:"var(--bg3)", border:"1px solid var(--border2)" }} />
                ) : (
                  <div style={{ width:56, height:56, borderRadius:12, background:"linear-gradient(135deg,var(--accent),var(--purple))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, color:"#fff" }}>
                    {(user?.company_name || "C")[0].toUpperCase()}
                  </div>
                )}
                {isAdmin && (
                  <label style={{ position:"absolute", bottom:-4, right:-4, width:20, height:20, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"2px solid var(--bg2)" }}>
                    <Camera style={{ width:10, height:10, color:"#fff" }} />
                    <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display:"none" }} />
                  </label>
                )}
              </div>
              <div>
                <p style={{ fontSize:15, fontWeight:600, color:"var(--txt)" }}>{user?.company_name || "Intalent Asia"}</p>
                <p style={{ fontSize:11, color:"var(--txt3)", marginTop:2 }}>Multi-tenant payroll schema</p>
                {isAdmin && <p style={{ fontSize:10, color:"var(--txt3)", marginTop:1 }}>Click camera to upload logo (max 500 KB)</p>}
              </div>
            </div>
            <div style={S.divider} />
            <InfoRow label="Schema"      sub="Database tenant schema"  value={user?.db_schema || "intalent"} />
            <InfoRow label="Country"     sub="Payroll jurisdiction"    value="Sri Lanka 🇱🇰" />
            <InfoRow label="Currency"    sub="Reporting currency"      value="LKR" />
            <InfoRow label="Tax Year"    sub="IRD financial year"      value="2025 / 2026" />
            <InfoRow label="EPF Number"  sub="Department of Labour"    value="EPF/CTL/001" />
            <InfoRow label="ETF Number"  sub="Employee Trust Fund"     value="ETF/CTL/001" />
            <div style={{ padding:"12px 0" }} />
          </div>
        </div>

        {/* Your Profile */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={S.card}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
              <ShieldCheck style={{ width:15, height:15, color:"var(--accent)" }} />
              <p style={{ fontSize:13, fontWeight:600, color:"var(--txt)" }}>Your Account</p>
            </div>
            <div style={{ padding:"0 16px" }}>
              <InfoRow label="Full Name" sub="Display name"            value={user?.full_name} />
              <InfoRow label="Email"     sub="Login email"             value={user?.email} />
              <InfoRow label="Role"      sub="System access level"
                badge={
                  <span style={{ background:"rgba(79,123,255,0.12)", color:"var(--accent2)", padding:"2px 10px", borderRadius:4, fontSize:11, fontWeight:500 }}>
                    {(user?.role || "—").replace(/_/g," ")}
                  </span>
                }
              />
              <div style={{ padding:"12px 0" }} />
            </div>
          </div>

          <div style={S.card}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
              <Globe style={{ width:15, height:15, color:"var(--accent)" }} />
              <p style={{ fontSize:13, fontWeight:600, color:"var(--txt)" }}>Payroll Configuration</p>
            </div>
            <div style={{ padding:"0 16px" }}>
              <InfoRow label="EPF Employee" sub="Deducted from gross" value="8%" />
              <InfoRow label="EPF Employer" sub="Company contribution" value="12%" />
              <InfoRow label="ETF Employer" sub="ETF Act requirement" value="3%" />
              <InfoRow label="Working Days" sub="Default per month" value="26" />
              <InfoRow label="OT Multiplier" sub="Shop & Office Act" value="1.5×" />
              <div style={{ padding:"12px 0" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Departments */}
      <div style={S.card}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Users style={{ width:15, height:15, color:"var(--accent)" }} />
            <p style={{ fontSize:13, fontWeight:600, color:"var(--txt)" }}>Departments</p>
            <span style={{ fontSize:10, color:"var(--txt3)", background:"var(--bg3)", padding:"1px 7px", borderRadius:10 }}>{departments.length}</span>
          </div>
          {isAdmin && (
            <div style={{ display:"flex", gap:8 }}>
              {departments.length === 0 && (
                <button onClick={seedDepts} disabled={seedingDepts} style={{ ...S.btnSecondary, opacity:seedingDepts?0.6:1 }}>
                  <RefreshCw style={{ width:12, height:12 }} /> {seedingDepts ? "Seeding…" : "Seed Defaults"}
                </button>
              )}
              <button onClick={() => setShowDeptForm(v => !v)} style={S.btnPrimary}>
                <Plus style={{ width:13, height:13 }} /> New Department
              </button>
            </div>
          )}
        </div>

        {showDeptForm && (
          <div style={{ padding:"16px 16px 0" }}>
            <form onSubmit={handleCreateDept} style={{ display:"flex", gap:10, alignItems:"flex-end", marginBottom:16 }}>
              <div style={{ flex:"0 0 100px" }}>
                <label style={S.label}>Code</label>
                <input type="text" value={deptForm.code} onChange={e=>setDeptForm({...deptForm, code:e.target.value.toUpperCase()})}
                  placeholder="IT" style={S.input} />
              </div>
              <div style={{ flex:1 }}>
                <label style={S.label}>Department Name</label>
                <input type="text" value={deptForm.name} onChange={e=>setDeptForm({...deptForm, name:e.target.value})}
                  placeholder="Information Technology" style={S.input} />
              </div>
              <button type="submit" disabled={creatingDept} style={{ ...S.btnPrimary, opacity:creatingDept?0.6:1 }}>
                {creatingDept ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setShowDeptForm(false)} style={S.btnSecondary}>Cancel</button>
            </form>
          </div>
        )}

        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr>
                {["Code","Department Name","Parent"].map(h => (
                  <th key={h} style={{ padding:"8px 16px", textAlign:"left", color:"var(--txt3)", fontWeight:500, fontSize:11, borderBottom:"1px solid var(--border)", textTransform:"uppercase", letterSpacing:".3px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deptLoading ? (
                <tr><td colSpan={3} style={{ padding:"24px 0", textAlign:"center", color:"var(--txt3)" }}>Loading…</td></tr>
              ) : departments.length === 0 ? (
                <tr><td colSpan={3} style={{ padding:"24px 0", textAlign:"center", color:"var(--txt3)" }}>
                  No departments yet. Use "Seed Defaults" to add IT, HR, Finance, Operations, Sales.
                </td></tr>
              ) : departments.map(d => (
                <tr key={d.id} style={{ borderBottom:"1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background="var(--bg3)")}
                  onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background="")}>
                  <td style={{ padding:"9px 16px", color:"var(--accent)", fontFamily:"DM Mono,monospace", fontSize:11, fontWeight:500 }}>{d.code}</td>
                  <td style={{ padding:"9px 16px", color:"var(--txt)", fontWeight:500 }}>{d.name}</td>
                  <td style={{ padding:"9px 16px", color:"var(--txt3)", fontSize:11 }}>{d.parent_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave Types */}
      <div style={S.card}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Globe style={{ width:15, height:15, color:"var(--accent)" }} />
            <p style={{ fontSize:13, fontWeight:600, color:"var(--txt)" }}>Leave Types</p>
            <span style={{ fontSize:10, color:"var(--txt3)", background:"var(--bg3)", padding:"1px 7px", borderRadius:10 }}>{leaveTypes.length}</span>
          </div>
          {isAdmin && leaveTypes.length === 0 && (
            <button onClick={seedLeaveTypes} disabled={seedingLeave} style={{ ...S.btnSecondary, opacity:seedingLeave?0.6:1 }}>
              <RefreshCw style={{ width:12, height:12 }} /> {seedingLeave ? "Seeding…" : "Seed Default Leave Types"}
            </button>
          )}
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr>
                {["Code","Name","Days","Paid","Carry Fwd","Max Carry","Medical","Doc Required"].map(h => (
                  <th key={h} style={{ padding:"8px 16px", textAlign:"left", color:"var(--txt3)", fontWeight:500, fontSize:11, borderBottom:"1px solid var(--border)", textTransform:"uppercase", letterSpacing:".3px", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaveTypes.length === 0 ? (
                <tr><td colSpan={8} style={{ padding:"24px 0", textAlign:"center", color:"var(--txt3)" }}>
                  No leave types. Use "Seed Default Leave Types" to add Annual, Casual, Medical, Maternity.
                </td></tr>
              ) : leaveTypes.map(lt => {
                const yes = <span style={{ color:"#4ade80", fontSize:11 }}>Yes</span>;
                const no  = <span style={{ color:"var(--txt3)", fontSize:11 }}>No</span>;
                return (
                  <tr key={lt.id} style={{ borderBottom:"1px solid var(--border)" }}
                    onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background="var(--bg3)")}
                    onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background="")}>
                    <td style={{ padding:"9px 16px", color:"var(--accent)", fontFamily:"DM Mono,monospace", fontSize:11, fontWeight:500 }}>{lt.code}</td>
                    <td style={{ padding:"9px 16px", color:"var(--txt)", fontWeight:500 }}>{lt.name}</td>
                    <td style={{ padding:"9px 16px", color:"var(--txt)" }}>{lt.days_entitled}</td>
                    <td style={{ padding:"9px 16px" }}>{lt.is_paid ? yes : no}</td>
                    <td style={{ padding:"9px 16px" }}>{lt.is_carry_forward ? yes : no}</td>
                    <td style={{ padding:"9px 16px", color:"var(--txt3)" }}>{lt.max_carry_days ?? 0}</td>
                    <td style={{ padding:"9px 16px" }}>{lt.is_medical ? yes : no}</td>
                    <td style={{ padding:"9px 16px" }}>{lt.requires_document ? yes : no}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Company — Coming Soon */}
      <div style={{ ...S.card, padding:20, border:"1px dashed var(--border2)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:"rgba(79,123,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Building2 style={{ width:18, height:18, color:"var(--accent)" }} />
          </div>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color:"var(--txt)" }}>Add Another Company</p>
            <p style={{ fontSize:11, color:"var(--txt3)", marginTop:2 }}>Multi-tenant company onboarding — available for Super Admin accounts. Contact support to provision a new tenant schema.</p>
          </div>
          <button style={{ ...S.btnSecondary, marginLeft:"auto", flexShrink:0, opacity:0.6 }} disabled>Coming Soon</button>
        </div>
      </div>
    </div>
  );
}
