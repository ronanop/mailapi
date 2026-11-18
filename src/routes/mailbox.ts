import { Router } from "express";
import { requireApiKey } from "../middleware/requireApiKey.js";
import { getMessage, listMessages } from "../graph/client.js";
import { config } from "../config.js";

/**
 * Downstream-app API: full read of the configured mailbox only.
 * Never exposes other tenants/mailboxes — Graph calls are hard-scoped to MS_GRAPH_MAILBOX.
 */
export const mailboxRouter = Router();
mailboxRouter.use(requireApiKey);

mailboxRouter.get("/me", (_req, res) => {
  res.json({
    mailbox: config.mailboxUserId,
    scope: "mailbox:read",
    note: "This key can only read the configured Connect Plus mailbox via MailAPI.",
  });
});

mailboxRouter.get("/messages", async (req, res) => {
  try {
    const top = Math.min(Number(req.query.top ?? 50), 100);
    const skip = Number(req.query.skip ?? 0);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const folder = typeof req.query.folder === "string" ? req.query.folder : "inbox";
    const data = await listMessages({ top, skip, search, folder });
    res.json({
      mailbox: config.mailboxUserId,
      ...data,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

mailboxRouter.get("/messages/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "Missing message id" });
      return;
    }
    const message = await getMessage(id);
    res.json({
      mailbox: config.mailboxUserId,
      message,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
