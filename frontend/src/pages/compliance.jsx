"use client";
import { useState, useEffect } from "react";
import { complianceApi, payrollApi } from "../utils/api";
import toast from "react-hot-toast";

const S = {
  card:         { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 },
  label:        { fontSize: 11, color: "var(--txt3)", marginBottom: 4, display: "block" },
  input:        { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)", padding: "6px 10px", fontSize: 12, fontFamily: "inherit", width: "100%", outline: "none" },
  btnPrimary:   { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  btnSecondary: { background: "var(--bg3)", color: "var(--txt2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 },
  th:           { padding: "10px 12px", textAlign: "left", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" },
  thRight:      { padding: "10px 12px", textAlign: "right", color: "var(--txt3)", fontWeight: 500, fontSize: 11, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: ".3px" },
};

function fmt(n) { return (n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 }); }

function EpfTable({ data }) {
  if (!data) return null;
  return (
    <div style={S.card}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)" }}>EPF Schedule — {data.period_name}</p>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ fontSize: 11, color: "var(--txt3)" }}>Employee 8%: <strong style={{ color: "var(--txt)" }}>LKR {fmt(data.totals?.employee_contribution)}</strong></span>
          <span style={{ fontSize: 11, color: "var(--txt3)" }}>Employer 12%: <strong style={{ color: "var(--txt)" }}>LKR {fmt(data.totals?.employer_contribution)}</strong></span>
          <span style={{ fontSize: 11, color: "var(--txt3)" }}>Total: <strong style={{ color: "var(--accent)" }}>LKR {fmt(data.totals?.total)}</strong></span>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={S.th}>Emp #</th>
              <th style={S.th}>Name</th>
              <th style={S.th}>EPF No.</th>
              <th style={S.thRight}>EPF Wages</th>
              <th style={S.thRight}>Employee 8%</th>
              <th style={S.thRight}>Employer 12%</th>
              <th style={S.thRight}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.schedule?.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "24px 12px", textAlign: "center", color: "var(--txt3)" }}>No EPF entries</td></tr>
            ) : data.schedule?.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}>
                <td style={{ padding: "9px 12px", color: "var(--accent)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{row.employee_number}</td>
                <td style={{ padding: "9px 12px", color: "var(--txt)", fontWeight: 500 }}>{row.employee_name}</td>
                <td style={{ padding: "9px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{row.epf_number || "—"}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--txt2)" }}>{fmt(row.epf_wages)}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--red)" }}>{fmt(row.epf_employee_8)}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--amber)" }}>{fmt(row.epf_employer_12)}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--txt)", fontWeight: 500 }}>{fmt(row.epf_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EtfTable({ data }) {
  if (!data) return null;
  return (
    <div style={S.card}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)" }}>ETF Schedule — {data.period_name}</p>
        <span style={{ fontSize: 11, color: "var(--txt3)" }}>Total ETF: <strong style={{ color: "var(--accent)" }}>LKR {fmt(data.total_etf)}</strong></span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={S.th}>Emp #</th>
              <th style={S.th}>Name</th>
              <th style={S.thRight}>ETF Wages</th>
              <th style={S.thRight}>ETF 3%</th>
            </tr>
          </thead>
          <tbody>
            {data.schedule?.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "24px 12px", textAlign: "center", color: "var(--txt3)" }}>No ETF entries</td></tr>
            ) : data.schedule?.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}>
                <td style={{ padding: "9px 12px", color: "var(--accent)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{row.employee_number}</td>
                <td style={{ padding: "9px 12px", color: "var(--txt)", fontWeight: 500 }}>{row.employee_name}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--txt2)" }}>{fmt(row.etf_wages)}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--amber)", fontWeight: 500 }}>{fmt(row.etf_3_percent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApitTable({ data }) {
  if (!data) return null;
  return (
    <div style={S.card}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)" }}>APIT Return — {data.period_name}</p>
        <span style={{ fontSize: 11, color: "var(--txt3)" }}>Total APIT: <strong style={{ color: "var(--accent)" }}>LKR {fmt(data.total_apit)}</strong></span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={S.th}>Emp #</th>
              <th style={S.th}>Name</th>
              <th style={S.th}>NIC</th>
              <th style={S.th}>Tax File</th>
              <th style={S.th}>Table</th>
              <th style={S.thRight}>Gross Taxable</th>
              <th style={S.thRight}>APIT Deducted</th>
            </tr>
          </thead>
          <tbody>
            {data.entries?.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "24px 12px", textAlign: "center", color: "var(--txt3)" }}>No APIT entries</td></tr>
            ) : data.entries?.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "var(--bg3)")}
                onMouseLeave={e => e.currentTarget.querySelectorAll("td").forEach(td => td.style.background = "")}>
                <td style={{ padding: "9px 12px", color: "var(--accent)", fontFamily: "DM Mono,monospace", fontSize: 11 }}>{row.employee_number}</td>
                <td style={{ padding: "9px 12px", color: "var(--txt)", fontWeight: 500 }}>{row.employee_name}</td>
                <td style={{ padding: "9px 12px", color: "var(--txt2)", fontSize: 11 }}>{row.nic_number || "—"}</td>
                <td style={{ padding: "9px 12px", color: "var(--txt2)", fontSize: 11 }}>{row.tax_file_number || "—"}</td>
                <td style={{ padding: "9px 12px" }}>
                  <span style={{ background: "rgba(79,123,255,0.12)", color: "var(--accent2)", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
                    Table {row.tax_table}
                  </span>
                </td>
                <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--txt2)" }}>{fmt(row.gross_taxable)}</td>
                <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--red)", fontWeight: 500 }}>{fmt(row.apit_deducted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxTablesView({ tables }) {
  if (!tables) return null;
  const grouped = {};
  tables.forEach((t) => {
    const key = `${t.table_code}-${t.effective_year}`;
    if (!grouped[key]) grouped[key] = { code: t.table_code, year: t.effective_year, rows: [] };
    grouped[key].rows.push(t);
  });
  const groups = Object.values(grouped);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.length === 0 ? (
        <div style={{ ...S.card, padding: 32, textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>No tax tables loaded</div>
      ) : groups.map((g) => (
        <div key={`${g.code}-${g.year}`} style={S.card}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)" }}>Table {g.code} — {g.year}</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={S.th}>Income From</th>
                  <th style={S.th}>Income To</th>
                  <th style={S.thRight}>Tax Rate</th>
                  <th style={S.thRight}>Fixed Deduction</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace" }}>{fmt(r.income_from)}</td>
                    <td style={{ padding: "8px 12px", color: "var(--txt2)", fontFamily: "DM Mono,monospace" }}>{r.income_to ? fmt(r.income_to) : "∞"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--amber)" }}>{(r.tax_rate * 100).toFixed(1)}%</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--txt2)" }}>{fmt(r.fixed_deduction)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

const APIT_SLABS = {
  "01": [
    { band: "0 – 1,200,000",         rate: "0%",  cumul: "—" },
    { band: "1,200,001 – 1,800,000", rate: "6%",  cumul: "36,000" },
    { band: "1,800,001 – 3,000,000", rate: "12%", cumul: "180,000" },
    { band: "Above 3,000,000",        rate: "18%", cumul: "+" },
  ],
  "02": [
    { band: "0 – 600,000",           rate: "6%",  cumul: "36,000" },
    { band: "600,001 – 1,800,000",   rate: "12%", cumul: "180,000" },
    { band: "Above 1,800,000",        rate: "18%", cumul: "+" },
  ],
  "03": [
    { band: "0 – 3,000,000",         rate: "6%",  cumul: "180,000" },
    { band: "3,000,001 – 10,000,000",rate: "12%", cumul: "840,000" },
    { band: "Above 10,000,000",       rate: "18%", cumul: "+" },
  ],
};

const TABLE_OPTS = [
  { value:"01", label:"Table 01 — Primary" },
  { value:"02", label:"Table 02 — Secondary" },
  { value:"03", label:"Table 03 — Lump Sum" },
];

function ApitConfigCard({ apitData }) {
  const [tableCode, setTableCode] = useState("01");
  const slabs = APIT_SLABS[tableCode];
  return (
    <div style={S.card}>
      <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
        <p style={{ fontSize:13, fontWeight:600, color:"var(--txt)" }}>APIT Configuration</p>
        <p style={{ fontSize:11, color:"var(--txt3)", marginTop:2 }}>IRD 2025/26 · Table selection</p>
      </div>
      <div style={{ padding:"0 16px" }}>
        {[
          { label:"Table Type", sub:"Primary employment", right: (
            <select value={tableCode} onChange={e=>setTableCode(e.target.value)} style={{ ...S.input, width:"auto" }}>
              {TABLE_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )},
          { label:"Tax Year", sub:"Financial year", right:<span style={{ fontFamily:"DM Mono,monospace", fontSize:13, color:"var(--txt)" }}>2025 / 26</span> },
          { label:"Tax-Free Threshold", sub:"Per annum — IRD approved", right:<span style={{ fontFamily:"DM Mono,monospace", fontSize:13, color:"var(--txt)" }}>LKR 1.2M <small style={{ fontFamily:"inherit", fontSize:10, color:"var(--txt3)" }}>/year</small></span> },
          { label:"Tax-on-Tax", sub:"Gross-up applicable", right:<span style={{ background:"rgba(34,201,132,.12)", color:"var(--green)", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:500 }}>Enabled</span> },
        ].map(({label,sub,right})=>(
          <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
            <div>
              <p style={{ fontSize:12, color:"var(--txt2)" }}>{label}</p>
              <p style={{ fontSize:10, color:"var(--txt3)", marginTop:1 }}>{sub}</p>
            </div>
            {right}
          </div>
        ))}
        <div style={{ height:1, background:"var(--border)", margin:"12px 0" }} />
        <p style={{ fontSize:11, fontWeight:500, color:"var(--txt3)", textTransform:"uppercase", letterSpacing:".8px", marginBottom:10 }}>
          Slab Preview — Table {tableCode}
        </p>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, marginBottom:16 }}>
          <thead>
            <tr>
              {["Income Band (LKR)","Rate","Cumulative Tax"].map(h=>(
                <th key={h} style={{ padding:"6px 10px", textAlign:h!=="Rate"?"left":"left", color:"var(--txt3)", fontWeight:500, fontSize:10, borderBottom:"1px solid var(--border)", textTransform:"uppercase", letterSpacing:".3px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slabs.map((row,i)=>(
              <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"7px 10px", color:"var(--txt2)" }}>{row.band}</td>
                <td style={{ padding:"7px 10px", color:"var(--amber)", fontFamily:"DM Mono,monospace" }}>{row.rate}</td>
                <td style={{ padding:"7px 10px", color:"var(--txt3)", fontFamily:"DM Mono,monospace" }}>{row.cumul}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EpfRatesCard({ apitData, epfData, etfData }) {
  const fmtV = (n) => n ? `LKR ${fmt(n)}` : "—";
  return (
    <div style={S.card}>
      <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
        <p style={{ fontSize:13, fontWeight:600, color:"var(--txt)" }}>EPF / ETF Rates</p>
        <p style={{ fontSize:11, color:"var(--txt3)", marginTop:2 }}>Configurable per company</p>
      </div>
      <div style={{ padding:"0 16px" }}>
        {[
          { label:"EPF — Employee",   sub:"Deducted from gross",      val:"8%",  small:"of EPF eligible" },
          { label:"EPF — Employer",   sub:"Company contribution",     val:"12%", small:"of EPF eligible" },
          { label:"ETF — Employer",   sub:"ETF Act requirement",      val:"3%",  small:"of ETF eligible" },
        ].map(({label,sub,val,small})=>(
          <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
            <div>
              <p style={{ fontSize:12, color:"var(--txt2)" }}>{label}</p>
              <p style={{ fontSize:10, color:"var(--txt3)", marginTop:1 }}>{sub}</p>
            </div>
            <div style={{ textAlign:"right" }}>
              <span style={{ fontFamily:"DM Mono,monospace", fontSize:13, color:"var(--txt)" }}>{val}</span>
              <p style={{ fontSize:10, color:"var(--txt3)" }}>{small}</p>
            </div>
          </div>
        ))}
        <div style={{ height:1, background:"var(--border)", margin:"12px 0" }} />
        <p style={{ fontSize:11, fontWeight:500, color:"var(--txt3)", textTransform:"uppercase", letterSpacing:".8px", marginBottom:10 }}>
          Statutory Summary
        </p>
        {[
          { label:"Total EPF Contribution", sub:"Employee + Employer", val: epfData?.totals?.total      ? `LKR ${fmt(epfData.totals.total)}`      : "—" },
          { label:"Total ETF Contribution", sub:"Employer only",       val: etfData?.total_etf          ? `LKR ${fmt(etfData.total_etf)}`          : "—" },
          { label:"Total APIT Withheld",    sub:"Remit to IRD by 15th",val: apitData?.total_apit        ? `LKR ${fmt(apitData.total_apit)}`        : "—" },
        ].map(({label,sub,val})=>(
          <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
            <div>
              <p style={{ fontSize:12, color:"var(--txt2)" }}>{label}</p>
              <p style={{ fontSize:10, color:"var(--txt3)", marginTop:1 }}>{sub}</p>
            </div>
            <div style={{ textAlign:"right" }}>
              <span style={{ fontFamily:"DM Mono,monospace", fontSize:13, color:"var(--txt)" }}>{val}</span>
            </div>
          </div>
        ))}
        <div style={{ marginTop:12, marginBottom:16 }}>
          <button style={{ ...S.btnSecondary, width:"100%", justifyContent:"center" }}>Generate EPF / ETF Reports</button>
        </div>
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const currentYear = new Date().getFullYear();
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [tab, setTab] = useState("apit");
  const [epfData, setEpfData] = useState(null);
  const [etfData, setEtfData] = useState(null);
  const [apitData, setApitData] = useState(null);
  const [taxTables, setTaxTables] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    payrollApi.listPeriods({ year: currentYear }).then((r) => {
      const ps = (r.data || []).filter((p) => p.status !== "draft");
      setPeriods(ps);
      if (ps.length > 0) setSelectedPeriod(ps[0]);
    }).catch(() => {});
  }, [currentYear]);

  useEffect(() => {
    if (!selectedPeriod) return;
    setEpfData(null); setEtfData(null); setApitData(null);
    loadTabData(tab, selectedPeriod.id);
  }, [selectedPeriod]);

  useEffect(() => {
    if (tab === "tax_tables") {
      if (!taxTables) loadTaxTables();
      return;
    }
    if (!selectedPeriod) return;
    loadTabData(tab, selectedPeriod.id);
  }, [tab]);

  async function loadTabData(t, pid) {
    setDataLoading(true);
    try {
      if (t === "epf" && !epfData) {
        const r = await complianceApi.getEpfSchedule(pid);
        setEpfData(r.data);
      } else if (t === "etf" && !etfData) {
        const r = await complianceApi.getEtfSchedule(pid);
        setEtfData(r.data);
      } else if (t === "apit" && !apitData) {
        const r = await complianceApi.getApitReturn(pid);
        setApitData(r.data);
      }
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to load data"); }
    finally { setDataLoading(false); }
  }

  async function loadTaxTables() {
    setDataLoading(true);
    try {
      const r = await complianceApi.listTaxTables({ effective_year: currentYear });
      setTaxTables(r.data);
    } catch { toast.error("Failed to load tax tables"); }
    finally { setDataLoading(false); }
  }

  const TABS = [
    { key: "apit", label: "APIT Return" },
    { key: "epf",  label: "EPF Schedule" },
    { key: "etf",  label: "ETF Schedule" },
    { key: "tax_tables", label: "Tax Tables" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div>
        <p style={{ fontSize: 18, fontWeight: 600, color: "var(--txt)" }}>APIT / EPF / ETF Compliance</p>
        <p style={{ fontSize: 12, color: "var(--txt3)" }}>Statutory schedules and tax returns</p>
      </div>

      {/* APIT Configuration + EPF/ETF Rates */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ApitConfigCard apitData={apitData} />
        <EpfRatesCard apitData={apitData} epfData={epfData} etfData={etfData} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, alignItems: "start" }}>
        {/* Period selector */}
        <div style={S.card}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--txt3)", textTransform: "uppercase", letterSpacing: ".5px" }}>Payroll Period</p>
          </div>
          <div>
            {periods.length === 0 ? (
              <p style={{ padding: "20px 16px", fontSize: 12, color: "var(--txt3)", textAlign: "center" }}>No completed periods</p>
            ) : periods.map((p) => (
              <button key={p.id} onClick={() => { setSelectedPeriod(p); setEpfData(null); setEtfData(null); setApitData(null); }} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                background: selectedPeriod?.id === p.id ? "var(--bg3)" : "transparent",
                borderLeft: `2px solid ${selectedPeriod?.id === p.id ? "var(--accent)" : "transparent"}`,
                border: "none", borderBottom: "1px solid var(--border)",
              }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--txt)" }}>{p.period_name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

          {!selectedPeriod && tab !== "tax_tables" ? (
            <div style={{ ...S.card, padding: 40, textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>Select a payroll period</div>
          ) : dataLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
              <div style={{ width: 28, height: 28, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <>
              {tab === "apit" && <ApitTable data={apitData} />}
              {tab === "epf"  && <EpfTable  data={epfData}  />}
              {tab === "etf"  && <EtfTable  data={etfData}  />}
              {tab === "tax_tables" && <TaxTablesView tables={taxTables} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
