import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings as SettingsIcon,
  Shield,
  X,
} from "lucide-react";

import Login from "./components/Login.tsx";
import Dashboard from "./components/Dashboard.tsx";
import Inbox from "./components/Inbox.tsx";
import Settings from "./components/Settings.tsx";
import Reports from "./components/Reports.tsx";
import AuditLogs from "./components/AuditLogs.tsx";
import SetupGuide from "./components/SetupGuide.tsx";

const TOKEN_STORAGE_KEY = "intalent_token";

interface CurrentUser {
  id?: number | string;
  name: string;
  email?: string;
  role: string;
  isActive?: boolean;
  canEditWorkflows?: boolean;
}

interface ProfileApiResponse {
  user?: CurrentUser;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

function isCurrentUser(value: unknown): value is CurrentUser {
  if (!value || typeof value !== "object") {
    return false;
  }

  const possibleUser = value as Partial<CurrentUser>;

  return (
    typeof possibleUser.name === "string" &&
    typeof possibleUser.role === "string"
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [activePage, setActivePage] =
    useState<string>("dashboard");

  const [loading, setLoading] = useState<boolean>(true);

  const [profileError, setProfileError] =
    useState<string>("");

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState<boolean>(false);

  const handleLogout = useCallback((): void => {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error(
        "Failed to remove authentication token:",
        error,
      );
    }

    setToken(null);
    setCurrentUser(null);
    setProfileError("");
    setActivePage("dashboard");
    setMobileMenuOpen(false);
    setLoading(false);
  }, []);

  const loadProfile = useCallback(
    async (
      authToken: string,
      signal?: AbortSignal,
    ): Promise<void> => {
      setLoading(true);
      setProfileError("");

      try {
        const response = await fetch("/api/auth/profile", {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          cache: "no-store",
          credentials: "same-origin",
          signal,
        });

        const responseText = await response.text();

        let data: ProfileApiResponse | null = null;

        if (responseText) {
          try {
            data = JSON.parse(
              responseText,
            ) as ProfileApiResponse;
          } catch {
            throw new Error(
              `Profile request failed with HTTP ${response.status}. The server returned an unexpected response.`,
            );
          }
        }

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          console.warn(
            `Authentication token rejected with HTTP ${response.status}.`,
          );

          handleLogout();
          return;
        }

        if (!response.ok) {
          const errorMessage =
            data?.error ||
            data?.message ||
            `Unable to load your profile. HTTP ${response.status}.`;

          throw new Error(errorMessage);
        }

        /*
         * Support both possible backend response structures:
         *
         * 1. { user: { id, name, role, ... } }
         * 2. { id, name, role, ... }
         */
        const profileCandidate =
          data?.user ?? data;

        if (!isCurrentUser(profileCandidate)) {
          throw new Error(
            "The server returned an invalid user profile.",
          );
        }

        setCurrentUser(profileCandidate);
        setProfileError("");
      } catch (error: unknown) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Failed to load user profile:",
          error,
        );

        setCurrentUser(null);

        if (error instanceof TypeError) {
          setProfileError(
            "Unable to connect to the server while validating your session. Please check the server and try again.",
          );
        } else if (error instanceof Error) {
          setProfileError(error.message);
        } else {
          setProfileError(
            "Unable to validate your login session.",
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [handleLogout],
  );

  useEffect(() => {
    /*
     * Important:
     *
     * After a successful login, Login.tsx already returns both
     * the token and the user.
     *
     * Therefore, do not immediately call /api/auth/profile again
     * when currentUser is already available.
     *
     * The profile endpoint is called only when restoring a saved
     * session after refreshing or reopening the browser.
     */
    if (!token) {
      setCurrentUser(null);
      setProfileError("");
      setLoading(false);
      return;
    }

    if (currentUser) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    void loadProfile(token, controller.signal);

    return () => {
      controller.abort();
    };
  }, [token, currentUser, loadProfile]);

  const handleLoginSuccess = (
    authToken: string,
    user: CurrentUser,
  ): void => {
    if (!authToken || !isCurrentUser(user)) {
      console.error(
        "Invalid authentication response:",
        {
          hasToken: Boolean(authToken),
          hasValidUser: isCurrentUser(user),
        },
      );

      setProfileError(
        "The authentication server returned an invalid response.",
      );

      return;
    }

    try {
      localStorage.setItem(
        TOKEN_STORAGE_KEY,
        authToken,
      );
    } catch (error) {
      console.error(
        "Failed to save authentication token:",
        error,
      );
    }

    setToken(authToken);
    setCurrentUser(user);
    setProfileError("");
    setActivePage("dashboard");
    setMobileMenuOpen(false);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col justify-center items-center text-zinc-100">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 rounded-full animate-spin border-4 border-zinc-800 border-t-emerald-600" />

          <span className="mt-4 text-sm font-semibold text-zinc-400">
            Validating your session...
          </span>
        </div>
      </div>
    );
  }

  /*
   * A saved token exists, but the server could not load the user
   * profile because of a network, proxy, or server error.
   *
   * Do not automatically delete the token for temporary errors.
   */
  if (token && !currentUser && profileError) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-8 shadow-2xl">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-950/40 text-amber-400">
            <Shield className="h-6 w-6" />
          </div>

          <h2 className="text-xl font-bold text-zinc-100">
            Unable to Validate Session
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            {profileError}
          </p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => {
                void loadProfile(token);
              }}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Retry
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No valid token or authenticated user
  if (!token || !currentUser) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "inbox",
      label: "InTalent Inbox",
      icon: MessageSquare,
    },
    {
      id: "reports",
      label: "Reports & Logs",
      icon: BarChart3,
    },
    {
      id: "setup-guide",
      label: "Meta Setup Guide",
      icon: BookOpen,
    },
    {
      id: "settings",
      label: "Configuration Settings",
      icon: SettingsIcon,
    },
  ];

  if (currentUser.role === "super_admin") {
    navItems.push({
      id: "audit-logs",
      label: "Security Audits",
      icon: Shield,
    });
  }

  const formattedRole =
    currentUser.role.replace(/_/g, " ");

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      <header className="bg-[#0c0c0e] border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo and title */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-900/20">
                IT
              </div>

              <div>
                <span className="font-bold text-zinc-100 tracking-tight text-sm sm:text-base block">
                  InTalent WhatsApp Inbox
                </span>

                <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider block -mt-0.5">
                  Recruiting Hub
                </span>
              </div>
            </div>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activePage === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
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

            {/* Desktop user information */}
            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <span className="font-semibold text-zinc-300 text-xs block">
                  {currentUser.name}
                </span>

                <span className="text-[9px] bg-emerald-950/30 text-emerald-400 border border-emerald-900/50 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-0.5 block">
                  {formattedRole}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
                title="Log out of InTalent Inbox"
                aria-label="Log out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setMobileMenuOpen(
                    (previous) => !previous,
                  )
                }
                className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-900"
                aria-label={
                  mobileMenuOpen
                    ? "Close navigation menu"
                    : "Open navigation menu"
                }
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-[#0c0c0e] px-4 py-3.5 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                activePage === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
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
                <span className="font-semibold text-zinc-300 text-xs block">
                  {currentUser.name}
                </span>

                <span className="text-[10px] text-zinc-500 uppercase font-bold">
                  {formattedRole}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 border border-zinc-800 bg-zinc-900 hover:bg-rose-950/30 hover:text-rose-400 rounded-lg text-xs font-semibold text-zinc-300 transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {activePage === "dashboard" && (
          <Dashboard
            token={token}
            onNavigateToInbox={() =>
              setActivePage("inbox")
            }
          />
        )}

        {activePage === "inbox" && (
          <Inbox
            token={token}
            currentUser={currentUser}
          />
        )}

        {activePage === "settings" && (
          <Settings
            token={token}
            currentUser={currentUser}
          />
        )}

        {activePage === "reports" && (
          <Reports
            token={token}
            currentUser={currentUser}
          />
        )}

        {activePage === "setup-guide" && (
          <SetupGuide />
        )}

        {activePage === "audit-logs" &&
          currentUser.role === "super_admin" && (
            <AuditLogs token={token} />
          )}
      </main>
    </div>
  );
}