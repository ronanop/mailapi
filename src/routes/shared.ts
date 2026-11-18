import { Router } from "express";
import { getGrantByToken, isGrantActive } from "../db/store.js";
import { getMessage } from "../graph/client.js";

export const sharedRouter = Router();

function extractToken(req: {
  headers: { authorization?: string };
  query: Record<string, unknown>;
}): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  if (typeof req.query.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return null;
}

type GrantOk = { ok: true; grant: NonNullable<ReturnType<typeof getGrantByToken>> };
type GrantErr = { ok: false; error: string; status: number };

function loadActiveGrant(token: string | null): GrantOk | GrantErr {
  if (!token) return { ok: false, error: "Missing share token", status: 401 };
  const grant = getGrantByToken(token);
  if (!grant) return { ok: false, error: "Invalid share token", status: 401 };
  if (!isGrantActive(grant)) {
    return { ok: false, error: "Share token revoked or expired", status: 403 };
  }
  return { ok: true, grant };
}

sharedRouter.get("/me", (req, res) => {
  const token = extractToken(req);
  const result = loadActiveGrant(token);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  const { grant } = result;
  res.json({
    label: grant.label,
    note: grant.allowedReaderNote ?? null,
    expiresAt: grant.expiresAt,
    messageCount: grant.messageIds.length,
  });
});

sharedRouter.get("/messages", (req, res) => {
  const token = extractToken(req);
  const result = loadActiveGrant(token);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({
    messages: result.grant.messages,
  });
});

sharedRouter.get("/messages/:id", async (req, res) => {
  const token = extractToken(req);
  const result = loadActiveGrant(token);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const messageId = req.params.id;
  if (!messageId || !result.grant.messageIds.includes(messageId)) {
    res.status(403).json({ error: "This message is not included in your share grant" });
    return;
  }

  try {
    const message = await getMessage(messageId);
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
