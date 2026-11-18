import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
import { getValidAccessToken } from "../auth/msal.js";
import { config } from "../config.js";
import type { SharedMessageMeta } from "../db/store.js";

function mailboxPath(suffix: string) {
  // UPN/email must be URL-encoded for Graph /users/{id|upn}
  const user = encodeURIComponent(config.mailboxUserId);
  return `/users/${user}${suffix}`;
}

async function graphClient() {
  const token = await getValidAccessToken();
  return Client.init({
    authProvider: (done) => done(null, token),
  });
}

export type MailSummary = SharedMessageMeta & {
  hasAttachments: boolean;
  isRead: boolean;
};

export type MailDetail = MailSummary & {
  bodyPreview: string;
  bodyHtml: string;
  bodyText: string;
  toRecipients: string[];
  ccRecipients: string[];
};

function mapSummary(m: Record<string, unknown>): MailSummary {
  const from = m.from as { emailAddress?: { name?: string; address?: string } } | undefined;
  const fromLabel =
    from?.emailAddress?.name && from?.emailAddress?.address
      ? `${from.emailAddress.name} <${from.emailAddress.address}>`
      : from?.emailAddress?.address || from?.emailAddress?.name || "Unknown";

  return {
    id: String(m.id),
    subject: String(m.subject ?? "(no subject)"),
    from: fromLabel,
    receivedDateTime: String(m.receivedDateTime ?? ""),
    preview: String(m.bodyPreview ?? ""),
    hasAttachments: Boolean(m.hasAttachments),
    isRead: Boolean(m.isRead),
  };
}

export async function listMessages(options: {
  top?: number;
  skip?: number;
  search?: string;
  folder?: string;
}): Promise<{ messages: MailSummary[]; nextLink?: string }> {
  const client = await graphClient();
  const top = options.top ?? 25;
  const skip = options.skip ?? 0;
  const folder = options.folder ?? "inbox";

  let request = client
    .api(mailboxPath(`/mailFolders/${folder}/messages`))
    .select("id,subject,from,receivedDateTime,bodyPreview,hasAttachments,isRead")
    .orderby("receivedDateTime desc")
    .top(top)
    .skip(skip);

  if (options.search?.trim()) {
    request = client
      .api(mailboxPath("/messages"))
      .search(`"${options.search.trim().replace(/"/g, "")}"`)
      .select("id,subject,from,receivedDateTime,bodyPreview,hasAttachments,isRead")
      .top(top);
  }

  const res = await request.get();
  return {
    messages: (res.value ?? []).map(mapSummary),
    nextLink: res["@odata.nextLink"],
  };
}

export async function getMessage(id: string): Promise<MailDetail> {
  const client = await graphClient();
  const m = await client
    .api(mailboxPath(`/messages/${id}`))
    .select(
      "id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,isRead,toRecipients,ccRecipients",
    )
    .get();

  const summary = mapSummary(m);
  const body = m.body as { contentType?: string; content?: string } | undefined;
  const recipients = (list: Array<{ emailAddress?: { address?: string; name?: string } }> = []) =>
    list.map((r) => r.emailAddress?.address || r.emailAddress?.name || "").filter(Boolean);

  return {
    ...summary,
    bodyPreview: String(m.bodyPreview ?? ""),
    bodyHtml: body?.contentType === "html" ? String(body.content ?? "") : "",
    bodyText:
      body?.contentType === "text"
        ? String(body.content ?? "")
        : String(m.bodyPreview ?? ""),
    toRecipients: recipients(m.toRecipients),
    ccRecipients: recipients(m.ccRecipients),
  };
}

export async function probeGraphConnection(): Promise<{
  ok: boolean;
  displayName?: string;
  email?: string;
  error?: string;
}> {
  try {
    // Use Mail.Read only — do not call /users/{id} profile (needs User.Read.All).
    const client = await graphClient();
    await client.api(mailboxPath("/mailFolders/inbox")).select("id,displayName").get();
    return {
      ok: true,
      displayName: "Mailbox",
      email: config.mailboxUserId,
    };
  } catch (err) {
    const message = (err as Error).message || "Graph connection failed";
    const hint =
      /ErrorInvalidUser|requested user|is invalid/i.test(message)
        ? ` — set MS_GRAPH_MAILBOX=user@domain.com in .env (current id is not a mailbox user)`
        : /insufficient privileges|Authorization_RequestDenied/i.test(message)
          ? " — grant Application permission Mail.Read + admin consent in Azure"
          : "";
    return { ok: false, error: `${message}${hint}` };
  }
}
