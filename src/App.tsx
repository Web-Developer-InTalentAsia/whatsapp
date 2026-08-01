import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  BarChart3,
  Bell,
  BellOff,
  CheckCheck,
  CircleAlert,
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
import PrivacyPolicy from "./components/PrivacyPolicy.tsx";
import DataDeletion from "./components/DataDeletion.tsx";
import type { AppNotification } from "./types.ts";

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
  const currentPath =
    typeof window !== "undefined"
      ? window.location.pathname
      : "/";

  const publicPage =
    currentPath === "/privacy"
      ? "privacy"
      : currentPath === "/data-deletion"
        ? "data-deletion"
        : null;

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

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">(() => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported";
      }

      return Notification.permission;
    });

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [targetConversationId, setTargetConversationId] = useState<number | null>(null);
  const knownNotificationIds = React.useRef<Set<number> | null>(null);

  const enableNotifications = useCallback(async (): Promise<void> => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch (error) {
      console.error("Unable to request notification permission:", error);
    }
  }, []);

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

  const loadNotifications = useCallback(async (showBrowserAlerts = false): Promise<void> => {
    if (!token || !currentUser) return;
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=40", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as AppNotification[];
      setNotifications(data);
      setUnreadCount(data.filter(item => !item.isRead).length);

      const currentIds = new Set(data.map(item => item.id));
      if (showBrowserAlerts && knownNotificationIds.current && "Notification" in window && Notification.permission === "granted") {
        data
          .filter(item => !item.isRead && !knownNotificationIds.current?.has(item.id))
          .slice(0, 5)
          .forEach(item => {
            const browserNotification = new Notification(item.title, {
              body: item.message,
              icon: "/favicon.ico",
              tag: `app-notification-${item.id}`,
            });
            browserNotification.onclick = () => {
              window.focus();
              setActivePage("inbox");
              if (item.conversationId) setTargetConversationId(item.conversationId);
              browserNotification.close();
            };
          });
      }
      knownNotificationIds.current = currentIds;
    } catch (error) {
      console.error("Unable to load notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [token, currentUser]);

  useEffect(() => {
    if (!token || !currentUser) {
      knownNotificationIds.current = null;
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    void loadNotifications(false);
    const intervalId = window.setInterval(() => {
      void loadNotifications(true);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [token, currentUser, loadNotifications]);

  const markNotificationRead = useCallback(async (notification: AppNotification): Promise<void> => {
    if (!token) return;
    if (!notification.isRead) {
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(error => console.error("Could not mark notification as read:", error));
    }
    setNotifications(previous => previous.map(item =>
      item.id === notification.id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item
    ));
    setUnreadCount(previous => Math.max(0, previous - (notification.isRead ? 0 : 1)));
    setNotificationPanelOpen(false);
    setActivePage("inbox");
    if (notification.conversationId) setTargetConversationId(notification.conversationId);
  }, [token]);

  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    if (!token) return;
    await fetch("/api/notifications/read-all", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(error => console.error("Could not mark notifications as read:", error));
    setNotifications(previous => previous.map(item => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  }, [token]);

  const handleNotificationBellClick = useCallback((): void => {
    if (notificationPermission === "default") void enableNotifications();
    setNotificationPanelOpen(previous => !previous);
    void loadNotifications(false);
  }, [notificationPermission, enableNotifications, loadNotifications]);

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

  if (publicPage === "privacy") {
    return <PrivacyPolicy />;
  }

  if (publicPage === "data-deletion") {
    return <DataDeletion />;
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
    <div className="app-shell min-h-screen text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      <header className="app-header border-b sticky top-0 z-50">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-18 items-center gap-5">
            {/* Logo and title */}
            <div className="flex items-center gap-3">
              <div className="brand-mark h-10 w-10 rounded-xl flex items-center justify-center font-black text-white tracking-tight">
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
            <nav className="hidden xl:flex items-center gap-1 p-1.5 rounded-2xl border border-white/[0.06] bg-black/20">
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
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                      isActive
                        ? "bg-emerald-500/12 text-emerald-300 border border-emerald-400/15 shadow-[inset_0_1px_rgba(255,255,255,.05)] font-bold"
                        : "text-zinc-400 border border-transparent hover:bg-white/[0.04] hover:text-zinc-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Desktop user information */}
            <div className="hidden xl:flex items-center gap-4">
              <button
                type="button"
                onClick={handleNotificationBellClick}
                className="relative p-2 text-zinc-400 hover:text-emerald-300 hover:bg-emerald-950/30 rounded-xl transition cursor-pointer"
                title={
                  notificationPermission === "granted"
                    ? "Open notifications"
                    : notificationPermission === "denied"
                      ? "Notifications are blocked in your browser settings"
                      : notificationPermission === "unsupported"
                        ? "This browser does not support notifications"
                        : "Enable message notifications"
                }
                aria-label="Message notifications"
              >
                {notificationPermission === "denied" ||
                notificationPermission === "unsupported" ? (
                  <BellOff className="h-5 w-5" />
                ) : (
                  <Bell className="h-5 w-5" />
                )}
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

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
            <div className="flex xl:hidden items-center gap-2">
              <button
                type="button"
                onClick={handleNotificationBellClick}
                className="relative p-2 rounded-xl text-zinc-400 hover:bg-zinc-900"
                aria-label="Message notifications"
              >
                {notificationPermission === "denied" ||
                notificationPermission === "unsupported" ? (
                  <BellOff className="h-5 w-5" />
                ) : (
                  <Bell className="h-5 w-5" />
                )}
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

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
          <div className="xl:hidden border-t border-white/[0.06] bg-[#090e12]/95 backdrop-blur-xl px-4 py-3.5 space-y-2 shadow-2xl">
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
      {notificationPanelOpen && (
        <div className="fixed right-4 top-20 z-[70] w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b1115]/[0.98] shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-zinc-100">Notifications</p>
              <p className="text-[10px] text-zinc-500">Persistent recruiting inbox alerts</p>
            </div>
            <button type="button" onClick={() => void markAllNotificationsRead()} disabled={unreadCount === 0} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-950/40 disabled:opacity-40">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {notificationsLoading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">Loading notifications…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">No notifications yet.</div>
            ) : notifications.map(notification => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void markNotificationRead(notification)}
                className={`w-full border-b border-white/[0.05] px-4 py-3 text-left transition hover:bg-white/[0.04] ${notification.isRead ? "opacity-65" : "bg-emerald-500/[0.035]"}`}
              >
                <div className="flex gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${notification.severity === "critical" ? "bg-rose-950/60 text-rose-400" : notification.severity === "warning" ? "bg-amber-950/60 text-amber-400" : notification.severity === "success" ? "bg-emerald-950/60 text-emerald-400" : "bg-sky-950/60 text-sky-400"}`}>
                    <CircleAlert className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-xs font-semibold text-zinc-200">{notification.title}</p>
                      {!notification.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-500">{notification.message}</p>
                    <p className="mt-1.5 text-[9px] text-zinc-600">{new Date(notification.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
            initialConversationId={targetConversationId}
            onInitialConversationHandled={() => setTargetConversationId(null)}
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
