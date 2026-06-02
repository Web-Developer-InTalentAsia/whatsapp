"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard, Users, Clock, Calendar, DollarSign,
  ShieldCheck, BarChart3, FileText, LogOut,
  CheckSquare, Lock, Building2, Sliders, ChevronDown,
  Check, Plus, X,
} from "lucide-react";
import Cookies from "js-cookie";
import { authApi, companiesApi, setActiveCompany } from "../utils/api";

const NAV = [
  {
    section: "Operations",
    items: [
      { label: "Dashboard",   href: "/dashboard",   icon: LayoutDashboard, roles: ["super_admin","payroll_admin","client_admin","hr_user","finance_user","supervisor","employee","auditor"] },
      { label: "Payroll Run", href: "/payroll",      icon: DollarSign,      roles: ["super_admin","payroll_admin","client_admin","hr_user","finance_user"] },
      { label: "Employees",   href: "/employees",    icon: Users,           roles: ["super_admin","payroll_admin","client_admin","hr_user"] },
      { label: "Attendance",  href: "/attendance",   icon: Clock,           roles: ["super_admin","payroll_admin","client_admin","hr_user","supervisor","employee"] },
      { label: "Leave",       href: "/leave",        icon: Calendar,        roles: ["super_admin","payroll_admin","client_admin","hr_user","supervisor","employee"] },
    ],
  },
  {
    section: "Compliance",
    items: [
      { label: "APIT / EPF / ETF", href: "/compliance", icon: ShieldCheck, roles: ["super_admin","payroll_admin","client_admin","finance_user","auditor"] },
      { label: "Rule Engine",      href: "/rules",       icon: Sliders,     roles: ["super_admin","payroll_admin"] },
    ],
  },
  {
    section: "Administration",
    items: [
      { label: "Approvals", href: "/approvals", icon: CheckSquare, roles: ["super_admin","payroll_admin","client_admin","hr_user","finance_user","supervisor"] },
      { label: "Reports",   href: "/reports",   icon: BarChart3,   roles: ["super_admin","payroll_admin","client_admin","finance_user"] },
      { label: "Audit Log", href: "/audit",     icon: Lock,        roles: ["super_admin","auditor"] },
      { label: "My Payslips", href: "/ess",     icon: FileText,    roles: ["employee"] },
      { label: "Settings",  href: "/settings",  icon: Building2,   roles: ["super_admin","payroll_admin","client_admin"] },
    ],
  },
];

