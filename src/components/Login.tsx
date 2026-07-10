import React, { useState } from "react";
import { Lock, Mail, Users, ArrowRight, MessageSquare } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("intalentintern9@gmail.com");
  const [password, setPassword] = useState("adminpassword");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: any = {};
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || "Authentication failed.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-zinc-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 mb-4">
          <MessageSquare className="h-8 w-8" />
        </div>
        <h2 className="text-3xl font-bold text-zinc-100 tracking-tight">InTalent WhatsApp Inbox</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Professional Recruiting Inbox & WhatsApp Cloud API Dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0c0c0e] py-8 px-4 shadow-2xl border border-zinc-800 sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 bg-red-950/30 border-l-4 border-red-500 p-4 rounded text-sm text-red-300">
              {error}
            </div>
          )}

          {!showForgot ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  Email Address
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-100 sm:text-sm bg-zinc-900/50 placeholder-zinc-600"
                    placeholder="you@intalent.co"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-zinc-300">
                    Password
                  </label>
                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="font-medium text-emerald-500 hover:text-emerald-400"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </div>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-100 sm:text-sm bg-zinc-900/50 placeholder-zinc-600"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-1.5 text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300 block">Default Seed Accounts:</span>
                <div>• Super Admin: <code className="bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-emerald-400">intalentintern9@gmail.com</code> / <code className="bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-emerald-400">adminpassword</code></div>
                <div>• Admin: <code className="bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-emerald-400">admin@intalent.co</code> / <code className="bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-emerald-400">admin123</code></div>
                <div>• User: <code className="bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-emerald-400">agent@intalent.co</code> / <code className="bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-emerald-400">user123</code></div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition duration-150 cursor-pointer"
                >
                  {loading ? "Authenticating..." : "Sign In"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-zinc-200">Reset Password</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Contact your Super Admin to reset your credentials. The system hashes password values inside the secure Cloud SQL PostgreSQL database.
              </p>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="w-full text-center px-4 py-2 border border-zinc-700 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-900"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
