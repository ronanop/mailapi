const selected = new Set();

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function $(id) {
  return document.getElementById(id);
}

function show(el, on) {
  el.classList.toggle("hidden", !on);
}

async function refreshStatus() {
  const status = await api("/api/auth/status");
  show($("loginCard"), !status.adminLoggedIn);
  show($("appPanel"), status.adminLoggedIn);

  if (!status.adminLoggedIn) return status;

  const pill = $("ownerStatus");
  const err = $("graphError");
  if (status.mailboxConnected) {
    pill.className = "pill ok";
    pill.textContent = `Connected: ${status.owner?.email || status.owner?.displayName || "mailbox"}`;
    err.classList.add("hidden");
    show($("mailboxPanel"), true);
    show($("apiKeysPanel"), true);
    show($("grantsPanel"), true);
  } else {
    pill.className = "pill";
    pill.textContent = "Graph mailbox not reachable";
    err.textContent = status.graphError || "Check Mail.Read application permission + admin consent";
    err.classList.remove("hidden");
    show($("mailboxPanel"), false);
    show($("apiKeysPanel"), false);
    show($("grantsPanel"), true);
  }
  return status;
}

function renderMails(messages) {
  const list = $("mailList");
  if (!messages.length) {
    list.innerHTML = `<p class="muted">No messages found.</p>`;
    return;
  }
  list.innerHTML = messages
    .map((m) => {
      const checked = selected.has(m.id) ? "checked" : "";
      const when = m.receivedDateTime ? new Date(m.receivedDateTime).toLocaleString() : "";
      return `
        <label class="mail-item">
          <input type="checkbox" data-id="${m.id}" ${checked} />
          <div>
            <strong>${escapeHtml(m.subject)}</strong>
            <div class="meta">${escapeHtml(m.from)}</div>
            <div class="meta">${escapeHtml(m.preview || "")}</div>
          </div>
          <div class="when">${escapeHtml(when)}</div>
        </label>`;
    })
    .join("");

  list.querySelectorAll("input[type=checkbox]").forEach((box) => {
    box.addEventListener("change", () => {
      const id = box.getAttribute("data-id");
      if (box.checked) selected.add(id);
      else selected.delete(id);
      $("grantMsg").textContent = `${selected.size} mail(s) selected`;
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadMessages(search = "") {
  const q = search ? `&search=${encodeURIComponent(search)}` : "";
  const data = await api(`/api/admin/messages?top=40${q}`);
  renderMails(data.messages || []);
}

async function loadApiKeys() {
  const data = await api("/api/admin/api-keys");
  const root = $("apiKeysList");
  if (!data.keys?.length) {
    root.innerHTML = `<p class="muted">No API keys yet. Create one for your other app.</p>`;
    return;
  }
  root.innerHTML = data.keys
    .map((k) => {
      const status = k.revoked
        ? "revoked"
        : k.expiresAt && new Date(k.expiresAt) < new Date()
          ? "expired"
          : "active";
      return `
        <div class="grant ${status !== "active" ? "revoked" : ""}">
          <div class="row" style="justify-content: space-between">
            <div>
              <strong>${escapeHtml(k.label)}</strong>
              <div class="muted">${status} · mailbox ${escapeHtml(data.mailbox || "")}</div>
            </div>
            ${
              status === "active"
                ? `<button class="danger" data-revoke-key="${k.id}">Revoke</button>`
                : ""
            }
          </div>
          <div class="token-box">${escapeHtml(k.key)}</div>
          <div class="muted" style="margin-top:8px">
            GET ${escapeHtml(data.apiBase)}/messages<br/>
            Authorization: Bearer ${escapeHtml(k.key)}
          </div>
        </div>`;
    })
    .join("");

  root.querySelectorAll("[data-revoke-key]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/api/admin/api-keys/${btn.getAttribute("data-revoke-key")}/revoke`, {
        method: "POST",
        body: "{}",
      });
      await loadApiKeys();
    });
  });
}

