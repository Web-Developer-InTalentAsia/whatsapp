"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Loader2, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Call the backend reset endpoint if available, else show success always
      // to avoid user enumeration attacks
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch (_) {
      // Silently ignore — show success regardless to prevent email enumeration
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f1117", fontFamily: "'DM Sans', sans-serif", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#4f7bff,#a855f7)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#fff" }}>P</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf2" }}>Paylix</span>
        </div>

        <div style={{ background: "#161922", border: "1px solid #2a3048", borderRadius: 16, padding: "36px 32px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
          {!sent ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <div style={{ width: 44, height: 44, background: "rgba(79,123,255,0.1)", border: "1px solid rgba(79,123,255,0.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Mail size={20} color="#4f7bff" />
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e8eaf2", margin: 0 }}>Forgot password?</h1>
                <p style={{ fontSize: 13, color: "#5a6280", marginTop: 6, lineHeight: 1.6 }}>
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#8b92b0", marginBottom: 6 }}>Email address</label>
                  <input
                    type="email" required autoFocus value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={inputStyle}
                    onFocus={e => e.target.style.boxShadow = "0 0 0 2px rgba(79,123,255,0.5)"}
                    onBlur={e => e.target.style.boxShadow = "none"}
                  />
                </div>

                {error && <ErrorBanner message={error} />}

                <button type="submit" disabled={loading} style={submitBtnStyle(loading)}>
                  {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Sending…</> : "Send reset link"}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ width: 56, height: 56, background: "rgba(34,201,132,0.1)", border: "1px solid rgba(34,201,132,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <CheckCircle size={26} color="#22c984" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf2", margin: 0 }}>Check your email</h2>
              <p style={{ fontSize: 13, color: "#5a6280", marginTop: 10, lineHeight: 1.7 }}>
                If an account exists for <strong style={{ color: "#8b92b0" }}>{email}</strong>, you'll receive a password reset link shortly.
              </p>
              <p style={{ fontSize: 12, color: "#3a4260", marginTop: 8 }}>Didn't receive it? Check your spam folder.</p>
            </div>
          )}

          <button
            onClick={() => router.push("/login")}
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", color: "#3a4260", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", padding: "16px 0 0", marginTop: 4 }}
          >
            <ArrowLeft size={13} /> Back to sign in
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#2d3650", marginTop: 20 }}>
          Paylix Payroll Management System · v2.0
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "#1e2230", border: "1px solid #2a3048", borderRadius: 8,
  color: "#e8eaf2", padding: "10px 14px", fontSize: 13,
  fontFamily: "inherit", outline: "none", transition: "box-shadow .15s",
};

function submitBtnStyle(disabled) {
  return {
    width: "100%", background: disabled ? "#3a5cc4" : "#4f7bff", color: "#fff",
    border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    opacity: disabled ? 0.7 : 1,
  };
}

function ErrorBanner({ message }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(232,66,90,0.1)", border: "1px solid rgba(232,66,90,0.35)", borderRadius: 8, padding: "11px 14px" }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(232,66,90,0.2)", color: "#e8425a", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>!</span>
      <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>{message}</p>
    </div>
  );
}
