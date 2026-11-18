function $(id) {
  return document.getElementById(id);
}

function show(el, on) {
  el.classList.toggle("hidden", !on);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("token") || "";
}

function currentToken() {
  return $("tokenInput").value.trim();
}

async function sharedApi(path) {
  const token = currentToken();
  const res = await fetch(`/api/shared${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function openShared() {
  $("tokenError").classList.add("hidden");
  try {
    const me = await sharedApi("/me");
    $("grantInfo").textContent = `${me.label} · ${me.messageCount} message(s)${
      me.note ? ` · ${me.note}` : ""
    }${me.expiresAt ? ` · expires ${new Date(me.expiresAt).toLocaleString()}` : ""}`;

    const { messages } = await sharedApi("/messages");
    show($("listCard"), true);
    show($("detailCard"), false);

    const list = $("mailList");
    list.innerHTML = messages
      .map(
        (m) => `
        <button class="mail-item" data-id="${escapeHtml(m.id)}" style="width:100%; text-align:left; background:inherit; color:inherit; font-weight:inherit">
          <span></span>
          <div>
            <strong>${escapeHtml(m.subject)}</strong>
            <div class="meta">${escapeHtml(m.from)}</div>
            <div class="meta">${escapeHtml(m.preview || "")}</div>
          </div>
          <div class="when">${m.receivedDateTime ? escapeHtml(new Date(m.receivedDateTime).toLocaleString()) : ""}</div>
        </button>`,
      )
      .join("");

    list.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => openMessage(btn.getAttribute("data-id")));
    });
  } catch (err) {
    $("tokenError").textContent = err.message;
    $("tokenError").classList.remove("hidden");
    show($("listCard"), false);
    show($("detailCard"), false);
  }
}

async function openMessage(id) {
  const msg = await sharedApi(`/messages/${encodeURIComponent(id)}`);
  $("detailSubject").textContent = msg.subject;
  $("detailMeta").textContent = `${msg.from} · ${
    msg.receivedDateTime ? new Date(msg.receivedDateTime).toLocaleString() : ""
  }`;
  if (msg.bodyHtml) {
    $("detailBody").innerHTML = msg.bodyHtml;
  } else {
    $("detailBody").textContent = msg.bodyText || msg.bodyPreview || "";
  }
  show($("listCard"), false);
  show($("detailCard"), true);
}

$("loadBtn").addEventListener("click", openShared);
$("backBtn").addEventListener("click", () => {
  show($("detailCard"), false);
  show($("listCard"), true);
});

const initial = getTokenFromUrl();
if (initial) {
  $("tokenInput").value = initial;
  openShared();
}
