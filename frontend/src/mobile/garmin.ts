/**
 * Garmin Connect sign-in and API calls from the phone, the same way
 * python-garminconnect does it (see backend: garminconnect/client.py):
 *
 *   1. POST email + password to Garmin's mobile SSO → a one-time "service ticket"
 *      (or a two-factor challenge first, answered with the code Garmin sends you)
 *   2. swap the ticket for an access token + refresh token (diauth.garmin.com)
 *   3. call connectapi.garmin.com with the access token, refreshing it when it expires
 *
 * Requests go through Capacitor's native HTTP, so the browser's CORS rules don't apply.
 * Only the tokens are saved on the phone; the password is never stored.
 */
import { CapacitorHttp, type HttpResponse } from "@capacitor/core";

const SSO = "https://sso.garmin.com";
const API = "https://connectapi.garmin.com";
const SSO_CLIENT_ID = "GCM_IOS_DARK";
const SERVICE_URL = "https://mobile.integration.garmin.com/gcm/ios";
const LOGIN_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const DI_TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const DI_GRANT_TYPE = "https://connectapi.garmin.com/di-oauth2-service/oauth/grant/service_ticket";
const DI_CLIENT_IDS = [
  "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2",
  "GARMIN_CONNECT_MOBILE_ANDROID_DI_2024Q4",
  "GARMIN_CONNECT_MOBILE_ANDROID_DI",
  "GARMIN_CONNECT_MOBILE_IOS_DI",
];
const NATIVE_HEADERS = {
  "User-Agent": "GCM-Android-5.23",
  "X-Garmin-User-Agent": "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
  "X-Garmin-Paired-App-Version": "10861",
  "X-Garmin-Client-Platform": "Android",
  "X-App-Ver": "10861",
  "X-Lang": "en",
  "X-GCExperience": "GC5",
  "Accept-Language": "en-US,en;q=0.9",
};
const LOGIN_PARAMS = { clientId: SSO_CLIENT_ID, locale: "en-US", service: SERVICE_URL };
const LOGIN_HEADERS = {
  "User-Agent": LOGIN_UA,
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  Origin: SSO,
};
const TOKENS_KEY = "ld.garmin.tokens";

interface Tokens {
  access: string;
  refresh: string | null;
  clientId: string;
}

/** The saved login has expired or been revoked: sign in again. */
export class SignInNeeded extends Error {}

function load(): Tokens | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "null");
    return t?.access ? t : null;
  } catch {
    return null;
  }
}
let tokens: Tokens | null = load();
function save(t: Tokens | null) {
  tokens = t;
  if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
  else localStorage.removeItem(TOKENS_KEY);
}

export const isSignedIn = () => tokens != null;
export const signOut = () => save(null);

function jwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part + "=".repeat((4 - (part.length % 4)) % 4)));
  } catch {
    return {};
  }
}

function json(res: HttpResponse): Record<string, any> | null {
  if (res.data && typeof res.data === "object") return res.data;
  try {
    return JSON.parse(res.data);
  } catch {
    return null;
  }
}

function tooMany(res: HttpResponse, body: Record<string, any> | null) {
  return res.status === 429 || body?.error?.["status-code"] === "429";
}

const RATE_LIMITED =
  "Garmin is limiting sign-ins from this network right now. Wait 15–30 minutes (or switch between Wi-Fi and mobile data) and try again.";

