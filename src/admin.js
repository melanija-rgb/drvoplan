const loginView = document.querySelector("#prijava");
const listView = document.querySelector("#lista");
const loginForm = document.querySelector("#prijava-forma");
const loginStatus = document.querySelector("#prijava-status");
const listStatus = document.querySelector("#lista-status");
const count = document.querySelector("#broj");
const list = document.querySelector("#upiti");
const logout = document.querySelector("#odjava");

function when(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sr-Latn", {
    timeZone: "Europe/Sarajevo",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function showLogin() {
  loginView.hidden = false;
  listView.hidden = true;
  logout.hidden = true;
}

function showList() {
  loginView.hidden = true;
  listView.hidden = false;
  logout.hidden = false;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function render(data) {
  count.textContent = `Nepročitano: ${data.neprocitano ?? 0}`;
  list.replaceChildren();
  if (!data.upiti?.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Nema pristiglih upita.";
    list.append(empty);
    return;
  }

  for (const item of data.upiti) {
    const card = document.createElement("article");
    card.className = item.read ? "card" : "card is-new";

    const head = document.createElement("header");
    const time = document.createElement("p");
    time.className = "when";
    time.textContent = when(item.createdAt);
    const badge = document.createElement("p");
    badge.className = "badge";
    badge.textContent = item.read ? "Pročitano" : "Novo";
    head.append(time, badge);

    const name = document.createElement("p");
    name.className = "who";
    name.textContent = item.ime || "";

    const mail = document.createElement("a");
    mail.href = `mailto:${item.email || ""}`;
    mail.textContent = item.email || "";

    const phone = document.createElement("p");
    phone.textContent = item.telefon ? item.telefon : "Telefon nije ostavljen";

    const message = document.createElement("p");
    message.className = "msg";
    message.textContent = item.poruka || "";

    const actions = document.createElement("div");
    actions.className = "actions";

    if (!item.read) {
      const readBtn = document.createElement("button");
      readBtn.className = "btn";
      readBtn.type = "button";
      readBtn.textContent = "Označi kao pročitano";
      readBtn.addEventListener("click", () => markRead(item.id));
      actions.append(readBtn);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ghost";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Obriši";
    deleteBtn.addEventListener("click", () => askDelete(actions, item.id));
    actions.append(deleteBtn);

    card.append(head, name, mail, phone, message, actions);
    list.append(card);
  }
}

function askDelete(actions, id) {
  const confirm = document.createElement("div");
  confirm.className = "confirm";
  const yes = document.createElement("button");
  yes.className = "btn";
  yes.type = "button";
  yes.textContent = "Da, obriši";
  const no = document.createElement("button");
  no.className = "ghost";
  no.type = "button";
  no.textContent = "Odustani";
  yes.addEventListener("click", () => remove(id));
  no.addEventListener("click", () => confirm.remove());
  confirm.append(yes, no);
  actions.after(confirm);
}

async function load() {
  listStatus.textContent = "";
  const response = await fetch("/api/admin/upiti", { headers: { accept: "application/json" } });
  if (response.status === 401) {
    showLogin();
    return;
  }
  const data = await readJson(response);
  if (!response.ok) {
    showLogin();
    loginStatus.textContent = data.poruka || "Upiti nisu učitani.";
    return;
  }
  showList();
  render(data);
}

async function markRead(id) {
  const response = await fetch(`/api/admin/upiti/${encodeURIComponent(id)}?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { accept: "application/json" },
  });
  if (response.status === 401) return showLogin();
  if (!response.ok) {
    listStatus.textContent = "Status nije sačuvan.";
    return;
  }
  await load();
}

async function remove(id) {
  const response = await fetch(`/api/admin/upiti/${encodeURIComponent(id)}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { accept: "application/json" },
  });
  if (response.status === 401) return showLogin();
  if (!response.ok) {
    listStatus.textContent = "Upit nije obrisan.";
    return;
  }
  await load();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "Provjeravam…";
  const response = await fetch("/api/admin/prijava", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ lozinka: new FormData(loginForm).get("lozinka") }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    loginStatus.textContent = data.poruka || "Prijava nije uspjela.";
    return;
  }
  loginForm.reset();
  loginStatus.textContent = "";
  await load();
});

logout.addEventListener("click", async () => {
  await fetch("/api/admin/odjava", { method: "POST", headers: { accept: "application/json" } });
  list.replaceChildren();
  showLogin();
});

load().catch(() => {
  showLogin();
  loginStatus.textContent = "Prijava trenutno nije dostupna.";
});
