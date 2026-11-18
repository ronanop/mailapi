import type { RequestHandler } from "express";

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.session?.isAdmin) {
    res.status(401).json({ error: "Admin login required" });
    return;
  }
  next();
};

export const requireAdminSession = requireAdmin;