/** Step 2: exchange the SSO ticket for tokens. */
async function exchangeTicket(ticket: string): Promise<void> {
  for (const clientId of DI_CLIENT_IDS) {
    const res = await CapacitorHttp.post({
      url: DI_TOKEN_URL,
      headers: {
        ...NATIVE_HEADERS,
        Authorization: `Basic ${btoa(`${clientId}:`)}`,
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      data: { client_id: clientId, service_ticket: ticket, grant_type: DI_GRANT_TYPE, service_url: SERVICE_URL },
    });
    if (res.status === 429) throw new Error(RATE_LIMITED);
    const body = res.status < 400 ? json(res) : null;
    if (body?.access_token) {
      save({
        access: body.access_token,
        refresh: body.refresh_token ?? null,
        clientId: String(jwtPayload(body.access_token).client_id ?? clientId),
      });
      return;
    }
  }
  throw new Error("Garmin accepted your password but wouldn't issue a login token. Try again in a few minutes.");
}

async function finishSso(res: HttpResponse): Promise<"ok" | "mfa"> {
  const body = json(res);
  if (tooMany(res, body)) throw new Error(RATE_LIMITED);
  if (!body) throw new Error(`Garmin sign-in failed (HTTP ${res.status}). Try again in a few minutes.`);
  const type = body.responseStatus?.type;
  if (type === "MFA_REQUIRED") {
    mfaMethod = body.customerMfaInfo?.mfaLastMethodUsed ?? "email";
    return "mfa";
  }
  if (type === "SUCCESSFUL" && body.serviceTicketId) {
    await exchangeTicket(body.serviceTicketId);
    return "ok";
  }
  if (type === "INVALID_USERNAME_PASSWORD") throw new Error("Wrong email or password.");
  throw new Error(`Garmin sign-in failed: ${type ?? `HTTP ${res.status}`}`);
}

let mfaMethod = "email";

/** Step 1. Resolves "mfa" when Garmin wants a two-factor code: call verifyCode next. */
export async function signIn(email: string, password: string): Promise<"ok" | "mfa"> {
  const res = await CapacitorHttp.post({
    url: `${SSO}/mobile/api/login`,
    params: LOGIN_PARAMS,
    headers: LOGIN_HEADERS,
    data: { username: email, password, rememberMe: true, captchaToken: "" },
  });
  return finishSso(res);
}

/** Two-factor code from Garmin's email or text. Uses the cookies of the signIn call. */
export async function verifyCode(code: string): Promise<void> {
  const res = await CapacitorHttp.post({
    url: `${SSO}/mobile/api/mfa/verifyCode`,
    params: LOGIN_PARAMS,
    headers: LOGIN_HEADERS,
    data: { mfaMethod, mfaVerificationCode: code.trim(), rememberMyBrowser: true, reconsentList: [], mfaSetup: false },
  });
  if ((await finishSso(res)) === "mfa") throw new Error("That code didn't work. Check it and try again.");
}

async function refresh(): Promise<void> {
  if (!tokens?.refresh) throw new SignInNeeded("Garmin login expired");
  const res = await CapacitorHttp.post({
    url: DI_TOKEN_URL,
    headers: {
      ...NATIVE_HEADERS,
      Authorization: `Basic ${btoa(`${tokens.clientId}:`)}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    data: { grant_type: "refresh_token", client_id: tokens.clientId, refresh_token: tokens.refresh },
  });
  const body = res.status < 400 ? json(res) : null;
  if (!body?.access_token) {
    if (res.status === 400 || res.status === 401) {
      save(null);
      throw new SignInNeeded("Garmin login expired");
    }
    throw new Error(`Couldn't refresh the Garmin login (HTTP ${res.status})`);
  }
  save({
    access: body.access_token,
    refresh: body.refresh_token ?? tokens.refresh,
    clientId: String(jwtPayload(body.access_token).client_id ?? tokens.clientId),
  });
}

const expiresSoon = (t: Tokens) => {
  const exp = Number(jwtPayload(t.access).exp);
  return Number.isFinite(exp) && Date.now() / 1000 > exp - 900;
};

/** GET a Garmin Connect API path (e.g. "/activitylist-service/..."), refreshing the login as needed. */
export async function garminGet<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
  if (!tokens) throw new SignInNeeded("Not signed in to Garmin");
  if (expiresSoon(tokens)) await refresh();
  const call = () =>
    CapacitorHttp.get({
      url: `${API}${path}`,
      params,
      headers: { ...NATIVE_HEADERS, Authorization: `Bearer ${tokens!.access}`, Accept: "application/json" },
      readTimeout: 30000,
    });
  let res = await call();
  if (res.status === 401) {
    await refresh();
    res = await call();
  }
  if (res.status === 204) return null as T;
  if (res.status === 429) throw new Error("Garmin is rate limiting requests; try again in a few minutes.");
  if (res.status >= 400) throw new Error(`Garmin API error ${res.status} for ${path}`);
  return json(res) as T;
}
