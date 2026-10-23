import { type FormEvent, useCallback, useEffect, useState } from "react";
import { SportView } from "../components/SportView";
import { ago } from "../format";
import { clearData, hasData, HISTORY_DAYS, lastSync, sync } from "./data";
import { isSignedIn, signIn, SignInNeeded, signOut, verifyCode } from "./garmin";

const TABS = [
  { id: "run", label: "Running" },
  { id: "ride", label: "Cycling" },
  { id: "swim", label: "Swimming" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const tabFromHash = (): Tab => TABS.find((t) => `#/${t.id}` === window.location.hash)?.id ?? "run";
const SYNC_EVERY_MS = 60 * 60 * 1000;

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

/** The Android app: the three sport dashboards, fed straight from Garmin. */
export function MobileApp() {
  const [signedIn, setSignedIn] = useState(isSignedIn);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await sync();
    } catch (e) {
      if (e instanceof SignInNeeded) setSignedIn(false);
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
      setRefreshKey((k) => k + 1);
    }
  }, []);

  // Sync on opening the app (and when it comes back to the front) if the data is over an hour old.
  useEffect(() => {
    if (!signedIn) return;
    const maybe = () => {
      const last = lastSync();
      if (!last || Date.now() - new Date(last).getTime() > SYNC_EVERY_MS) syncNow();
    };
    maybe();
    const onVisible = () => document.visibilityState === "visible" && maybe();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [signedIn, syncNow]);

  if (!signedIn) return <GarminLogin onDone={() => setSignedIn(true)} />;

  const leave = () => {
    signOut();
    clearData();
    setSignedIn(false);
  };

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>Training</h1>
          <div className="date">Your last 12 months on Garmin</div>
        </div>
        <nav className="tabs" aria-label="Views">
          {TABS.map((t) => (
            <a key={t.id} href={`#/${t.id}`} className={tab === t.id ? "on" : ""} aria-current={tab === t.id ? "page" : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
        <div className="sync">
          <span className={error ? "pill err" : "pill"} title={error ?? undefined}>
            <span className="dot" />
            {error ? "Sync failed" : syncing ? "Syncing…" : `Garmin · synced ${ago(lastSync())}`}
          </span>
          <button className="btn" onClick={syncNow} disabled={syncing}>{syncing ? "Syncing…" : "Sync now"}</button>
          <button className="btn ghost" onClick={leave} title="Sign out and remove your data from this phone">Sign out</button>
        </div>
      </header>

      {error && (
        <div className="card" style={{ marginBottom: 20, fontSize: 13 }}>
          <b>Garmin sync error:</b> <span className="ink2">{error}</span>
        </div>
      )}
      {!hasData() && syncing ? (
        <div className="card empty">Downloading your last year of Garmin activities. This takes a minute the first time…</div>
      ) : (
        <SportView sport={tab} refreshKey={refreshKey} maxDays={HISTORY_DAYS} />
      )}
    </div>
  );
}
