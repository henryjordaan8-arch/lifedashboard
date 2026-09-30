import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { api, AUTH_EVENT } from "../api";

type State = "checking" | "login" | "in";

function LoginScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await api.login(password);
    setBusy(false);
    if (err) {
      setError(err);
      setPassword("");
    } else {
      onDone();
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <h1>Life Dashboard</h1>
        <p className="muted">Sign in to see your dashboard.</p>
        <label htmlFor="pw">Password</label>
        <input
          id="pw" type="password" autoComplete="current-password" autoFocus required
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

/** Shows the login screen when the hosted dashboard is password-protected. */
export function AuthGate({ children }: { children: (signOut: (() => void) | null) => ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const [required, setRequired] = useState(false);

  const check = useCallback(() => {
    api
      .session()
      .then((s) => {
        setRequired(s.auth_required);
        setState(!s.auth_required || s.logged_in ? "in" : "login");
      })
      .catch(() => setState("in")); // backend unreachable: let the app show its own error
  }, []);

  useEffect(() => {
    check();
    const onExpired = () => setState("login");
    window.addEventListener(AUTH_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EVENT, onExpired);
  }, [check]);

  const signOut = useCallback(() => {
    api.logout().finally(() => setState("login"));
  }, []);

  if (state === "checking") return null;
  if (state === "login") return <LoginScreen onDone={() => setState("in")} />;
  return <>{children(required ? signOut : null)}</>;
}
