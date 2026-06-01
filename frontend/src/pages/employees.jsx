"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, ChevronLeft, ChevronRight,
  Download, Users, UserCheck, Building2, Camera, Loader2,
} from "lucide-react";
import { employeeApi } from "../utils/api";
import { exportXlsx, todayTag } from "../utils/exportXlsx";
import toast from "react-hot-toast";

const EMPLOYMENT_TYPES = ["permanent","contract","probation","part_time","intern"];
const TAX_TABLES       = ["01","02","03","04","05","06","07","08"];

const DEFAULT_DEPTS = [
  { code: "IT",  name: "Information Technology" },
  { code: "HR",  name: "Human Resources" },
  { code: "FIN", name: "Finance" },
  { code: "OPS", name: "Operations" },
  { code: "SAL", name: "Sales" },
];

const SAMPLE_EMPLOYEES = [
  { employee_number:"EMP001", full_name:"Nimal Perera",         nic_number:"199001234567", email:"nimal.perera@company.lk",    mobile:"0771234567", employment_type:"permanent", join_date:"2020-01-15", basic_salary:85000,  bank_name:"Bank of Ceylon",       bank_branch:"Colombo Fort",  bank_account_number:"0012345678", tax_table_code:"01", is_epf_applicable:true,  is_etf_applicable:true  },
  { employee_number:"EMP002", full_name:"Kamani Fernando",      nic_number:"198512678901", email:"kamani.fernando@company.lk", mobile:"0712345678", employment_type:"permanent", join_date:"2019-03-01", basic_salary:120000, bank_name:"People's Bank",         bank_branch:"Nugegoda",      bank_account_number:"0023456789", tax_table_code:"02", is_epf_applicable:true,  is_etf_applicable:true  },
  { employee_number:"EMP003", full_name:"Suresh Rajendran",     nic_number:"199205678234", email:"suresh.r@company.lk",        mobile:"0762345678", employment_type:"permanent", join_date:"2021-06-15", basic_salary:65000,  bank_name:"Hatton National Bank", bank_branch:"Jaffna",        bank_account_number:"0034567890", tax_table_code:"01", is_epf_applicable:true,  is_etf_applicable:true  },
  { employee_number:"EMP004", full_name:"Dilani Wickramasinghe",nic_number:"199304512890", email:"dilani.w@company.lk",        mobile:"0779876543", employment_type:"permanent", join_date:"2022-01-01", basic_salary:75000,  bank_name:"Commercial Bank",      bank_branch:"Kandy",         bank_account_number:"0045678901", tax_table_code:"01", is_epf_applicable:true,  is_etf_applicable:true  },
  { employee_number:"EMP005", full_name:"Pradeep Silva",        nic_number:"198812345678", email:"pradeep.silva@company.lk",   mobile:"0756789012", employment_type:"contract",  join_date:"2023-04-01", basic_salary:55000,  bank_name:"Bank of Ceylon",       bank_branch:"Gampaha",       bank_account_number:"0056789012", tax_table_code:"01", is_epf_applicable:false, is_etf_applicable:false },
  { employee_number:"EMP006", full_name:"Tharushi Mendis",      nic_number:"199601234560", email:"tharushi.m@company.lk",      mobile:"0741234567", employment_type:"permanent", join_date:"2022-09-15", basic_salary:90000,  bank_name:"Sampath Bank",         bank_branch:"Colombo 03",    bank_account_number:"0067890123", tax_table_code:"02", is_epf_applicable:true,  is_etf_applicable:true  },
  { employee_number:"EMP007", full_name:"Arjun Kulasekara",     nic_number:"199108765432", email:"arjun.k@company.lk",         mobile:"0712987654", employment_type:"permanent", join_date:"2020-11-01", basic_salary:135000, bank_name:"Hatton National Bank", bank_branch:"Nugegoda",      bank_account_number:"0078901234", tax_table_code:"03", is_epf_applicable:true,  is_etf_applicable:true  },
  { employee_number:"EMP008", full_name:"Sachini Jayawardena",  nic_number:"199703456789", email:"sachini.j@company.lk",       mobile:"0771122334", employment_type:"probation", join_date:"2024-02-01", basic_salary:50000,  bank_name:"People's Bank",         bank_branch:"Maharagama",    bank_account_number:"0089012345", tax_table_code:"01", is_epf_applicable:true,  is_etf_applicable:true  },
  { employee_number:"EMP009", full_name:"Mohideen Farook",      nic_number:"198809876543", email:"m.farook@company.lk",        mobile:"0766112233", employment_type:"permanent", join_date:"2018-07-01", basic_salary:160000, bank_name:"Commercial Bank",      bank_branch:"Colombo 01",    bank_account_number:"0090123456", tax_table_code:"04", is_epf_applicable:true,  is_etf_applicable:true  },
  { employee_number:"EMP010", full_name:"Kumari Weerasinghe",   nic_number:"199204123456", email:"kumari.w@company.lk",        mobile:"0752233445", employment_type:"permanent", join_date:"2021-03-15", basic_salary:80000,  bank_name:"Sampath Bank",         bank_branch:"Kalutara",      bank_account_number:"0001234567", tax_table_code:"01", is_epf_applicable:true,  is_etf_applicable:true  },
  { employee_number:"EMP011", full_name:"Roshan Bandara",       nic_number:"199507654321", email:"roshan.b@company.lk",        mobile:"0769988776", employment_type:"intern",    join_date:"2024-01-10", basic_salary:30000,  bank_name:"Bank of Ceylon",       bank_branch:"Kandy",         bank_account_number:"0112233445", tax_table_code:"01", is_epf_applicable:false, is_etf_applicable:false },
  { employee_number:"EMP012", full_name:"Nishani Gallage",      nic_number:"199406543210", email:"nishani.g@company.lk",       mobile:"0718876655", employment_type:"permanent", join_date:"2019-08-15", basic_salary:110000, bank_name:"Nations Trust Bank",   bank_branch:"Colombo 04",    bank_account_number:"0223344556", tax_table_code:"02", is_epf_applicable:true,  is_etf_applicable:true  },
];

