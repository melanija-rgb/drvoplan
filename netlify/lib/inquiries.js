const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+().\-\s/]+$/;

export function parseInquiry(raw, now = new Date()) {
  const source = raw && typeof raw === "object" ? raw : {};
  const honeypot = String(source.website ?? "").trim();
  if (honeypot) return { ok: true, spam: true };

  const ime = String(source.ime ?? "").trim();
  const email = String(source.email ?? "").trim();
  const telefon = String(source.telefon ?? "").trim();
  const poruka = String(source.poruka ?? "").trim();

  if (ime.length < 2 || ime.length > 80) {
    return { ok: false, poruka: "Unesite ime (2–80 znakova)." };
  }
  if (email.length > 120 || !EMAIL.test(email)) {
    return { ok: false, poruka: "Unesite ispravnu email adresu." };
  }
  if (telefon && (telefon.length > 40 || !PHONE.test(telefon))) {
    return { ok: false, poruka: "Telefon nije ispravno unesen." };
  }
  if (poruka.length < 2 || poruka.length > 4000) {
    return { ok: false, poruka: "Poruka treba imati između 2 i 4000 znakova." };
  }

  return {
    ok: true,
    spam: false,
    inquiry: {
      id: crypto.randomUUID(),
      ime,
      email,
      telefon,
      poruka,
      createdAt: now.toISOString(),
      read: false,
    },
  };
}

export function sortNewest(items) {
  return [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
