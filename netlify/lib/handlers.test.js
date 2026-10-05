import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { adminInquiries, adminLogin, adminLogout, submitInquiry } from "./handlers.js";
import { createMemoryStore } from "./store.js";
import { COOKIE, readSession, resetLimits, signSession } from "./session.js";

const PASSWORD = "tajna-lozinka";
const SECRET = "tajna-sesija";

beforeEach(() => {
  process.env.ADMIN_PASSWORD = PASSWORD;
  process.env.ADMIN_SESSION_SECRET = SECRET;
  process.env.INQUIRY_FAST_LIMIT = "1";
  resetLimits();
});

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
  resetLimits();
});

function inquiryRequest(fields, { jsonBody = true } = {}) {
  if (!jsonBody) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return new Request("http://127.0.0.1/api/upit", { method: "POST", body });
  }
  return new Request("http://127.0.0.1/api/upit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(fields),
  });
}

const valid = {
  ime: "Ana Anić",
  email: "ana@example.com",
  telefon: "+387 61 123 456",
  poruka: "Zanima me DP A-frame 45.",
};

test("čuva upit i honeypot ne upisuje ništa", async () => {
  const store = createMemoryStore();
  const ok = await submitInquiry(inquiryRequest(valid), { store, now: () => new Date("2026-10-05T12:00:00.000Z") });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).poruka, "Hvala. Upit je poslat.");
  assert.equal((await store.list()).length, 1);
  const saved = (await store.list())[0];
  assert.equal(saved.ime, valid.ime);
  assert.equal(saved.telefon, valid.telefon);
  assert.equal(saved.read, false);
  assert.equal(saved.createdAt, "2026-10-05T12:00:00.000Z");

  const spam = await submitInquiry(inquiryRequest({ ...valid, website: "http://spam.test" }), { store });
  assert.equal(spam.status, 200);
  assert.equal((await store.list()).length, 1);
});

test("odbija neispravan email", async () => {
  const store = createMemoryStore();
  const response = await submitInquiry(
    inquiryRequest({ ...valid, email: "nije-email" }),
    { store },
  );
  assert.equal(response.status, 400);
  assert.equal((await store.list()).length, 0);
});

test("pogrešna lozinka vraća 401, ispravna postavlja kolačić i lista prolazi", async () => {
  const store = createMemoryStore();
  await submitInquiry(inquiryRequest(valid, { jsonBody: false }), {
    store,
    now: () => new Date("2026-10-05T10:00:00.000Z"),
  });
  await submitInquiry(inquiryRequest({ ...valid, ime: "Marko", poruka: "Noviji upit." }), {
    store,
    now: () => new Date("2026-10-05T15:00:00.000Z"),
  });

  const wrong = await adminLogin(new Request("https://drvoplan.netlify.app/api/admin/prijava", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ lozinka: "pogresno" }),
  }));
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get("set-cookie"), null);

  const right = await adminLogin(new Request("https://drvoplan.netlify.app/api/admin/prijava", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ lozinka: PASSWORD }),
  }));
  assert.equal(right.status, 200);
  const cookie = right.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  const token = cookie.slice(COOKIE.length + 1).split(";")[0];
  assert.ok(readSession(token, SECRET));

  const local = await adminLogin(new Request("http://127.0.0.1/api/admin/prijava", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lozinka: PASSWORD }),
  }));
  assert.doesNotMatch(local.headers.get("set-cookie"), /Secure/);

  const anonymous = await adminInquiries(new Request("https://drvoplan.netlify.app/api/admin/upiti"));
  assert.equal(anonymous.status, 401);

  const list = await adminInquiries(new Request("https://drvoplan.netlify.app/api/admin/upiti", {
    headers: { cookie: `${COOKIE}=${token}` },
  }), { store });
  assert.equal(list.status, 200);
  const body = await list.json();
  assert.equal(body.neprocitano, 2);
  assert.equal(body.upiti[0].ime, "Marko");
  assert.equal(body.upiti[1].ime, "Ana Anić");

  const id = body.upiti[0].id;
  const marked = await adminInquiries(new Request(`https://drvoplan.netlify.app/api/admin/upiti/${id}?id=${id}`, {
    method: "PATCH",
    headers: { cookie: `${COOKIE}=${token}` },
  }), { store });
  assert.equal(marked.status, 200);
  assert.equal((await marked.json()).upit.read, true);

  const afterRead = await adminInquiries(new Request("https://drvoplan.netlify.app/api/admin/upiti", {
    headers: { cookie: `${COOKIE}=${token}` },
  }), { store });
  assert.equal((await afterRead.json()).neprocitano, 1);

  const removed = await adminInquiries(new Request(`https://drvoplan.netlify.app/api/admin/upiti/${id}?id=${id}`, {
    method: "DELETE",
    headers: { cookie: `${COOKIE}=${token}` },
  }), { store });
  assert.equal(removed.status, 200);
  assert.equal((await store.list()).length, 1);

  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  const denied = await adminInquiries(new Request("https://drvoplan.netlify.app/api/admin/upiti", {
    headers: { cookie: `${COOKIE}=${tampered}` },
  }), { store });
  assert.equal(denied.status, 401);

  const expired = signSession(SECRET, Date.now() - 8 * 24 * 60 * 60 * 1000);
  const stale = await adminInquiries(new Request("https://drvoplan.netlify.app/api/admin/upiti", {
    headers: { cookie: `${COOKIE}=${expired}` },
  }), { store });
  assert.equal(stale.status, 401);
});

test("odjava briše kolačić", async () => {
  const response = await adminLogout(new Request("https://drvoplan.netlify.app/api/admin/odjava", { method: "POST" }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});

test("previše pogrešnih prijava vraća 429", async () => {
  for (let i = 0; i < 8; i += 1) {
    const response = await adminLogin(new Request("https://drvoplan.netlify.app/api/admin/prijava", {
      method: "POST",
      headers: { "content-type": "application/json", "x-nf-client-connection-ip": "203.0.113.10" },
      body: JSON.stringify({ lozinka: "ne" }),
    }));
    assert.equal(response.status, 401);
  }
  const blocked = await adminLogin(new Request("https://drvoplan.netlify.app/api/admin/prijava", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nf-client-connection-ip": "203.0.113.10" },
    body: JSON.stringify({ lozinka: PASSWORD }),
  }));
  assert.equal(blocked.status, 429);
});
