import React, { useState } from "react";
import {
  ArrowRight,
  Lock,
  Mail,
  MessageSquare,
} from "lucide-react";

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

interface LoginResponse {
  token?: string;
  user?: any;
  error?: string;
  message?: string;
}

export default function Login({
  onLoginSuccess,
}: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const responseText = await response.text();

      let data: LoginResponse = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText) as LoginResponse;
        } catch {
          throw new Error(
            `Login request failed with HTTP ${response.status}. The server returned an unexpected response.`,
          );
        }
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            data.error ||
              data.message ||
              "Invalid email address or password.",
          );
        }

        if (response.status === 403) {
          throw new Error(
            data.error ||
              data.message ||
              "Your account does not have permission to sign in.",
          );
        }

        if (response.status === 404) {
          throw new Error(
            "The authentication endpoint could not be found.",
          );
        }

        if (response.status >= 500) {
          throw new Error(
            data.error ||
              data.message ||
              "The authentication server encountered an error.",
          );
        }

        throw new Error(
          data.error ||
            data.message ||
            `Authentication failed with HTTP ${response.status}.`,
        );
      }

      if (!data.token || !data.user) {
        throw new Error(
          "The server returned an invalid authentication response.",
        );
      }

      onLoginSuccess(data.token, data.user);
    } catch (caughtError: unknown) {
      console.error("Authentication request failed:", caughtError);

      if (caughtError instanceof TypeError) {
        setError(
          "Unable to connect to the authentication server. Please check your connection and try again.",
        );
      } else if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError(
          "Failed to log in. Please check your credentials and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    setEmail(event.target.value);

    if (error) {
      setError("");
    }
  };

  const handlePasswordChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    setPassword(event.target.value);

    if (error) {
      setError("");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-zinc-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 mb-4">
          <MessageSquare className="h-8 w-8" />
        </div>

        <h2 className="text-3xl font-bold text-zinc-100 tracking-tight">
          InTalent WhatsApp Inbox
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          Professional Recruiting Inbox &amp; WhatsApp Cloud API
          Dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0c0c0e] py-8 px-4 shadow-2xl border border-zinc-800 sm:rounded-2xl sm:px-10">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 bg-red-950/30 border-l-4 border-red-500 p-4 rounded text-sm text-red-300"
            >
              {error}
            </div>
          )}

          {!showForgot ? (
            <form
              className="space-y-6"
              onSubmit={handleSubmit}
              noValidate
            >
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-zinc-300"
                >
                  Email Address
                </label>

                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="h-5 w-5" />
                  </div>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={handleEmailChange}
                    disabled={loading}
                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-100 sm:text-sm bg-zinc-900/50 placeholder-zinc-600 disabled:opacity-60"
                    placeholder="you@intalent.co"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-zinc-300"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setShowForgot(true);
                    }}
                    disabled={loading}
                    className="text-sm font-medium text-emerald-500 hover:text-emerald-400 disabled:opacity-60"
                  >
                    Forgot your password?
                  </button>
                </div>

                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="h-5 w-5" />
                  </div>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={handlePasswordChange}
                    disabled={loading}
                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-100 sm:text-sm bg-zinc-900/50 placeholder-zinc-600 disabled:opacity-60"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 cursor-pointer"
              >
                {loading ? "Authenticating..." : "Sign In"}

                {!loading && (
                  <ArrowRight className="ml-2 h-4 w-4" />
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-zinc-200">
                Reset Password
              </h3>

              <p className="text-sm text-zinc-400 leading-relaxed">
                Contact your Super Admin to reset your credentials.
                Passwords are securely stored as hashed values in the
                PostgreSQL database.
              </p>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setShowForgot(false);
                }}
                className="w-full text-center px-4 py-2 border border-zinc-700 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-900"
              >
                Back to Login
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
            <a
              href="/privacy"
              className="transition hover:text-emerald-400"
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a
              href="/data-deletion"
              className="transition hover:text-emerald-400"
            >
              Data Deletion
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}