const S = {
  card:         { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 },
  label:        { fontSize: 11, color: "var(--txt3)", marginBottom: 4, display: "block" },
  input:        { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "7px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none", boxSizing: "border-box" },
  select:       { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "7px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none", cursor: "pointer", boxSizing: "border-box" },
  btnPrimary:   { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnSecondary: { background: "var(--bg3)", color: "var(--txt2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnWarning:   { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  th:           { padding: "9px 12px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" },
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#4f7bff,#a855f7)",
  "linear-gradient(135deg,#22c984,#14b8a6)",
  "linear-gradient(135deg,#f5a623,#e05a00)",
  "linear-gradient(135deg,#a855f7,#6d28d9)",
  "linear-gradient(135deg,#ef4444,#f87171)",
];

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name, index, size = 32 }) {
  const bg = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, color: "#fff", flexShrink: 0, letterSpacing: "-.3px" }}>
      {initials(name)}
    </div>
  );
}

function ProfilePhotoPlaceholder({ name, size = 72 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#4f7bff,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, color: "#fff" }}>
        {initials(name)}
      </div>
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, background: "var(--bg2)", border: "2px solid var(--border)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Upload photo">
        <Camera size={11} color="var(--txt3)" />
      </div>
    </div>
  );
}

function Badge({ children, color }) {
  const styles = {
    green:  { background: "rgba(34,201,132,0.12)", color: "var(--green)" },
    red:    { background: "rgba(232,66,90,0.12)",  color: "var(--red)"   },
    blue:   { background: "rgba(79,123,255,0.12)", color: "var(--accent2)"},
    yellow: { background: "rgba(245,166,35,0.12)", color: "var(--amber)" },
    purple: { background: "rgba(168,85,247,0.12)", color: "var(--purple)"},
    gray:   { background: "var(--bg3)",            color: "var(--txt2)"  },
  };
  const st = styles[color] || styles.gray;
  return <span style={{ ...st, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{children}</span>;
}

const TYPE_COLOR = { permanent:"blue", contract:"purple", probation:"yellow", part_time:"gray", intern:"gray" };

function EmployeeForm({ employee, departments, onSave, onCancel }) {
  const isNew = !employee?.id;
  const [form, setForm] = useState(employee || {
    employee_number: "", full_name: "", email: "", mobile: "", department_id: "",
    employment_type: "permanent", join_date: new Date().toISOString().slice(0,10),
    basic_salary: "", is_epf_applicable: true, is_etf_applicable: true,
    tax_table_code: "01", bank_name: "", bank_branch: "", bank_account_number: "",
    epf_number: "", nic_number: "", tax_file_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!form.employee_number?.trim()) e.employee_number = "Required";
    if (!form.full_name?.trim())       e.full_name       = "Required";
    if (!form.join_date)               e.join_date       = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        basic_salary:        parseFloat(form.basic_salary) || 0,
        department_id:       form.department_id       || null,
        designation_id:      form.designation_id      || null,
        supervisor_id:       form.supervisor_id        || null,
        nic_number:          form.nic_number           || null,
        email:               form.email               || null,
        mobile:              form.mobile              || null,
        epf_number:          form.epf_number          || null,
        tax_file_number:     form.tax_file_number      || null,
        bank_name:           form.bank_name           || null,
        bank_branch:         form.bank_branch         || null,
        bank_account_number: form.bank_account_number || null,
      };
      if (employee?.id) {
        await employeeApi.update(employee.id, payload);
        toast.success(`${form.full_name} updated`);
      } else {
        await employeeApi.create(payload);
        toast.success(`${form.full_name} onboarded`);
      }
      onSave();
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast.error(Array.isArray(msg) ? msg[0]?.msg || "Validation error" : msg || "Failed to save employee");
    } finally { setSaving(false); }
  }

  function f(key) { return (e) => setForm(p => ({ ...p, [key]: e.target.value })); }

  const fieldStyle = (key) => ({
    ...S.input,
    borderColor: errors[key] ? "var(--red)" : "var(--border2)",
  });

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0 10px", borderBottom: "1px solid var(--border)" }}>
        <ProfilePhotoPlaceholder name={form.full_name || "New"} size={68} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--txt)" }}>{form.full_name || "New Employee"}</div>
          <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 3 }}>{form.employee_number || "— employee number —"}</div>
          <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2 }}>{form.employment_type?.replace("_", " ")}</div>
        </div>
      </div>

      {/* Section: Personal Info */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Personal Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>Employee Number <span style={{ color: "var(--red)" }}>*</span></label>
            <input value={form.employee_number} onChange={f("employee_number")} style={fieldStyle("employee_number")} placeholder="EMP001" />
            {errors.employee_number && <div style={{ fontSize: 10, color: "var(--red)", marginTop: 3 }}>{errors.employee_number}</div>}
          </div>
          <div>
            <label style={S.label}>Full Name <span style={{ color: "var(--red)" }}>*</span></label>
            <input value={form.full_name} onChange={f("full_name")} style={fieldStyle("full_name")} placeholder="e.g. Nimal Perera" />
            {errors.full_name && <div style={{ fontSize: 10, color: "var(--red)", marginTop: 3 }}>{errors.full_name}</div>}
          </div>
          <div>
            <label style={S.label}>NIC Number</label>
            <input value={form.nic_number || ""} onChange={f("nic_number")} style={S.input} placeholder="200012345678" />
          </div>
          <div>
            <label style={S.label}>Email</label>
            <input type="email" value={form.email || ""} onChange={f("email")} style={S.input} placeholder="nimal@company.lk" />
          </div>
          <div>
            <label style={S.label}>Mobile</label>
            <input value={form.mobile || ""} onChange={f("mobile")} style={S.input} placeholder="0771234567" />
          </div>
          <div>
            <label style={S.label}>Join Date <span style={{ color: "var(--red)" }}>*</span></label>
            <input type="date" value={form.join_date || ""} onChange={f("join_date")} style={fieldStyle("join_date")} />
            {errors.join_date && <div style={{ fontSize: 10, color: "var(--red)", marginTop: 3 }}>{errors.join_date}</div>}
          </div>
        </div>
      </div>

      {/* Section: Employment */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Employment Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>Department</label>
            <select value={form.department_id || ""} onChange={f("department_id")} style={S.select}>
              <option value="">— Select department —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {departments.length === 0 && (
              <div style={{ fontSize: 10, color: "var(--amber)", marginTop: 3 }}>No departments yet — create defaults first</div>
            )}
          </div>
          <div>
            <label style={S.label}>Employment Type</label>
            <select value={form.employment_type} onChange={f("employment_type")} style={S.select}>
              {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace("_"," ")}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Basic Salary (LKR)</label>
            <input type="number" value={form.basic_salary || ""} onChange={f("basic_salary")} style={S.input} placeholder="50000" min={0} />
          </div>
          <div>
            <label style={S.label}>APIT Tax Table</label>
            <select value={form.tax_table_code || "01"} onChange={f("tax_table_code")} style={S.select}>
              {TAX_TABLES.map(t => <option key={t} value={t}>Table {t}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>EPF Number</label>
            <input value={form.epf_number || ""} onChange={f("epf_number")} style={S.input} placeholder="Optional" />
          </div>
          <div>
            <label style={S.label}>Tax File Number</label>
            <input value={form.tax_file_number || ""} onChange={f("tax_file_number")} style={S.input} placeholder="Optional" />
          </div>
        </div>
      </div>

      {/* Section: Bank */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Bank Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>Bank Name</label>
            <input value={form.bank_name || ""} onChange={f("bank_name")} style={S.input} placeholder="Bank of Ceylon" />
          </div>
          <div>
            <label style={S.label}>Bank Branch</label>
            <input value={form.bank_branch || ""} onChange={f("bank_branch")} style={S.input} placeholder="Colombo Fort" />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={S.label}>Bank Account Number</label>
            <input value={form.bank_account_number || ""} onChange={f("bank_account_number")} style={S.input} placeholder="0012345678" />
          </div>
        </div>
      </div>

      {/* EPF / ETF checkboxes */}
      <div style={{ display: "flex", gap: 12 }}>
        {[["EPF Applicable","is_epf_applicable"],["ETF Applicable","is_etf_applicable"]].map(([label, key]) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--txt2)", cursor: "pointer", padding: "8px 14px", background: form[key] ? "rgba(79,123,255,0.08)" : "var(--bg3)", borderRadius: 6, border: `1px solid ${form[key] ? "rgba(79,123,255,0.3)" : "var(--border2)"}`, flex: 1 }}>
            <input type="checkbox" checked={!!form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} style={{ accentColor: "var(--accent)", width: 14, height: 14 }} />
            {label}
          </label>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        <button type="submit" disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.7 : 1, minWidth: 130 }}>
          {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : (isNew ? "Create Employee" : "Save Changes")}
        </button>
        <button type="button" onClick={onCancel} style={S.btnSecondary}>Cancel</button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </form>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [seedingDepts, setSeedingDepts] = useState(false);
  const [seedingEmployees, setSeedingEmployees] = useState(false);
  const PAGE_SIZE = 25;

  const loadDepts = useCallback(async () => {
    try {
      const r = await employeeApi.listDepartments();
      setDepartments(r.data || []);
      return r.data || [];
    } catch { return []; }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (search)     params.search          = search;
      if (deptFilter) params.department_id   = deptFilter;
      if (typeFilter) params.employment_type = typeFilter;
      const res = await employeeApi.list(params);
      setEmployees(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch { toast.error("Failed to load employees"); }
    finally { setLoading(false); }
  }, [search, deptFilter, typeFilter, page]);

  useEffect(() => {
    loadDepts().then(depts => {
      if (depts.length === 0) seedDefaultDepts(true);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function seedDefaultDepts(silent = false) {
    setSeedingDepts(true);
    let created = 0;
    for (const d of DEFAULT_DEPTS) {
      try { await employeeApi.createDepartment(d.code, d.name, null); created++; } catch (_) {}
    }
    if (!silent && created > 0) toast.success(`Created ${created} default departments`);
    await loadDepts();
    setSeedingDepts(false);
  }

  async function seedSampleEmployees() {
    if (employees.length > 0) {
      if (!confirm("There are already employees in the system. Add sample employees anyway?")) return;
    }
    setSeedingEmployees(true);
    let depts = departments;
    if (depts.length === 0) {
      toast("Creating departments first…");
      await seedDefaultDepts(true);
      depts = await loadDepts();
    }
    const deptIds = depts.map(d => d.id);
    let created = 0;
    for (let i = 0; i < SAMPLE_EMPLOYEES.length; i++) {
      const emp = SAMPLE_EMPLOYEES[i];
      const deptId = deptIds[i % deptIds.length] || null;
      try {
        await employeeApi.create({ ...emp, department_id: deptId });
        created++;
      } catch (err) {
        const msg = err.response?.data?.detail;
        if (typeof msg === "string" && msg.includes("already exists")) continue;
      }
    }
    toast.success(`Added ${created} sample employees`);
    await load();
    setSeedingEmployees(false);
  }

  function handleExport() {
    if (!employees.length) { toast.error("No data to export"); return; }
    const headers = ["Emp No.","Full Name","NIC","Email","Mobile","Department","Type","Join Date","Basic (LKR)","EPF No.","Bank","Account","Tax Table","Status"];
    const rows = employees.map(e => [
      e.employee_number, e.full_name, e.nic_number || "", e.email || "", e.mobile || "",
      departments.find(d => d.id === e.department_id)?.name || "",
      e.employment_type?.replace("_"," "),
      e.join_date, (e.basic_salary || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 }),
      e.epf_number || "", e.bank_name || "", e.bank_account_number || "",
      `Table ${e.tax_table_code || "01"}`, e.is_active ? "Active" : "Inactive",
    ]);
    exportXlsx(`employees_${todayTag()}.xlsx`, "Employees", headers, rows);
    toast.success("Excel downloaded");
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeCount = employees.filter(e => e.is_active).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--txt)" }}>Employee Master</p>
          <p style={{ fontSize: 12, color: "var(--txt3)" }}>{total} employee{total !== 1 ? "s" : ""} · {departments.length} departments</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {total === 0 && (
            <button onClick={seedSampleEmployees} disabled={seedingEmployees} style={{ ...S.btnWarning, opacity: seedingEmployees ? 0.6 : 1 }}>
              {seedingEmployees ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Loading…</> : "🇱🇰 Load Sample Employees"}
            </button>
          )}
          <button onClick={handleExport} style={S.btnSecondary}>
            <Download size={13} /> Export Excel
          </button>
          <button onClick={() => { setEditEmployee(null); setShowForm(true); }} style={S.btnPrimary}>
            <Plus size={13} /> Onboard Employee
          </button>
        </div>
      </div>

      {/* KPI pills */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { icon: <Users size={13} />,     label: "Total Employees", value: total,             color: "var(--accent)" },
          { icon: <UserCheck size={13} />, label: "Active",          value: activeCount,        color: "#10b981" },
          { icon: <Building2 size={13} />, label: "Departments",     value: departments.length, color: "#8b5cf6" },
        ].map(k => (
          <div key={k.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8 }}>
            <span style={{ color: k.color }}>{k.icon}</span>
            <span style={{ fontSize: 11, color: "var(--txt3)" }}>{k.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: k.color, fontFamily: "DM Mono,monospace" }}>{k.value}</span>
          </div>
        ))}
        {departments.length === 0 && (
          <button onClick={() => seedDefaultDepts(false)} disabled={seedingDepts} style={{ ...S.btnSecondary, fontSize: 11, opacity: seedingDepts ? 0.6 : 1 }}>
            <Building2 size={12} /> {seedingDepts ? "Creating…" : "Create Default Departments"}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>
              {editEmployee ? `Edit: ${editEmployee.full_name}` : "New Employee"}
            </p>
            <button onClick={() => { setShowForm(false); setEditEmployee(null); }} style={{ background: "none", border: "none", color: "var(--txt3)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
          </div>
          <EmployeeForm
            employee={editEmployee}
            departments={departments}
            onSave={() => { setShowForm(false); setEditEmployee(null); load(); }}
            onCancel={() => { setShowForm(false); setEditEmployee(null); }}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--txt3)" }} />
          <input type="text" placeholder="Search by name, NIC, email…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ ...S.input, paddingLeft: 30, background: "var(--bg2)" }} />
        </div>
        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }} style={{ ...S.select, width: "auto", minWidth: 160 }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} style={{ ...S.select, width: "auto", minWidth: 140 }}>
          <option value="">All Types</option>
          {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace("_"," ")}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg3)" }}>
                <th style={S.th}>Employee</th>
                <th style={S.th}>Department</th>
                <th style={S.th}>Type</th>
                <th style={S.th}>EPF No.</th>
                <th style={{ ...S.th, textAlign: "right" }}>Basic Salary</th>
                <th style={S.th}>Bank</th>
                <th style={S.th}>Status</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: "40px 0", textAlign: "center" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--txt3)" }}>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading employees…
                  </div>
                </td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "48px 0", textAlign: "center" }}>
                  <div>
                    <Users style={{ width: 36, height: 36, color: "var(--txt3)", margin: "0 auto 12px" }} />
                    <p style={{ color: "var(--txt2)", fontWeight: 500, marginBottom: 6 }}>No employees found</p>
                    <p style={{ color: "var(--txt3)", fontSize: 11 }}>Click &ldquo;Onboard Employee&rdquo; or load sample data to get started</p>
                  </div>
                </td></tr>
              ) : employees.map((emp, i) => (
                <tr key={emp.id} style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                  onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}>
                  <td style={{ padding: "9px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Avatar name={emp.full_name} index={i} size={32} />
                      <div>
                        <p style={{ color: "var(--txt)", fontWeight: 500 }}>{emp.full_name}</p>
                        <p style={{ color: "var(--txt3)", fontSize: 10, fontFamily: "DM Mono,monospace" }}>
                          {emp.employee_number}{emp.nic_number ? ` · ${emp.nic_number}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "9px 12px", color: "var(--txt2)" }}>
                    {departments.find(d => d.id === emp.department_id)?.name || <span style={{ color: "var(--txt3)" }}>—</span>}
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <Badge color={TYPE_COLOR[emp.employment_type] || "gray"}>{emp.employment_type?.replace("_"," ")}</Badge>
                  </td>
                  <td style={{ padding: "9px 12px", color: "var(--txt3)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>
                    {emp.epf_number || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--txt)", fontFamily: "DM Mono,monospace", fontSize: 12 }}>
                    LKR {(emp.basic_salary || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: "9px 12px", color: "var(--txt3)", fontSize: 11 }}>
                    {emp.bank_name ? `${emp.bank_name} ····${(emp.bank_account_number || "").slice(-4)}` : "—"}
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <Badge color={emp.is_active ? "green" : "red"}>{emp.is_active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <button onClick={() => { setEditEmployee(emp); setShowForm(true); }}
                      style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                      Edit →
                    </button>
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
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={{ ...S.btnSecondary, padding: "4px 8px", opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} style={{ ...S.btnSecondary, padding: "4px 8px", opacity: page === totalPages ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