function initials(name) {
  if (!name) return "U";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function CompanyLogo({ logo, name, size = 30 }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const letter = (name || "C")[0].toUpperCase();
  if (logo && !imgFailed) {
    return (
      <div style={{ width: size, height: size, borderRadius: 7, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: "1px solid #e0e8f0" }}>
        <img src={logo} alt={name} width={size - 4} height={size - 4}
          style={{ objectFit: "contain" }}
          onError={() => setImgFailed(true)} />
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 7, background: "linear-gradient(135deg,#0e4d6e,#1a6080)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.38, color: "#fff", flexShrink: 0 }}>
      {letter}
    </div>
  );
}

function AddCompanyModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError("Company name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await companiesApi.create({
        name: name.trim(),
        legal_name: (legalName.trim() || name.trim()),
      });
      onCreated(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  const inp = {
    width: "100%", padding: "7px 10px", background: "var(--bg3)",
    border: "1px solid var(--border2)", borderRadius: 6, color: "var(--txt)",
    fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 340, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>Add New Company</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--txt3)", display: "flex" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--txt3)", display: "block", marginBottom: 4 }}>Company Name *</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corporation" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: "var(--txt3)", display: "block", marginBottom: 4 }}>Legal Name (optional)</label>
            <input style={inp} value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Defaults to company name" />
          </div>
          {error && <div style={{ fontSize: 11, color: "var(--red)", marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid var(--border2)", background: "var(--bg3)", color: "var(--txt2)", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: "var(--accent)", color: "#fff", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Sidebar({ user }) {
  const router = useRouter();
  const { pathname } = router;
  const role = user?.role || "employee";
  const isSuperAdmin = role === "super_admin";

  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompanyState] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const dropdownRef = useRef(null);

  // Load companies list for super admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    companiesApi.list().then(res => {
      const list = res.data;
      setCompanies(list);
      const cookieId = Cookies.get("abunthrahr_company_id");
      const found = list.find(c => c.id === cookieId);
      if (found) {
        setActiveCompanyState(found);
      } else {
        const own = list.find(c => c.id === user?.company_id);
        if (own) setActiveCompanyState(own);
      }
    }).catch(() => {});
  }, [isSuperAdmin, user?.company_id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function switchCompany(company) {
    setActiveCompany(company.id);
    setActiveCompanyState(company);
    setDropdownOpen(false);
    window.location.reload();
  }

  async function handleLogout() {
    try { await authApi.logout(); } catch (_) {}
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    Cookies.remove("user");
    Cookies.remove("abunthrahr_company_id");
    window.location.href = "/login";
  }

  function handleCompanyCreated(newCompany) {
    setShowAddModal(false);
    setCompanies(prev => [...prev, newCompany].sort((a, b) => a.name.localeCompare(b.name)));
    switchCompany(newCompany);
  }

  const displayName = activeCompany?.name || user?.company_name || "Intalent Asia";
  const displayLogo = activeCompany?.logo_url || (activeCompany ? null : user?.company_logo);
  const activeId = activeCompany?.id || user?.company_id;

  return (
    <>
      <aside style={{ width: 220, minWidth: 220, background: "var(--bg2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", height: "100vh" }}>
        {/* AbunthraHR brand header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo-abunthrahr.svg" alt="AbunthraHR" style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--txt)", letterSpacing: "-.3px" }}>
              Abunthra<span style={{ color: "#00aaff" }}>HR</span>
            </div>
            <div style={{ fontSize: 9, fontWeight: 500, color: "var(--txt3)", letterSpacing: ".8px", textTransform: "uppercase" }}>by InTalent Asia</div>
          </div>
        </div>

        {/* Company switcher row */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <div
            style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9, background: "rgba(79,123,255,0.05)", cursor: isSuperAdmin ? "pointer" : "default", userSelect: "none" }}
            onClick={() => isSuperAdmin && setDropdownOpen(o => !o)}
            title={isSuperAdmin ? "Switch company" : displayName}
          >
            <CompanyLogo logo={displayLogo} name={displayName} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--txt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName}
              </div>
              <div style={{ fontSize: 10, color: "var(--txt3)" }}>{user?.role?.replace(/_/g," ") || ""}</div>
            </div>
            {isSuperAdmin && (
              <ChevronDown style={{ width: 13, height: 13, color: "var(--txt3)", flexShrink: 0, transition: "transform .2s", transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            )}
          </div>

          {/* Dropdown */}
          {dropdownOpen && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg2)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 10px 10px", zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", maxHeight: 280, overflowY: "auto" }}>
              {companies.map(c => (
                <div
                  key={c.id}
                  onClick={() => switchCompany(c)}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", cursor: "pointer", background: c.id === activeId ? "rgba(79,123,255,0.08)" : "transparent", transition: "background .12s" }}
                  onMouseEnter={e => { if (c.id !== activeId) e.currentTarget.style.background = "var(--bg3)"; }}
                  onMouseLeave={e => { if (c.id !== activeId) e.currentTarget.style.background = "transparent"; }}
                >
                  <CompanyLogo logo={c.logo_url} name={c.name} size={24} />
                  <span style={{ flex: 1, fontSize: 12, color: "var(--txt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  {c.id === activeId && <Check style={{ width: 12, height: 12, color: "var(--accent)", flexShrink: 0 }} />}
                </div>
              ))}
              {/* Add New Company */}
              <div
                onClick={() => { setDropdownOpen(false); setShowAddModal(true); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer", borderTop: "1px solid var(--border)", color: "var(--accent)", fontSize: 12, fontWeight: 500 }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <Plus style={{ width: 13, height: 13 }} />
                Add New Company
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
          {NAV.map(({ section, items }) => {
            const visible = items.filter(i => i.roles.includes(role));
            if (!visible.length) return null;
            return (
              <div key={section}>
                <div style={{ padding: "4px 16px", fontSize: 10, fontWeight: 500, color: "var(--txt3)", letterSpacing: "1px", textTransform: "uppercase", marginTop: 8 }}>{section}</div>
                {visible.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                  return (
                    <Link key={href} href={href} style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "8px 16px", cursor: "pointer", transition: "all .15s",
                      color: active ? "var(--accent)" : "var(--txt2)",
                      background: active ? "var(--bg3)" : "transparent",
                      borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                      fontSize: 12.5, textDecoration: "none", margin: "1px 0",
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--bg3)"; e.currentTarget.style.color = "var(--txt)"; }}}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--txt2)"; }}}
                    >
                      <Icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User pill */}
        <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg3)", borderRadius: 8, cursor: "pointer" }}
            onClick={handleLogout}
            title="Click to logout"
          >
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#4f7bff,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
              {initials(user?.full_name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--txt)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.full_name || "User"}</div>
              <div style={{ fontSize: 10, color: "var(--txt3)" }}>{user?.role?.replace(/_/g, " ") || "—"}</div>
            </div>
            <LogOut style={{ width: 14, height: 14, color: "var(--txt3)", flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleCompanyCreated}
        />
      )}
    </>
  );
}