async function loadGrants() {
  const data = await api("/api/admin/grants");
  const root = $("grantsList");
  if (!data.grants?.length) {
    root.innerHTML = `<p class="muted">No grants yet.</p>`;
    return;
  }
  root.innerHTML = data.grants
    .map((g) => {
      const status = g.revoked
        ? "revoked"
        : g.expiresAt && new Date(g.expiresAt) < new Date()
          ? "expired"
          : "active";
      return `
        <div class="grant ${status !== "active" ? "revoked" : ""}">
          <div class="row" style="justify-content: space-between">
            <div>
              <strong>${escapeHtml(g.label)}</strong>
              <div class="muted">${g.messageIds.length} message(s) · ${status}</div>
            </div>
            ${
              status === "active"
                ? `<button class="danger" data-revoke="${g.id}">Revoke</button>`
                : ""
            }
          </div>
          <div class="token-box">Token: ${escapeHtml(g.token)}</div>
          <div class="token-box">Reader: ${escapeHtml(g.shareUrl)}</div>
          <div class="muted" style="margin-top:8px">
            API: Authorization: Bearer ${escapeHtml(g.token)} → GET /api/shared/messages
          </div>
        </div>`;
    })
    .join("");

  root.querySelectorAll("[data-revoke]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/api/admin/grants/${btn.getAttribute("data-revoke")}/revoke`, {
        method: "POST",
        body: "{}",
      });
      await loadGrants();
    });
  });
}

$("loginBtn").addEventListener("click", async () => {
  $("loginError").classList.add("hidden");
  try {
    await api("/api/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: $("adminPassword").value }),
    });
    const status = await refreshStatus();
    if (status.mailboxConnected) {
      await loadMessages();
      await loadApiKeys();
    }
    await loadGrants();
  } catch (err) {
    $("loginError").textContent = err.message;
    $("loginError").classList.remove("hidden");
  }
});

$("createApiKeyBtn").addEventListener("click", async () => {
  const label = $("apiKeyLabel").value.trim();
  if (!label) {
    $("apiKeyMsg").textContent = "Label is required";
    return;
  }
  try {
    const key = await api("/api/admin/api-keys", {
      method: "POST",
      body: JSON.stringify({ label }),
    });
    $("apiKeyMsg").className = "success";
    $("apiKeyMsg").textContent = `Created key for ${key.mailbox}. Copy it now from the list below.`;
    $("apiKeyLabel").value = "";
    await loadApiKeys();
  } catch (err) {
    $("apiKeyMsg").className = "error";
    $("apiKeyMsg").textContent = err.message;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await api("/api/auth/admin/logout", { method: "POST", body: "{}" });
  selected.clear();
  await refreshStatus();
});

$("refreshBtn").addEventListener("click", () => loadMessages());
$("searchBtn").addEventListener("click", () => loadMessages($("searchInput").value.trim()));
$("searchInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadMessages($("searchInput").value.trim());
});

$("createGrantBtn").addEventListener("click", async () => {
  const label = $("grantLabel").value.trim();
  if (!label) {
    $("grantMsg").textContent = "Label is required";
    return;
  }
  if (!selected.size) {
    $("grantMsg").textContent = "Select at least one mail";
    return;
  }
  const expiryLocal = $("grantExpiry").value;
  const body = {
    label,
    messageIds: [...selected],
    allowedReaderNote: $("grantNote").value.trim() || undefined,
    expiresAt: expiryLocal ? new Date(expiryLocal).toISOString() : null,
  };
  try {
    const grant = await api("/api/admin/grants", {
      method: "POST",
      body: JSON.stringify(body),
    });
    $("grantMsg").className = "success";
    $("grantMsg").textContent = `Created. Share: ${grant.shareUrl}`;
    selected.clear();
    $("grantLabel").value = "";
    $("grantNote").value = "";
    $("grantExpiry").value = "";
    await loadMessages($("searchInput").value.trim());
    await loadGrants();
  } catch (err) {
    $("grantMsg").className = "error";
    $("grantMsg").textContent = err.message;
  }
});

(async function boot() {
  try {
    const status = await refreshStatus();
    if (status.adminLoggedIn) {
      if (status.mailboxConnected) {
        await loadMessages();
        await loadApiKeys();
      }
      await loadGrants();
    }
  } catch (err) {
    console.error(err);
  }
})();
