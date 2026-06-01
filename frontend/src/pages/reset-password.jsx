"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle, Lock } from "lucide-react";

function StrengthBar({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["#e8425a", "#f5a623", "#4f7bff", "#22c984"];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  if (!password) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < score ? colors[score - 1] : "#2a3048", transition: "background .3s" }} />
        ))}
      </div>
      <p style={{ fontSize: 11, color: score > 0 ? colors[score - 1] : "#5a6280", margin: 0 }}>
        {score > 0 ? labels[score - 1] : ""}
        {score < 3 && password.length > 0 && (
          <span style={{ color: "#3a4260", marginLeft: 8 }}>
            {!checks[0] && "8+ chars · "}{!checks[1] && "uppercase · "}{!checks[2] && "number · "}{!checks[3] && "symbol"}
          </span>
        )}
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Reset failed. The link may have expired.");
      }
      setDone(true);
    } catch (err) {
      setError(err.message || "Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f1117", fontFamily: "'DM Sans', sans-serif", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#4f7bff,#a855f7)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#fff" }}>P</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf2" }}>Paylix</span>
        </div>

        <div style={{ background: "#161922", border: "1px solid #2a3048", borderRadius: 16, padding: "36px 32px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
          {!done ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <div style={{ width: 44, height: 44, background: "rgba(79,123,255,0.1)", border: "1px solid rgba(79,123,255,0.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Lock size={20} color="#4f7bff" />
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e8eaf2", margin: 0 }}>Reset password</h1>
                <p style={{ fontSize: 13, color: "#5a6280", marginTop: 6 }}>Choose a strong new password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* New password */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#8b92b0", marginBottom: 6 }}>New password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showNew ? "text" : "password"} required value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={e => e.target.style.boxShadow = "0 0 0 2px rgba(79,123,255,0.5)"}
                      onBlur={e => e.target.style.boxShadow = "none"}
                    />
                    <button type="button" onClick={() => setShowNew(p => !p)} tabIndex={-1}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#5a6280", padding: 0, display: "flex" }}>
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <StrengthBar password={newPassword} />
                </div>

                {/* Confirm password */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#8b92b0", marginBottom: 6 }}>Confirm password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirm ? "text" : "password"} required value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      style={{ ...inputStyle, paddingRight: 44, borderColor: mismatch ? "rgba(232,66,90,0.5)" : "#2a3048" }}
                      onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${mismatch ? "rgba(232,66,90,0.4)" : "rgba(79,123,255,0.5)"}`}
                      onBlur={e => e.target.style.boxShadow = "none"}
                    />
                    <button type="button" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#5a6280", padding: 0, display: "flex" }}>
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {mismatch && <p style={{ fontSize: 11, color: "#e8425a", marginTop: 5 }}>Passwords do not match</p>}
                </div>

                {/* Requirements */}
                <div style={{ background: "#1a1f2e", border: "1px solid #2a3048", borderRadius: 8, padding: "12px 14px" }}>
                  <p style={{ fontSize: 11, color: "#5a6280", margin: "0 0 8px", fontWeight: 500 }}>Password requirements</p>
                  {[
                    [newPassword.length >= 8, "At least 8 characters"],
                    [/[A-Z]/.test(newPassword), "One uppercase letter"],
                    [/[0-9]/.test(newPassword), "One number"],
                    [/[^A-Za-z0-9]/.test(newPassword), "One special character (e.g. @, !)"],
                  ].map(([met, label]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: met ? "rgba(34,201,132,0.15)" : "rgba(255,255,255,0.04)", border: `1.5px solid ${met ? "#22c984" : "#2a3048"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .2s" }}>
                        {met && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="#22c984" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{ fontSize: 11, color: met ? "#22c984" : "#3a4260" }}>{label}</span>
                    </div>
                  ))}
                </div>

                {error && <ErrorBanner message={error} />}

                <button type="submit" disabled={loading} style={submitBtnStyle(loading)}>
                  {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Resetting…</> : "Reset password"}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ width: 56, height: 56, background: "rgba(34,201,132,0.1)", border: "1px solid rgba(34,201,132,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <CheckCircle size={26} color="#22c984" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf2", margin: 0 }}>Password reset!</h2>
              <p style={{ fontSize: 13, color: "#5a6280", marginTop: 10, lineHeight: 1.7 }}>
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
              <button onClick={() => router.push("/login")} style={{ ...submitBtnStyle(false), marginTop: 20 }}>
                Go to sign in
              </button>
            </div>
          )}

          {!done && (
            <button onClick={() => router.push("/login")}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", color: "#3a4260", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", padding: "16px 0 0", marginTop: 4 }}>
              <ArrowLeft size={13} /> Back to sign in
            </button>
          )}
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
  fontFamily: "inherit", outline: "none", transition: "box-shadow .15s, border-color .15s",
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
