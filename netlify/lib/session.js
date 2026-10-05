import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "dp_sesija";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEK_SEC = 7 * 24 * 60 * 60;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 8;

const failures = new Map();

export function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

export function safeEqual(left, right) {
  const a = createHash("sha256").update(String(left)).digest();
  const b = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(a, b);
}

export function signSession(secret, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ exp: now + WEEK_MS })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(token, secret, now = Date.now()) {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function cookieDevMode(request) {
  if (process.env.CONTEXT === "dev" || process.env.NETLIFY_DEV === "true") return true;
  try {
    const host = new URL(request.url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function sessionCookie(token, dev) {
  const secure = dev ? "" : "; Secure";
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${WEEK_SEC}${secure}`;
}

export function clearCookie(dev) {
  const secure = dev ? "" : "; Secure";
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(/; */)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return "";
}

export function adminFromRequest(request, now = Date.now()) {
  const secret = sessionSecret();
  if (!secret) return null;
  return readSession(readCookie(request, COOKIE), secret, now);
}

export function clientIp(request) {
  return (
    request.headers.get("x-nf-client-connection-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || "local"
  );
}

export function resetLimits() {
  failures.clear();
}

export function loginAllowed(ip, now = Date.now()) {
  const rec = failures.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) return true;
  return rec.count < MAX_FAILURES;
}

export async function noteLoginFailure(ip, now = Date.now()) {
  const rec = failures.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) failures.set(ip, { count: 1, start: now });
  else rec.count += 1;
  const count = failures.get(ip).count;
  const wait = process.env.INQUIRY_FAST_LIMIT === "1" ? 0 : Math.min(300 * count, 1500);
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

export function clearLoginFailures(ip) {
  failures.delete(ip);
}
