"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Cookies from "js-cookie";
import { Search, Bell, Download, Plus } from "lucide-react";
import Sidebar from "./Sidebar";

const PAGE_TITLES = {
  "/dashboard":  "Operations Dashboard",
  "/payroll":    "Payroll Run",
  "/employees":  "Employee Master",
  "/attendance": "Attendance & Hikvision",
  "/leave":      "Leave Management",
  "/compliance": "APIT / EPF / ETF Compliance",
  "/rules":      "Payroll Rule Engine",
  "/approvals":  "Pending Approvals",
  "/reports":    "Reports & Statutory Filings",
  "/audit":      "Audit Log",
  "/ess":        "Employee Self-Service",
  "/settings":   "Company Settings",
};

export default function AppLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) { router.replace("/login"); return; }
    // Load fresh user profile (includes company_name + company_logo)
    import("../utils/api").then(({ authApi }) => {
      authApi.me().then(r => {
        setUser(r.data);
        Cookies.set("user", JSON.stringify(r.data), { sameSite: "lax" });
      }).catch(() => {
        try { const raw = Cookies.get("user"); setUser(raw ? JSON.parse(raw) : null); } catch { setUser(null); }
      });
    });
    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const title = PAGE_TITLES[router.pathname] || "AbunthraHR";

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <Sidebar user={user} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{ height: 52, background: "var(--bg2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--txt)", flex: 1 }}>{title}</div>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 260, display: "flex", alignItems: "center", gap: 8, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, padding: "0 10px", height: 32 }}>
            <Search style={{ width: 13, height: 13, color: "var(--txt3)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search employees, payslips..."
              style={{ background: "none", border: "none", outline: "none", color: "var(--txt)", fontSize: 12, flex: 1, fontFamily: "inherit" }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid var(--border2)", background: "var(--bg3)", color: "var(--txt2)", fontFamily: "inherit" }}>
              <Download style={{ width: 12, height: 12 }} /> Export
            </button>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: "var(--accent)", color: "#fff", fontFamily: "inherit" }}>
              <Plus style={{ width: 12, height: 12 }} /> New Run
            </button>
            <div style={{ position: "relative", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--txt2)" }}>
              <Bell style={{ width: 14, height: 14 }} />
              <span style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, background: "var(--red)", borderRadius: "50%", border: "1.5px solid var(--bg2)" }} />
            </div>
          </div>
        </div>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", padding: 20, background: "var(--bg)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
