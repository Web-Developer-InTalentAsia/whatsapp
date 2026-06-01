"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle, Building2, User, Mail, Lock } from "lucide-react";
import Cookies from "js-cookie";

const IS_SECURE = typeof window !== "undefined" && window.location.protocol === "https:";
const COOKIE_OPTS = { secure: IS_SECURE, sameSite: "lax", expires: 7 };

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function deriveUsername(fullName) {
  if (!fullName || fullName.trim().length < 2) return "";
  return "@" + fullName.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
}

function StrengthBar({ password }) {
  if (!password) return null;
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const colors = ["#e8425a", "#f5a623", "#4f7bff", "#22c984"];
  const labels = ["Weak", "Fair", "Good", "Strong"];
  return (
    <div style={{ marginTop: 7 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < score ? colors[score-1] : "#2a3048", transition: "background .3s" }} />
        ))}
      </div>
      <p style={{ fontSize: 11, color: colors[score-1], margin: "4px 0 0" }}>{labels[score-1]}</p>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Username preview: show after stop typing, hide while typing
  const [typingName, setTypingName] = useState(false);
  const typingTimer = useRef(null);

  const handleNameChange = useCallback((val) => {
    setFullName(val);
    setTypingName(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTypingName(false), 700);
  }, []);

  const username = deriveUsername(fullName);
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (!company.trim()) { setError("Company name is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(password)) { setError("Password must contain at least one uppercase letter."); return; }
    if (!/[0-9]/.test(password)) { setError("Password must contain at least one number."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), email, company_name: company.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Registration failed. Please try again.");
      }
      // Auto-login after registration
      Cookies.set("access_token", data.access_token, COOKIE_OPTS);
      Cookies.set("refresh_token", data.refresh_token, COOKIE_OPTS);
      if (data.user) Cookies.set("user", JSON.stringify(data.user), COOKIE_OPTS);
      setDone(true);
      setTimeout(() => router.replace("/dashboard"), 1800);
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0f1117", fontFamily: "'DM Sans',sans-serif", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, background: "rgba(34,201,132,0.1)", border: "1px solid rgba(34,201,132,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <CheckCircle size={30} color="#22c984" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e8eaf2", margin: 0 }}>Account created!</h2>
          <p style={{ fontSize: 13, color: "#5a6280", marginTop: 8 }}>Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f1117", fontFamily: "'DM Sans',sans-serif" }}>

      {/* LEFT branding */}
      <div style={{ width: "42%", minWidth: 320, background: "linear-gradient(160deg,#0d1526 0%,#111827 50%,#0f1117 100%)", borderRight: "1px solid #1e2a42", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 44px", position: "relative", overflow: "hidden" }} className="reg-left-panel">
        <div style={{ position: "absolute", top: -80, left: -80, width: 300, height: 300, background: "radial-gradient(circle,rgba(79,123,255,0.1) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#4f7bff,#a855f7)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#fff", boxShadow: "0 4px 20px rgba(79,123,255,0.3)" }}>P</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e8eaf2" }}>Paylix</div>
            <div style={{ fontSize: 10, color: "#4f7bff", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 500 }}>BPO Payroll Platform</div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#e8eaf2", lineHeight: 1.3, letterSpacing: -0.5, marginBottom: 12 }}>
            Get started<br />
            <span style={{ background: "linear-gradient(90deg,#4f7bff,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>for free today</span>
          </div>
          <p style={{ fontSize: 13, color: "#5a6280", lineHeight: 1.7, maxWidth: 280 }}>
            Create your Paylix account and start managing your payroll in minutes.
          </p>
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
            {["No setup fee · Free trial", "Full EPF / ETF / APIT compliance", "Multi-company support", "Cancel anytime"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(34,201,132,0.15)", border: "1px solid rgba(34,201,132,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#22c984" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize: 13, color: "#5a6280" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11, color: "#2d3650", position: "relative" }}>
          © {new Date().getFullYear()} Paylix · Intalent Asia (Pvt) Ltd
        </p>
      </div>

      {/* RIGHT form */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", overflowY: "auto" }}>

        {/* Mobile logo */}
        <div className="reg-mobile-logo" style={{ display: "none", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#4f7bff,#a855f7)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff" }}>P</div>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#e8eaf2" }}>Paylix</span>
        </div>

        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ background: "#161922", border: "1px solid #2a3048", borderRadius: 16, padding: "32px 28px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>

            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e8eaf2", margin: 0 }}>Create your account</h1>
              <p style={{ fontSize: 13, color: "#5a6280", marginTop: 5 }}>Set up your Paylix workspace in seconds</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Full Name */}
              <div>
                <label style={labelStyle}>Full name</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text" required value={fullName}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="e.g. Kamal Perera"
                    style={inputStyle}
                    onFocus={e => { e.target.style.boxShadow = "0 0 0 2px rgba(79,123,255,0.5)"; setTypingName(false); }}
                    onBlur={e => { e.target.style.boxShadow = "none"; setTypingName(false); }}
                  />
                  {/* Username preview — hidden while typing */}
                  {username && !typingName && (
                    <span style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      fontSize: 11, color: "#4f7bff", background: "rgba(79,123,255,0.1)",
                      border: "1px solid rgba(79,123,255,0.2)", borderRadius: 4,
                      padding: "2px 7px", pointerEvents: "none",
                      animation: "fadeIn .2s ease",
                    }}>
                      {username}
                    </span>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={labelStyle}>Work email</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={inputStyle}
                  onFocus={e => e.target.style.boxShadow = "0 0 0 2px rgba(79,123,255,0.5)"}
                  onBlur={e => e.target.style.boxShadow = "none"}
                />
              </div>

              {/* Company */}
              <div>
                <label style={labelStyle}>Company name</label>
                <input
                  type="text" required value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Intalent Asia (Pvt) Ltd"
                  style={inputStyle}
                  onFocus={e => e.target.style.boxShadow = "0 0 0 2px rgba(79,123,255,0.5)"}
                  onBlur={e => e.target.style.boxShadow = "none"}
                />
              </div>

              {/* Password */}
              <div>
                <label style={labelStyle}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"} required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    style={{ ...inputStyle, paddingRight: 44 }}
                    onFocus={e => e.target.style.boxShadow = "0 0 0 2px rgba(79,123,255,0.5)"}
                    onBlur={e => e.target.style.boxShadow = "none"}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)} tabIndex={-1}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#5a6280", padding: 0, display: "flex" }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <StrengthBar password={password} />
              </div>

              {/* Confirm password */}
              <div>
                <label style={labelStyle}>Confirm password</label>
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
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {mismatch && <p style={{ fontSize: 11, color: "#e8425a", margin: "4px 0 0" }}>Passwords do not match</p>}
              </div>

              {error && <ErrorBanner message={error} />}

              <button type="submit" disabled={loading} style={submitBtnStyle(loading)}>
                {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Creating account…</> : "Create account"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 18, paddingTop: 16, borderTop: "1px solid #1e2230" }}>
              <span style={{ fontSize: 13, color: "#3a4260" }}>Already have an account? </span>
              <a href="/login" style={{ fontSize: 13, color: "#4f7bff", textDecoration: "none", fontWeight: 500 }}>Sign in</a>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: "#2d3650", marginTop: 16 }}>
            Paylix Payroll Management System · v2.0
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-50%) translateX(4px); } to { opacity: 1; transform: translateY(-50%) translateX(0); } }
        @media (max-width: 768px) {
          .reg-left-panel { display: none !important; }
          .reg-mobile-logo { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, color: "#8b92b0", marginBottom: 5 };
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
