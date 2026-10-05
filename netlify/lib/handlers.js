import { parseInquiry, sortNewest } from "./inquiries.js";
import { inquiryStore } from "./store.js";
import { json, methodNotAllowed, readBody, respond } from "./http.js";
import {
  adminFromRequest,
  clearCookie,
  clearLoginFailures,
  clientIp,
  cookieDevMode,
  loginAllowed,
  noteLoginFailure,
  safeEqual,
  sessionCookie,
  sessionSecret,
  signSession,
} from "./session.js";

async function useStore(deps) {
  return deps.store || inquiryStore();
}

export async function submitInquiry(request, deps = {}) {
  if (request.method !== "POST") return methodNotAllowed();

  let raw;
  try {
    raw = await readBody(request);
  } catch {
    return respond(request, 400, "Podaci nisu ispravni.");
  }

  const parsed = parseInquiry(raw, deps.now?.() || new Date());
  if (!parsed.ok) return respond(request, 400, parsed.poruka);
  if (!parsed.spam) {
    const store = await useStore(deps);
    await store.setJSON(parsed.inquiry.id, parsed.inquiry);
  }
  return respond(request, 200, "Hvala. Upit je poslat.");
}

export async function adminLogin(request) {
  if (request.method !== "POST") return methodNotAllowed();

  const password = process.env.ADMIN_PASSWORD || "";
  const secret = sessionSecret();
  if (!password || !secret) return json(500, { poruka: "Prijava nije podešena." });

  const ip = clientIp(request);
  if (!loginAllowed(ip)) {
    return json(429, { poruka: "Previše pokušaja. Sačekajte pa pokušajte ponovo." });
  }

  let raw = {};
  try {
    raw = await readBody(request);
  } catch {
    raw = {};
  }

  if (!safeEqual(String(raw.lozinka ?? ""), password)) {
    await noteLoginFailure(ip);
    return json(401, { poruka: "Pogrešna lozinka." });
  }

  clearLoginFailures(ip);
  const token = signSession(secret);
  return json(200, { poruka: "Prijavljeni ste." }, {
    "set-cookie": sessionCookie(token, cookieDevMode(request)),
  });
}

export async function adminLogout(request) {
  if (request.method !== "POST") return methodNotAllowed();
  return json(200, { poruka: "Odjavljeni ste." }, {
    "set-cookie": clearCookie(cookieDevMode(request)),
  });
}

function inquiryId(request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("id");
  if (fromQuery) return fromQuery;
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.lastIndexOf("upiti");
  if (index >= 0 && parts[index + 1]) return decodeURIComponent(parts[index + 1]);
  return "";
}

export async function adminInquiries(request, deps = {}) {
  if (!adminFromRequest(request)) return json(401, { poruka: "Potrebna je prijava." });

  const store = await useStore(deps);
  const id = inquiryId(request);

  if (request.method === "GET" && !id) {
    const upiti = sortNewest(await store.list());
    return json(200, {
      neprocitano: upiti.filter((item) => !item.read).length,
      upiti,
    });
  }

  if (!id) return methodNotAllowed();

  if (request.method === "PATCH") {
    const current = await store.get(id);
    if (!current) return json(404, { poruka: "Upit nije pronađen." });
    current.read = true;
    await store.setJSON(id, current);
    return json(200, { upit: current });
  }

  if (request.method === "DELETE") {
    const current = await store.get(id);
    if (!current) return json(404, { poruka: "Upit nije pronađen." });
    await store.delete(id);
    return json(200, { poruka: "Upit je obrisan." });
  }

  return methodNotAllowed();
}
