"use client";
import { useState, useEffect } from "react";
import {
  Plus, Layers, Settings2, Sliders, Trash2, Edit2, X,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { payrollApi } from "../utils/api";
import toast from "react-hot-toast";

// ─── Value type metadata ─────────────────────────────────────────────────────
const TYPE_META = {
  percent: { label: "Percent", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  decimal: { label: "Decimal", color: "#4f7bff", bg: "rgba(79,123,255,0.12)" },
  integer: { label: "Integer", color: "#14b8a6", bg: "rgba(20,184,166,0.12)" },
  formula: { label: "Formula", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  boolean: { label: "Boolean", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  text:    { label: "Text",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

// ─── Category definitions ────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "statutory",  label: "Statutory Contributions", color: "#4f7bff", icon: "🏛️",
    desc: "EPF/ETF rates mandated by Sri Lanka law" },
  { key: "overtime",   label: "Overtime & Hours",         color: "#f59e0b", icon: "⏱️",
    desc: "OT multipliers, thresholds, and daily-rate basis" },
  { key: "allowances", label: "Allowances",               color: "#10b981", icon: "💰",
    desc: "Shift premiums, meal, transport, and attendance incentives" },
  { key: "deductions", label: "Deductions",               color: "#ef4444", icon: "📉",
    desc: "Loan repayment caps and other deduction limits" },
  { key: "earnings",   label: "Eligible Earnings",        color: "#8b5cf6", icon: "📊",
    desc: "Define which components count toward EPF and APIT bases" },
];

// Key → category lookup (used to group DB rules)
const KEY_CATEGORY = {
  // Statutory
  epf_employee_rate:            "statutory",
  epf_employer_rate:            "statutory",
  etf_rate:                     "statutory",
  etf_employer_rate:            "statutory",
  // Overtime & Hours
  ot_multiplier:                "overtime",
  public_hol_multiplier:        "overtime",
  weekly_ot_threshold:          "overtime",
  weekly_ot_threshold_hours:    "overtime",
  working_days:                 "overtime",
  working_days_per_month:       "overtime",
  nopay_basis:                  "overtime",
  // Allowances
  night_shift_allowance:        "allowances",
  night_shift_allowance_rate:   "allowances",
  evening_shift_pct:            "allowances",
  evening_shift_allowance_rate: "allowances",
  meal_allowance_daily:         "allowances",
  meal_allowance_per_day:       "allowances",
  transport_allowance:          "allowances",
  transport_allowance_monthly:  "allowances",
  attendance_bonus:             "allowances",
  // Deductions
  loan_max_deduction_pct:       "deductions",
  loan_max_deduction_rate:      "deductions",
  // Eligible Earnings
  epf_eligible_basis:           "earnings",
  epf_eligible_earnings:        "earnings",
  apit_eligible_basis:          "earnings",
  apit_eligible_earnings:       "earnings",
};

// ─── Full preset catalogue ────────────────────────────────────────────────────
const PRESETS = [
  // Statutory
  { rule_key:"epf_employee_rate",      rule_name:"EPF Employee Rate",       rule_value:"0.08",                      value_type:"percent", description:"Employee EPF contribution — 8% of EPF-eligible wages" },
  { rule_key:"epf_employer_rate",      rule_name:"EPF Employer Rate",       rule_value:"0.12",                      value_type:"percent", description:"Employer EPF contribution — 12% of EPF-eligible wages" },
  { rule_key:"etf_rate",               rule_name:"ETF Employer Rate",       rule_value:"0.03",                      value_type:"percent", description:"Employer ETF contribution — 3% of EPF-eligible wages (ETF Act)" },
  // Overtime & Hours
  { rule_key:"ot_multiplier",          rule_name:"OT Rate Multiplier",      rule_value:"1.5",                       value_type:"decimal", description:"Overtime pay multiplier — 1.5× for hours over weekly threshold (Shop & Office Act)" },
  { rule_key:"public_hol_multiplier",  rule_name:"Public Holiday OT Rate",  rule_value:"2.0",                       value_type:"decimal", description:"OT rate for gazetted public holidays — 2× basic hourly rate" },
  { rule_key:"weekly_ot_threshold",    rule_name:"Weekly OT Threshold",     rule_value:"45",                        value_type:"integer", description:"Hours per week before OT pay begins. Shop & Office Act: 45 hrs/week" },
  { rule_key:"working_days",           rule_name:"Working Days / Month",    rule_value:"26",                        value_type:"integer", description:"Standard working days per month used for prorating and daily rate" },
  { rule_key:"nopay_basis",            rule_name:"No-Pay Daily Basis",      rule_value:"26",                        value_type:"integer", description:"Divisor for no-pay deduction: daily_rate = basic_salary / nopay_basis" },
  // Allowances
  { rule_key:"night_shift_allowance",  rule_name:"Night Shift Allowance",   rule_value:"0.15",                      value_type:"percent", description:"Night shift premium — 15% of basic salary (shifts starting 10 PM–6 AM)" },
  { rule_key:"evening_shift_pct",      rule_name:"Evening Shift Allowance", rule_value:"0.08",                      value_type:"percent", description:"Evening shift premium — 8% of basic salary (6 PM–10 PM shifts)" },
  { rule_key:"meal_allowance_daily",   rule_name:"Meal Allowance (Daily)",  rule_value:"500",                       value_type:"decimal", description:"Meal allowance per working day (LKR 500). Not EPF-eligible." },
  { rule_key:"transport_allowance",    rule_name:"Transport Allowance",     rule_value:"3000",                      value_type:"decimal", description:"Monthly transport allowance (LKR 3,000). Not EPF-eligible." },
  { rule_key:"attendance_bonus",       rule_name:"Attendance Bonus",        rule_value:"2000",                      value_type:"decimal", description:"Full-attendance monthly bonus (LKR 2,000). Paid only if zero absent days." },
  // Deductions
  { rule_key:"loan_max_deduction_pct", rule_name:"Max Loan Deduction %",   rule_value:"0.25",                      value_type:"percent", description:"Maximum loan repayment deductible as % of gross salary (25% cap)" },
  // Eligible Earnings
  { rule_key:"epf_eligible_basis",     rule_name:"EPF Eligible Earnings",   rule_value:"basic+fixed_allowances",    value_type:"text",    description:"Components included in EPF base. Excludes OT pay, meal, and transport allowances." },
  { rule_key:"apit_eligible_basis",    rule_name:"APIT Taxable Earnings",   rule_value:"gross-epf_employee-non_taxable", value_type:"text", description:"APIT taxable income formula: Gross minus EPF employee contribution minus non-taxable components." },
];

// ─── Formula reference ────────────────────────────────────────────────────────
const FORMULA_REF = [
  {
    title: "OT Calculation",
    color: "#f59e0b",
    lines: [
      "daily_rate   = basic_salary / working_days",
      "hourly_rate  = (basic_salary / working_days) / 8",
      "",
      "IF weekly_hours > weekly_ot_threshold THEN",
      "  ot_hours = weekly_hours − weekly_ot_threshold",
      "  ot_pay   = ot_hours × hourly_rate × ot_multiplier",
    ],
  },
  {
    title: "No-Pay Deduction",
    color: "#4f7bff",
    lines: [
      "daily_rate  = basic_salary / nopay_basis",
      "no_pay      = daily_rate × no_pay_days",
      "gross       = basic_salary − no_pay + allowances",
    ],
  },
  {
    title: "EPF / ETF Computation",
    color: "#10b981",
    lines: [
      "epf_base         = basic + fixed_allowances",
      "epf_employee_cont = epf_base × 0.08",
      "epf_employer_cont = epf_base × 0.12",
      "etf_cont          = epf_base × 0.03",
    ],
  },
  {
    title: "APIT Taxable Income",
    color: "#8b5cf6",
    lines: [
      "gross_pay    = basic + allowances + ot_pay + bonus",
      "epf_ded      = basic × 0.08",
      "non_taxable  = meal_allow + transport_allow",
      "apit_taxable = gross_pay − epf_ded − non_taxable",
    ],
  },
];

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  card:     { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 },
  label:    { fontSize: 11, color: "var(--txt3)", marginBottom: 4, display: "block" },
  input:    { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "7px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none" },
  select:   { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "7px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none", cursor: "pointer" },
  btnPri:   { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnSec:   { background: "var(--bg3)", color: "var(--txt2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnDanger:{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 },
  btnEdit:  { background: "rgba(79,123,255,0.1)", color: "var(--accent)", border: "1px solid rgba(79,123,255,0.2)", borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 },
};

function TypeBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.text;
  return (
    <span style={{ background: m.bg, color: m.color, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", whiteSpace: "nowrap" }}>
      {m.label}
    </span>
  );
}

function displayValue(rule) {
  const v = parseFloat(rule.rule_value);
  if (rule.value_type === "percent") {
    const pct = v * 100;
    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
  }
  if (rule.value_type === "decimal") {
    if (!isNaN(v) && v >= 100) return `LKR ${v.toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
    return `${v}×`;
  }
  if (rule.value_type === "integer" && !isNaN(v)) return v.toLocaleString();
  return rule.rule_value;
}

// ─── Rule Card ─────────────────────────────────────────────────────────────────
function RuleCard({ rule, catColor, onEdit, onDelete }) {
  return (
    <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 0, overflow: "hidden" }}>
      <div style={{ height: 3, background: catColor }} />
      <div style={{ padding: "12px 14px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--txt)", marginBottom: 2, lineHeight: 1.3 }}>{rule.rule_name}</div>
            <div style={{ fontSize: 10, color: "var(--txt3)", fontFamily: "DM Mono,monospace", letterSpacing: ".2px" }}>{rule.rule_key}</div>
          </div>
          <TypeBadge type={rule.value_type} />
        </div>

        {rule.description && (
          <div style={{ fontSize: 11, color: "var(--txt3)", lineHeight: 1.5, marginBottom: 10 }}>{rule.description}</div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg3)", borderRadius: 6, padding: "8px 12px", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "var(--txt3)" }}>Current Value</span>
          <span style={{ fontFamily: "DM Mono,monospace", fontSize: 15, fontWeight: 700, color: "var(--txt)" }}>
            {displayValue(rule)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "var(--txt3)" }}>Effective: {rule.effective_from || "—"}</span>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => onEdit(rule)} style={S.btnEdit}><Edit2 size={11} /></button>
            <button onClick={() => onDelete(rule)} style={S.btnDanger}><Trash2 size={11} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rule Form Modal ──────────────────────────────────────────────────────────
function RuleModal({ rule, existingKeys, onClose, onSaved }) {
  const isEdit = !!rule?.id;
  const today  = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    rule_key:      rule?.rule_key      || "",
    rule_name:     rule?.rule_name     || "",
    rule_value:    rule?.rule_value    || "",
    value_type:    rule?.value_type    || "decimal",
    description:   rule?.description   || "",
    effective_from:rule?.effective_from|| today,
  });
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.rule_key || !form.rule_name || !form.rule_value) {
      toast.error("Key, name and value are required");
      return;
    }
    if (!isEdit && existingKeys.includes(form.rule_key)) {
      toast.error(`Rule key "${form.rule_key}" already exists`);
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await payrollApi.updateRule(rule.id, {
          rule_name: form.rule_name,
          rule_value: form.rule_value,
          value_type: form.value_type,
          description: form.description,
          effective_from: form.effective_from,
        });
        toast.success("Rule updated");
      } else {
        await payrollApi.createRule(form);
        toast.success("Rule created");
      }
      onSaved();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  }

  const placeholder = {
    percent: "0.08  (= 8%)",
    decimal: "1.5",
    integer: "26",
    text:    "basic+allowances",
    formula: "IF hours > 45 THEN ...",
    boolean: "true",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ ...S.card, width: 520, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>{isEdit ? "Edit Rule" : "New Payroll Rule"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--txt3)", cursor: "pointer" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={S.label}>Rule Key *</label>
              <input value={form.rule_key} onChange={e => set("rule_key", e.target.value.toLowerCase().replace(/\s+/g,"_"))}
                style={{ ...S.input, opacity: isEdit ? 0.6 : 1 }} readOnly={isEdit}
                placeholder="e.g. epf_employee_rate" />
            </div>
            <div>
              <label style={S.label}>Value Type</label>
              <select value={form.value_type} onChange={e => set("value_type", e.target.value)} style={S.select}>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={S.label}>Rule Name *</label>
            <input value={form.rule_name} onChange={e => set("rule_name", e.target.value)} style={S.input} placeholder="e.g. EPF Employee Rate" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={S.label}>Value *</label>
              <input value={form.rule_value} onChange={e => set("rule_value", e.target.value)}
                style={S.input} placeholder={placeholder[form.value_type] || ""} required />
              {form.value_type === "percent" && (
                <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 4 }}>
                  Store as decimal (0.08 = 8%)
                </div>
              )}
            </div>
            <div>
              <label style={S.label}>Effective From</label>
              <input type="date" value={form.effective_from} onChange={e => set("effective_from", e.target.value)} style={S.input} />
            </div>
          </div>
          <div>
            <label style={S.label}>Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              style={{ ...S.input, minHeight: 60, resize: "vertical" }}
              placeholder="Brief explanation of what this rule does…" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={S.btnSec}>Cancel</button>
            <button type="submit" disabled={loading} style={{ ...S.btnPri, opacity: loading ? 0.6 : 1 }}>
              {loading ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Rule")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Preset Modal ─────────────────────────────────────────────────────────────
function PresetModal({ existingKeys, onClose, onSeeded }) {
  const [seeding, setSeeding] = useState({});
  const [seedingAll, setSeedingAll] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function seedOne(preset) {
    setSeeding(s => ({ ...s, [preset.rule_key]: true }));
    try {
      await payrollApi.createRule({ ...preset, effective_from: today });
      toast.success(`"${preset.rule_name}" added`);
      onSeeded();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSeeding(s => ({ ...s, [preset.rule_key]: false })); }
  }

  async function seedAll() {
    const todo = PRESETS.filter(p => !existingKeys.includes(p.rule_key));
    if (!todo.length) { toast("All default rules already loaded"); return; }
    setSeedingAll(true);
    let ok = 0;
    for (const p of todo) {
      try { await payrollApi.createRule({ ...p, effective_from: today }); ok++; } catch (_) {}
    }
    toast.success(`Loaded ${ok} default rules`);
    onSeeded();
    setSeedingAll(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ ...S.card, width: 620, maxWidth: "95vw", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>Load Default Sri Lanka Payroll Rules</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={seedAll} disabled={seedingAll} style={{ ...S.btnPri, opacity: seedingAll ? 0.6 : 1, fontSize: 11 }}>
              <Layers size={12} /> {seedingAll ? "Loading…" : "Load All Missing"}
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--txt3)", cursor: "pointer" }}><X size={16} /></button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {CATEGORIES.map(cat => {
            const catPresets = PRESETS.filter(p => KEY_CATEGORY[p.rule_key] === cat.key);
            return (
              <div key={cat.key}>
                <div style={{ fontSize: 10, fontWeight: 600, color: cat.color, textTransform: "uppercase", letterSpacing: ".8px", padding: "8px 0 4px" }}>
                  {cat.icon} {cat.label}
                </div>
                {catPresets.map(p => {
                  const exists = existingKeys.includes(p.rule_key);
                  return (
                    <div key={p.rule_key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg3)", borderRadius: 7, marginBottom: 5, opacity: exists ? 0.5 : 1 }}>
                      <TypeBadge type={p.value_type} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--txt)" }}>{p.rule_name}</div>
                        <div style={{ fontSize: 10, color: "var(--txt3)", fontFamily: "DM Mono,monospace" }}>
                          {p.rule_key} = {p.value_type === "percent" ? `${parseFloat(p.rule_value)*100}%` : p.rule_value}
                        </div>
                      </div>
                      {exists ? (
                        <span style={{ fontSize: 10, color: "#10b981", fontWeight: 600 }}>✓ Loaded</span>
                      ) : (
                        <button onClick={() => seedOne(p)} disabled={seeding[p.rule_key]} style={{ ...S.btnPri, fontSize: 11, padding: "4px 10px", opacity: seeding[p.rule_key] ? 0.6 : 1 }}>
                          {seeding[p.rule_key] ? "…" : "Add"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Formula Reference Panel ──────────────────────────────────────────────────
function FormulaPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...S.card, overflow: "hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: "100%", background: "none", border: "none", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Info size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>Payroll Formula Reference</span>
          <span style={{ fontSize: 11, color: "var(--txt3)" }}>— how these rules are applied in calculation</span>
        </div>
        {open ? <ChevronUp size={14} color="var(--txt3)" /> : <ChevronDown size={14} color="var(--txt3)" />}
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, paddingTop: 14 }}>
            {FORMULA_REF.map(f => (
              <div key={f.title} style={{ background: "var(--bg3)", borderRadius: 8, padding: 14, border: `1px solid var(--border2)` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: f.color, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 3, height: 14, background: f.color, borderRadius: 2 }} />
                  {f.title}
                </div>
                <div style={{ fontFamily: "DM Mono,monospace", fontSize: 11, lineHeight: 2, color: "var(--txt2)" }}>
                  {f.lines.map((line, i) => (
                    <div key={i} style={{ color: line === "" ? "transparent" : line.startsWith("IF") || line.startsWith("ELSE") ? "#f59e0b" : "var(--txt2)" }}>
                      {line || " "}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────
function CategorySection({ cat, rules, onEdit, onDelete }) {
  if (rules.length === 0) return null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{cat.icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>{cat.label}</div>
          <div style={{ fontSize: 11, color: "var(--txt3)" }}>{cat.desc}</div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: cat.color, background: `${cat.color}18`, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
          {rules.length} {rules.length === 1 ? "rule" : "rules"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
        {rules.map(r => <RuleCard key={r.id} rule={r} catColor={cat.color} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RulesPage() {
  const [rules, setRules]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editRule, setEditRule]   = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await payrollApi.listRules();
      setRules(res.data || []);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to load rules"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(rule) {
    if (!confirm(`Deactivate rule "${rule.rule_name}"?`)) return;
    try {
      await payrollApi.deleteRule(rule.id);
      toast.success(`"${rule.rule_name}" deactivated`);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  }

  function handleEdit(rule) { setEditRule(rule); }
  function closeModal() { setShowCreate(false); setEditRule(null); }
  function afterSave() { closeModal(); load(); }

  const existingKeys = rules.map(r => r.rule_key);

  // Group rules by category
  const grouped = {};
  for (const cat of CATEGORIES) grouped[cat.key] = [];
  const customRules = [];
  for (const r of rules) {
    const cat = KEY_CATEGORY[r.rule_key];
    if (cat && grouped[cat]) grouped[cat].push(r);
    else customRules.push(r);
  }

  const totalConfigured = rules.length;
  const totalPresets    = PRESETS.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Modals */}
      {(showCreate || editRule) && (
        <RuleModal rule={editRule} existingKeys={existingKeys} onClose={closeModal} onSaved={afterSave} />
      )}
      {showPresets && (
        <PresetModal existingKeys={existingKeys} onClose={() => setShowPresets(false)} onSeeded={() => { setShowPresets(false); load(); }} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--txt)" }}>Payroll Rule Engine</p>
          <p style={{ fontSize: 12, color: "var(--txt3)" }}>
            {totalConfigured} of {totalPresets} standard rules configured — fully overridable per company
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowPresets(true)} style={S.btnSec}>
            <Layers size={13} /> Load Defaults
          </button>
          <button onClick={() => setShowCreate(true)} style={S.btnPri}>
            <Plus size={13} /> New Rule
          </button>
        </div>
      </div>

      {/* Stat pills */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {CATEGORIES.map(cat => {
          const count = (grouped[cat.key] || []).length;
          return (
            <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--bg2)", border: `1px solid var(--border)`, borderRadius: 20, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color }} />
              <span style={{ color: "var(--txt2)" }}>{cat.label}</span>
              <span style={{ fontWeight: 700, color: count > 0 ? cat.color : "var(--txt3)", fontFamily: "DM Mono,monospace" }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
          <div style={{ width: 28, height: 28, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      ) : rules.length === 0 ? (
        <div style={{ ...S.card, padding: 48, textAlign: "center" }}>
          <Settings2 style={{ width: 40, height: 40, color: "var(--txt3)", margin: "0 auto 14px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--txt)", marginBottom: 6 }}>No rules configured yet</p>
          <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 18 }}>
            Load the default Sri Lanka payroll rules (EPF, ETF, OT, allowances) to get started instantly
          </p>
          <button onClick={() => setShowPresets(true)} style={S.btnPri}>
            <Layers size={13} /> Load Default Rules
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {CATEGORIES.map(cat => (
            <CategorySection key={cat.key} cat={cat} rules={grouped[cat.key] || []} onEdit={handleEdit} onDelete={handleDelete} />
          ))}

          {customRules.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>⚙️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>Custom Rules</div>
                  <div style={{ fontSize: 11, color: "var(--txt3)" }}>Company-specific rules not in the standard catalogue</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
                {customRules.map(r => (
                  <RuleCard key={r.id} rule={r} catColor="var(--txt3)" onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formula reference (collapsible) */}
      <FormulaPanel />
    </div>
  );
}
