import type { RequestHandler } from "express";
import {
  getApiKeyByValue,
  isApiKeyActive,
  touchApiKey,
  type ApiKey,
} from "../db/store.js";

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
    }
  }
}

export const requireApiKey: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const fromBearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const fromHeader =
    typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"].trim() : "";
  const key = fromBearer || fromHeader;

  if (!key) {
    res.status(401).json({ error: "Missing API key (Authorization: Bearer mk_… or X-Api-Key)" });
    return;
  }

  const apiKey = getApiKeyByValue(key);
  if (!apiKey || !isApiKeyActive(apiKey)) {
    res.status(401).json({ error: "Invalid, revoked, or expired API key" });
    return;
  }

  touchApiKey(apiKey.id);
  req.apiKey = apiKey;
  next();
};
