"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Eye, EyeOff, Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import Cookies from "js-cookie";
import { authApi } from "../utils/api";

const IS_SECURE = typeof window !== "undefined" && window.location.protocol === "https:";
const COOKIE_OPTS = { secure: IS_SECURE, sameSite: "lax", expires: 7 };
const COOKIE_OPTS_SESSION = { secure: IS_SECURE, sameSite: "lax" };

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState("credentials");
  const [tempToken, setTempToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const digitRefs = useRef([]);
  const cooldownRef = useRef(null);
  const code = digits.join("");

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  function storeSessionAndRedirect(data) {
    const opts = rememberMe ? COOKIE_OPTS : COOKIE_OPTS_SESSION;
    Cookies.set("access_token", data.access_token, opts);
    Cookies.set("refresh_token", data.refresh_token, opts);
    if (data.user) Cookies.set("user", JSON.stringify(data.user), opts);
    router.replace("/dashboard");
  }

  async function handleCredentials(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      if (data.requires_totp) { setTempToken(data.temp_token); setStep("totp"); }
      else if (data.requires_otp) { setTempToken(data.temp_token); setStep("otp"); startResendCooldown(60); }
      else storeSessionAndRedirect(data);
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid email or password.";
      setError(typeof msg === "string" ? msg : "Login failed. Please try again.");
    } finally { setLoading(false); }
  }

  async function handleMfa(e) {
    e?.preventDefault();
    if (code.length < 6) return;
    setError(""); setLoading(true);
    try {
      const fn = step === "totp" ? authApi.verifyTotp : authApi.verifyOtp;
      const { data } = await fn(tempToken, code);
      storeSessionAndRedirect(data);
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid code. Please try again.";
      setError(typeof msg === "string" ? msg : "Verification failed.");
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => digitRefs.current[0]?.focus(), 50);
    } finally { setLoading(false); }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setError("");
    try {
      const { data } = await authApi.login(email, password);
      if (data.temp_token) setTempToken(data.temp_token);
      startResendCooldown(60);
    } catch { setError("Failed to resend code."); }
  }

  function startResendCooldown(secs) {
    setResendCooldown(secs);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(p => { if (p <= 1) { clearInterval(cooldownRef.current); return 0; } return p - 1; });
    }, 1000);
  }

  const handleDigitChange = useCallback((idx, val) => {
    const s = val.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[idx] = s; setDigits(next);
    if (s && idx < 5) digitRefs.current[idx + 1]?.focus();
    if (next.every(Boolean) && next.join("").length === 6) setTimeout(() => handleMfa(), 80);
  }, [digits]); // eslint-disable-line

  const handleDigitKeyDown = useCallback((idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) digitRefs.current[idx - 1]?.focus();
  }, [digits]);

  const handleDigitPaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { if (i < 6) next[i] = ch; });
    setDigits(next);
    digitRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) setTimeout(() => handleMfa(), 80);
  }, [digits]); // eslint-disable-line

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f1117", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── LEFT: Branding Panel ── */}
      <div style={{
        width: "42%", minWidth: 340, background: "linear-gradient(160deg,#0d1526 0%,#111827 50%,#0f1117 100%)",
        borderRight: "1px solid #1e2a42", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "48px 44px", position: "relative", overflow: "hidden",
      }}
        className="login-left-panel"
      >
        {/* Glow circles */}
        <div style={{ position: "absolute", top: -80, left: -80, width: 320, height: 320, background: "radial-gradient(circle,rgba(79,123,255,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, right: -60, width: 260, height: 260, background: "radial-gradient(circle,rgba(168,85,247,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />

        {/* InTalent Asia Logo + AbunthraHR brand */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
          {/* InTalent Asia logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo-intalent.svg" alt="InTalent Asia" style={{ width: 72, height: 72, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.92 }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf2", letterSpacing: -0.3 }}>InTalent Asia</div>
              <div style={{ fontSize: 9, color: "#8b92b0", letterSpacing: 1.5, textTransform: "uppercase" }}>YOUR SUCCESS IS OUR GOAL</div>
            </div>
          </div>
          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: "#1e2a42" }} />
            <img src="/logo-abunthrahr.svg" alt="AbunthraHR" style={{ width: 36, height: 36, objectFit: "contain" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#e8eaf2" }}>Abunthra<span style={{ color: "#00aaff" }}>HR</span></div>
              <div style={{ fontSize: 9, color: "#00aaff", letterSpacing: 1.2, textTransform: "uppercase" }}>by InTalent Asia</div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#e8eaf2", lineHeight: 1.25, letterSpacing: -0.8, marginBottom: 14 }}>
            Sri Lanka's<br />
            <span style={{ background: "linear-gradient(90deg,#4f7bff,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Payroll Platform
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#5a6280", lineHeight: 1.7, maxWidth: 300 }}>
            Complete payroll management with EPF, ETF & APIT compliance — built for Sri Lankan businesses.
          </p>

          {/* Feature list */}
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: "💳", label: "Automated Payroll Processing" },
              { icon: "🏛️", label: "EPF / ETF / APIT Compliance" },
              { icon: "👥", label: "Multi-Company BPO Support" },
              { icon: "📊", label: "Real-time Analytics & Reports" },
            ].map(f => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 34, height: 34, background: "rgba(79,123,255,0.1)", border: "1px solid rgba(79,123,255,0.2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                  {f.icon}
                </div>
                <span style={{ fontSize: 13, color: "#8b92b0", fontWeight: 500 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontSize: 11, color: "#2d3650", position: "relative" }}>
          © {new Date().getFullYear()} AbunthraHR · InTalent Asia (Pvt) Ltd · All rights reserved
        </p>
      </div>

      {/* ── RIGHT: Login Form ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>

        {/* Mobile logo */}
        <div className="login-mobile-logo" style={{ display: "none", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <img src="/logo-abunthrahr.svg" alt="AbunthraHR" style={{ width: 38, height: 38, objectFit: "contain" }} />
          <span style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf2" }}>Abunthra<span style={{ color: "#00aaff" }}>HR</span></span>
        </div>

        <div style={{ width: "100%", maxWidth: 420 }}>

          {/* ─── Credentials step ─── */}
          {step === "credentials" && (
            <div style={{ background: "#161922", border: "1px solid #2a3048", borderRadius: 16, padding: "36px 32px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e8eaf2", letterSpacing: -0.5, margin: 0 }}>Sign in</h1>
                <p style={{ fontSize: 13, color: "#5a6280", marginTop: 6 }}>Enter your credentials to access AbunthraHR</p>
              </div>

              <form onSubmit={handleCredentials} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Email */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#8b92b0", marginBottom: 6 }}>Email address</label>
                  <input
                    type="email" required autoFocus autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={inputStyle}
                    onFocus={e => e.target.style.boxShadow = "0 0 0 2px rgba(79,123,255,0.5)"}
                    onBlur={e => e.target.style.boxShadow = "none"}
                  />
                </div>

                {/* Password */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#8b92b0" }}>Password</label>
                    <a
                      href="/forgot-password"
                      style={{ fontSize: 12, color: "#4f7bff", textDecoration: "none", fontWeight: 500 }}
                      onMouseEnter={e => e.target.style.color = "#6b95ff"}
                      onMouseLeave={e => e.target.style.color = "#4f7bff"}
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"} required
                      autoComplete="current-password"
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={e => e.target.style.boxShadow = "0 0 0 2px rgba(79,123,255,0.5)"}
                      onBlur={e => e.target.style.boxShadow = "none"}
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#5a6280", padding: 0, display: "flex", alignItems: "center" }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                  <div onClick={() => setRememberMe(p => !p)} style={{
                    width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${rememberMe ? "#4f7bff" : "#3a4260"}`,
                    background: rememberMe ? "#4f7bff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s"
                  }}>
                    {rememberMe && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{ fontSize: 13, color: "#5a6280" }}>Remember me for 7 days</span>
                </label>

                {/* Error */}
                {error && <ErrorBanner message={error} />}

                {/* Submit */}
                <button type="submit" disabled={loading} style={submitBtnStyle(loading)}>
                  {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Signing in…</> : "Sign in"}
                </button>
              </form>

              {/* Create account link — inside card so always visible */}
              <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e2a3a" }}>
                <span style={{ fontSize: 13, color: "#3a4260" }}>Don't have an account? </span>
                <a href="/register" style={{ fontSize: 13, color: "#4f7bff", textDecoration: "none", fontWeight: 600 }}
                  onMouseEnter={e => e.target.style.color = "#6b95ff"}
                  onMouseLeave={e => e.target.style.color = "#4f7bff"}>
                  Create account
                </a>
              </div>
            </div>
          )}

          {/* ─── TOTP step ─── */}
          {step === "totp" && (
            <MfaCard
              title="Authenticator code"
              subtitle="Open your authenticator app and enter the 6-digit code."
              digits={digits} refs={digitRefs} code={code} loading={loading} error={error}
              onChange={handleDigitChange} onKeyDown={handleDigitKeyDown} onPaste={handleDigitPaste}
              onSubmit={handleMfa} onBack={() => { setStep("credentials"); setDigits(["","","","","",""]); setError(""); }}
            />
          )}

          {/* ─── Email OTP step ─── */}
          {step === "otp" && (
            <MfaCard
              title="Check your email"
              subtitle={<>We sent a 6-digit code to <strong style={{ color: "#e8eaf2" }}>{email}</strong>.</>}
              digits={digits} refs={digitRefs} code={code} loading={loading} error={error}
              onChange={handleDigitChange} onKeyDown={handleDigitKeyDown} onPaste={handleDigitPaste}
              onSubmit={handleMfa} onBack={() => { setStep("credentials"); setDigits(["","","","","",""]); setError(""); }}
              resend={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              onResend={handleResendOtp} resendDisabled={resendCooldown > 0}
            />
          )}

          <p style={{ textAlign: "center", fontSize: 11, color: "#2d3650", marginTop: 16 }}>
            AbunthraHR by InTalent Asia · v2.0
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .login-left-panel { display: none !important; }
          .login-mobile-logo { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Shared styles ── */
const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "#1e2230", border: "1px solid #2a3048", borderRadius: 8,
  color: "#e8eaf2", padding: "10px 14px", fontSize: 13,
  fontFamily: "inherit", outline: "none", transition: "box-shadow .15s",
};

function submitBtnStyle(loading) {
  return {
    width: "100%", background: loading ? "#3a5cc4" : "#4f7bff", color: "#fff",
    border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13, fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    transition: "background .15s", opacity: loading ? 0.7 : 1,
  };
}

function ErrorBanner({ message }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(232,66,90,0.1)", border: "1px solid rgba(232,66,90,0.35)", borderRadius: 8, padding: "11px 14px" }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(232,66,90,0.2)", color: "#e8425a", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>!</span>
      <p style={{ fontSize: 13, color: "#f87171", margin: 0, lineHeight: 1.5 }}>{message}</p>
    </div>
  );
}

function OtpBoxes({ digits, refs, onChange, onKeyDown, onPaste }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }} onPaste={onPaste}>
      {digits.map((d, i) => (
        <input key={i} ref={el => (refs.current[i] = el)}
          type="text" inputMode="numeric" maxLength={1} value={d} autoFocus={i === 0}
          onChange={e => onChange(i, e.target.value)} onKeyDown={e => onKeyDown(i, e)}
          style={{
            width: 48, height: 52, textAlign: "center", fontSize: 20, fontWeight: 700,
            background: d ? "#1e2a42" : "#1e2230", border: `1.5px solid ${d ? "#4f7bff" : "#2a3048"}`,
            borderRadius: 10, color: "#e8eaf2", outline: "none", fontFamily: "DM Mono,monospace",
            transition: "all .15s", boxShadow: d ? "0 0 0 1px rgba(79,123,255,0.3)" : "none",
          }}
        />
      ))}
    </div>
  );
}

function MfaCard({ title, subtitle, digits, refs, code, loading, error, onChange, onKeyDown, onPaste, onSubmit, onBack, resend, onResend, resendDisabled }) {
  return (
    <div style={{ background: "#161922", border: "1px solid #2a3048", borderRadius: 16, padding: "36px 32px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e8eaf2", margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 13, color: "#5a6280", marginTop: 6, lineHeight: 1.6 }}>{subtitle}</p>
      </div>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <OtpBoxes digits={digits} refs={refs} onChange={onChange} onKeyDown={onKeyDown} onPaste={onPaste} />
        {error && <ErrorBanner message={error} />}
        <button type="submit" disabled={loading || code.length < 6} style={submitBtnStyle(loading || code.length < 6)}>
          {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Verifying…</> : "Verify"}
        </button>
        {resend && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#3a4260" }}>Didn't receive it?</span>
            <button type="button" onClick={onResend} disabled={resendDisabled}
              style={{ fontSize: 12, color: resendDisabled ? "#3a4260" : "#4f7bff", background: "none", border: "none", cursor: resendDisabled ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              <RefreshCw size={12} />{resend}
            </button>
          </div>
        )}
        <button type="button" onClick={onBack}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#3a4260", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", padding: "4px 0" }}>
          <ArrowLeft size={13} /> Back to sign in
        </button>
      </form>
    </div>
  );
}
