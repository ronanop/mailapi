import { Router } from "express";
import { config } from "../config.js";
import { probeGraphConnection } from "../graph/client.js";

export const authRouter = Router();

authRouter.get("/status", async (req, res) => {
  const graph = req.session?.isAdmin ? await probeGraphConnection() : null;
  res.json({
    adminLoggedIn: Boolean(req.session?.isAdmin),
    mailboxConnected: Boolean(graph?.ok),
    owner: graph?.ok
      ? {
          displayName: graph.displayName,
          email: graph.email,
        }
      : null,
    graphError: graph && !graph.ok ? graph.error : null,
    mode: "app-only",
    mailboxObjectId: config.mailboxUserId,
  });
});

authRouter.post("/admin/login", (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password || password !== config.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }
  req.session.isAdmin = true;
  res.json({ ok: true });
});

authRouter.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
