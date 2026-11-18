import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { getMessage, listMessages } from "../graph/client.js";
import {
  createApiKey,
  createGrant,
  getGrantById,
  listApiKeys,
  listGrants,
  revokeApiKey,
  revokeGrant,
  type SharedMessageMeta,
} from "../db/store.js";
import { config } from "../config.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get("/messages", async (req, res) => {
  try {
    const top = Number(req.query.top ?? 25);
    const skip = Number(req.query.skip ?? 0);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const folder = typeof req.query.folder === "string" ? req.query.folder : "inbox";
    const data = await listMessages({ top, skip, search, folder });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

adminRouter.get("/messages/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "Missing message id" });
      return;
    }
    const message = await getMessage(id);
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const createGrantSchema = z.object({
  label: z.string().min(1).max(120),
  messageIds: z.array(z.string().min(1)).min(1).max(100),
  expiresAt: z.string().datetime().nullable().optional(),
  allowedReaderNote: z.string().max(500).optional(),
});

adminRouter.get("/grants", (_req, res) => {
  res.json({
    grants: listGrants().map((g) => ({
      ...g,
      shareUrl: `${config.BASE_URL}/reader.html?token=${g.token}`,
      apiBase: `${config.BASE_URL}/api/shared`,
    })),
  });
});

adminRouter.post("/grants", async (req, res) => {
  try {
    const parsed = createGrantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const metas: SharedMessageMeta[] = [];
    for (const id of parsed.data.messageIds) {
      const msg = await getMessage(id);
      metas.push({
        id: msg.id,
        subject: msg.subject,
        from: msg.from,
        receivedDateTime: msg.receivedDateTime,
        preview: msg.preview,
      });
    }

    const grant = createGrant({
      label: parsed.data.label,
      messageIds: parsed.data.messageIds,
      messages: metas,
      expiresAt: parsed.data.expiresAt ?? null,
      allowedReaderNote: parsed.data.allowedReaderNote,
    });

    res.status(201).json({
      ...grant,
      shareUrl: `${config.BASE_URL}/reader.html?token=${grant.token}`,
      apiBase: `${config.BASE_URL}/api/shared`,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

adminRouter.post("/grants/:id/revoke", (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing grant id" });
    return;
  }
  const grant = revokeGrant(id);
  if (!grant) {
    res.status(404).json({ error: "Grant not found" });
    return;
  }
  res.json(grant);
});

adminRouter.get("/grants/:id", (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing grant id" });
    return;
  }
  const grant = getGrantById(id);
  if (!grant) {
    res.status(404).json({ error: "Grant not found" });
    return;
  }
  res.json({
    ...grant,
    shareUrl: `${config.BASE_URL}/reader.html?token=${grant.token}`,
  });
});

const createApiKeySchema = z.object({
  label: z.string().min(1).max(120),
  expiresAt: z.string().datetime().nullable().optional(),
});

adminRouter.get("/api-keys", (_req, res) => {
  res.json({
    mailbox: config.mailboxUserId,
    apiBase: `${config.BASE_URL}/api/mailbox`,
    keys: listApiKeys(),
  });
});

adminRouter.post("/api-keys", (req, res) => {
  const parsed = createApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const apiKey = createApiKey({
    label: parsed.data.label,
    expiresAt: parsed.data.expiresAt ?? null,
  });
  res.status(201).json({
    ...apiKey,
    mailbox: config.mailboxUserId,
    apiBase: `${config.BASE_URL}/api/mailbox`,
    usage: {
      list: `GET ${config.BASE_URL}/api/mailbox/messages`,
      detail: `GET ${config.BASE_URL}/api/mailbox/messages/{id}`,
      header: `Authorization: Bearer ${apiKey.key}`,
    },
  });
});

adminRouter.post("/api-keys/:id/revoke", (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing api key id" });
    return;
  }
  const apiKey = revokeApiKey(id);
  if (!apiKey) {
    res.status(404).json({ error: "API key not found" });
    return;
  }
  res.json(apiKey);
});
