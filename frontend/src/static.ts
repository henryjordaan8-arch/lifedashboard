/**
 * Static (GitHub Pages) mode: instead of calling the backend, the dashboard
 * downloads one encrypted snapshot (data.enc, rebuilt hourly by GitHub Actions),
 * decrypts it in the browser with your password, and answers API requests from it.
 */
import type { Activity, DayPlan, Week } from "./types";

export const STATIC = import.meta.env.VITE_STATIC === "1";

interface EncryptedDoc {
  v: number;
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

interface Bundle {
  generated_at: string;
  today: string;
  responses: Record<string, unknown>;
  days: Record<string, DayPlan>;
  weeks: Record<string, Week>;
  activities: Activity[];
}

const STORE_KEY = "lifedashboard:key";
let bundle: Bundle | null = null;
let key: CryptoKey | null = null;

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function fetchDoc(): Promise<EncryptedDoc> {
  const res = await fetch(`${import.meta.env.BASE_URL}data.enc?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`No dashboard data published yet (${res.status})`);
  return res.json();
}

async function deriveKey(password: string, doc: EncryptedDoc): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: b64(doc.salt), iterations: doc.iterations },
    base,
    { name: "AES-GCM", length: 256 },
    true, // extractable, so "remember this device" can store it
    ["decrypt"],
  );
}

async function open(doc: EncryptedDoc, k: CryptoKey): Promise<Bundle> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(doc.iv) }, k, b64(doc.data));
  const json = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(json);
}

/** Try the password; returns an error message or null. */
export async function unlock(password: string, remember = true): Promise<string | null> {
  let doc: EncryptedDoc;
  try {
    doc = await fetchDoc();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  try {
    const k = await deriveKey(password, doc);
    bundle = await open(doc, k);
    key = k;
    if (remember) {
      try {
        localStorage.setItem(STORE_KEY, toB64(await crypto.subtle.exportKey("raw", k)));
      } catch {
        /* private mode: just don't remember */
      }
    }
    return null;
  } catch {
    return "Wrong password";
  }
}

/** Sign in silently with a key this device remembered. */
export async function resume(): Promise<boolean> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  try {
    const k = await crypto.subtle.importKey("raw", b64(raw), "AES-GCM", true, ["decrypt"]);
    bundle = await open(await fetchDoc(), k);
    key = k;
    return true;
  } catch {
    forget(); // password changed since: ask again
    return false;
  }
}

export function forget() {
  bundle = null;
  key = null;
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

/** Fetch the latest hourly snapshot ("Sync now" in static mode). */
async function refresh() {
  if (key) bundle = await open(await fetchDoc(), key);
}

export const isUnlocked = () => bundle != null;

const emptyDay = (date: string): DayPlan => ({
  date,
  configured: true,
  events: [],
  hours: { training: 0, work: 0, study: 0, reading: 0, personal: 0, other: 0 },
  unplanned_activities: [],
});

/** Answer an API request from the snapshot. */
export async function staticGet(path: string, init?: RequestInit): Promise<unknown> {
  const url = new URL(path, "http://x");
  const q = url.searchParams;
  if (url.pathname === "/api/session") return { auth_required: true, logged_in: isUnlocked() };
  if (url.pathname === "/api/logout") {
    forget();
    return { logged_in: false };
  }
  if (!bundle) throw new Error("Please sign in");

  switch (url.pathname) {
    case "/api/sync":
      await refresh();
      return bundle.responses["/api/status"];
    case "/api/activities": {
      const start = q.get("start") ?? "";
      const end = q.get("end") ?? "";
      return { activities: bundle.activities.filter((a) => a.date >= start && a.date <= end) };
    }
    case "/api/day": {
      const d = q.get("date") ?? bundle.today;
      return bundle.days[d] ?? emptyDay(d);
    }
    case "/api/week": {
      const d = q.get("date") ?? bundle.today;
      const weeks = Object.values(bundle.weeks);
      return weeks.find((w) => w.week_start <= d && d <= w.week_end) ?? weeks[0];
    }
    case "/api/week/manual": {
      // Read-only snapshot: ticks can't be saved, so return the week unchanged.
      const body = JSON.parse(String(init?.body ?? "{}"));
      return bundle.weeks[body.week_start] ?? Object.values(bundle.weeks)[0];
    }
  }
  if (path in bundle.responses) return bundle.responses[path];
  throw new Error(`Not available in the published snapshot: ${url.pathname}`);
}
