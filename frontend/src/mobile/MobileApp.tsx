import { type FormEvent, useEffect, useState } from "react";
import { AUTH_EVENT } from "../api";
import { App } from "../App";
import { clearData } from "./data";
import { isSignedIn, signIn, signOut, verifyCode } from "./garmin";

function GarminLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "code">("password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === "password") {
        if ((await signIn(email.trim(), password)) === "mfa") {
          setStep("code");
          return;
        }
      } else {
        await verifyCode(code);
      }
      setPassword("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <h1>Life Dashboard</h1>
        {step === "password" ? (
          <>
            <p className="muted">Sign in with your Garmin Connect account. Only a login token is kept on this phone, never your password.</p>
            <label htmlFor="email">Garmin email</label>
            <input id="email" type="email" autoComplete="username" autoFocus required value={email}
              onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </>
        ) : (
          <>
            <p className="muted">Garmin sent you a security code (email or text). Enter it here.</p>
            <label htmlFor="code">Security code</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required value={code}
              onChange={(e) => setCode(e.target.value)} />
          </>
        )}
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : step === "password" ? "Sign in" : "Verify"}
        </button>
        {step === "code" && (
          <button type="button" className="btn ghost" onClick={() => (setStep("password"), setCode(""), setError(null))}>
            Back
          </button>
        )}
      </form>
    </div>
  );
}

/** The Android app: Garmin sign-in, then the dashboard fed from the phone (see local.ts). */
export function MobileApp() {
  const [signedIn, setSignedIn] = useState(isSignedIn);

  useEffect(() => {
    const expired = () => setSignedIn(false);
    window.addEventListener(AUTH_EVENT, expired);
    return () => window.removeEventListener(AUTH_EVENT, expired);
  }, []);

  if (!signedIn) return <GarminLogin onDone={() => setSignedIn(true)} />;
  return (
    <App
      onSignOut={() => {
        signOut();
        clearData();
        setSignedIn(false);
      }}
    />
  );
}
