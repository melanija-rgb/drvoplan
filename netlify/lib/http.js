export function json(status, body, extraHeaders = {}) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(JSON.stringify(body), { status, headers });
}

export function methodNotAllowed() {
  return json(405, { poruka: "Metoda nije dozvoljena." });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

export function htmlMessage(status, title, message) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const html = `<!DOCTYPE html>
<html lang="sr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${safeTitle}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #141210; color: #f4f0e8; font: 18px/1.5 "Segoe UI", sans-serif; }
      main { width: min(32rem, calc(100% - 2rem)); }
      a { color: #c4a27a; }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <p><a href="/">Nazad na sajt</a></p>
    </main>
  </body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export function wantsJson(request) {
  return (request.headers.get("accept") || "").includes("application/json");
}

export function respond(request, status, poruka, extraHeaders = {}) {
  if (wantsJson(request)) return json(status, { poruka }, extraHeaders);
  const title = status >= 400 ? "Upit nije poslat" : "Upit je poslat";
  return htmlMessage(status, title, poruka);
}

export async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const data = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return data;
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}
