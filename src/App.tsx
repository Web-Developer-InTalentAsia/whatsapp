import React, { useState, useEffect } from "react";
import { 
  MessageSquare, LayoutDashboard, Shield, Settings as SettingsIcon, 
  BarChart3, BookOpen, LogOut, User, Menu, X, CheckSquare
} from "lucide-react";
import Login from "./components/Login.tsx";
import Dashboard from "./components/Dashboard.tsx";
import Inbox from "./components/Inbox.tsx";
import Settings from "./components/Settings.tsx";
import Reports from "./components/Reports.tsx";
import AuditLogs from "./components/AuditLogs.tsx";
import SetupGuide from "./components/SetupGuide.tsx";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("intalent_token"));
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [activePage, setActivePage] = useState<string>("dashboard");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Validate active login token or load operator details
  const loadProfile = async (authToken: string) => {
    try {
      const response = await fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data);
      } else {
        // Stale or bad token
        handleLogout();
      }
    } catch (e) {
      console.error("Failed to load user profile", e);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleLoginSuccess = (authToken: string, user: any) => {
    localStorage.setItem("intalent_token", authToken);
    setToken(authToken);
    setCurrentUser(user);
    setActivePage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("intalent_token");
    setToken(null);
    setCurrentUser(null);
    setActivePage("dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col justify-center items-center text-zinc-100">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-emerald-600 rounded-full animate-spin border-4 border-zinc-800 border-t-emerald-600"></div>
          <span className="mt-4 text-sm font-semibold text-zinc-400">Syncing with Cloud SQL Database...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, force Login flow
  if (!token || !currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Navigation Items according to operator permissions
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inbox", label: "InTalent Inbox", icon: MessageSquare },
    { id: "reports", label: "Reports & Logs", icon: BarChart3 },
    { id: "setup-guide", label: "Meta Setup Guide", icon: BookOpen },
    { id: "settings", label: "Configuration Settings", icon: SettingsIcon },
  ];

  // Super admin can see full immutable audits
  if (currentUser.role === "super_admin") {
    navItems.push({ id: "audit-logs", label: "Security Audits", icon: Shield });
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* Dynamic Header Navbar */}
      <header className="bg-[#0c0c0e] border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo/Title block */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-900/20">
                IT
              </div>
              <div>
                <span className="font-bold text-zinc-100 tracking-tight text-sm sm:text-base block">InTalent WhatsApp Inbox</span>
                <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider block -mt-0.5">Recruiting Hub</span>
              </div>
            </div>

            {/* Desktop Navigation Link row */}
            <nav className="hidden md:flex items-center gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActivePage(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-tight transition flex items-center gap-2 cursor-pointer ${
                      isActive 
                        ? "bg-emerald-950/30 text-emerald-400 border border-emerald-800/30 font-bold" 
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Operator info and log out button */}
            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <span className="font-semibold text-zinc-300 text-xs block">{currentUser.name}</span>
                <span className="text-[9px] bg-emerald-950/30 text-emerald-400 border border-emerald-900/50 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-0.5 block">
                  {currentUser.role.replace("_", " ")}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-zinc-500 hover:text-rose-450 hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
                title="Log out of InTalent Inbox"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile menu trigger */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-900"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile menu layout */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-[#0c0c0e] px-4 py-3.5 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${
                    isActive 
                      ? "bg-emerald-600 text-white font-bold" 
                      : "text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
            
            <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-zinc-300 text-xs block">{currentUser.name}</span>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">{currentUser.role}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 border border-zinc-800 bg-zinc-900 hover:bg-rose-950/30 hover:text-rose-450 rounded-lg text-xs font-semibold text-zinc-300 transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Primary Views Content Switchboard */}
      <main className="flex-1">
        {activePage === "dashboard" && (
          <Dashboard token={token} onNavigateToInbox={() => setActivePage("inbox")} />
        )}
        {activePage === "inbox" && (
          <Inbox token={token} currentUser={currentUser} />
        )}
        {activePage === "settings" && (
          <Settings token={token} currentUser={currentUser} />
        )}
        {activePage === "reports" && (
          <Reports token={token} currentUser={currentUser} />
        )}
        {activePage === "setup-guide" && (
          <SetupGuide />
        )}
        {activePage === "audit-logs" && currentUser.role === "super_admin" && (
          <AuditLogs token={token} />
        )}
      </main>

    </div>
  );
}
