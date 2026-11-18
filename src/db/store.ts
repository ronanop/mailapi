import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { config } from "../config.js";

export type SharedMessageMeta = {
  id: string;
  subject: string;
  from: string;
  receivedDateTime: string;
  preview: string;
};

export type ShareGrant = {
  id: string;
  token: string;
  label: string;
  messageIds: string[];
  messages: SharedMessageMeta[];
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  allowedReaderNote?: string;
};

/** Full read access to the configured mailbox only (for downstream apps). */
export type ApiKey = {
  id: string;
  key: string;
  label: string;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  lastUsedAt: string | null;
};

type DbShape = {
  grants: ShareGrant[];
  apiKeys: ApiKey[];
};

function ensureDataDir() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
}

function dbPath() {
  return path.join(config.DATA_DIR, "store.json");
}

function readDb(): DbShape {
  ensureDataDir();
  const file = dbPath();
  if (!fs.existsSync(file)) {
    return { grants: [], apiKeys: [] };
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<DbShape>;
  return { grants: raw.grants ?? [], apiKeys: raw.apiKeys ?? [] };
}

function writeDb(db: DbShape) {
  ensureDataDir();
  fs.writeFileSync(dbPath(), JSON.stringify(db, null, 2), "utf8");
}

export function listGrants(): ShareGrant[] {
  return readDb().grants;
}

export function getGrantById(id: string): ShareGrant | undefined {
  return readDb().grants.find((g) => g.id === id);
}

export function getGrantByToken(token: string): ShareGrant | undefined {
  return readDb().grants.find((g) => g.token === token);
}

export function createGrant(input: {
  label: string;
  messageIds: string[];
  messages: SharedMessageMeta[];
  expiresAt?: string | null;
  allowedReaderNote?: string;
}): ShareGrant {
  const db = readDb();
  const grant: ShareGrant = {
    id: nanoid(12),
    token: nanoid(40),
    label: input.label,
    messageIds: input.messageIds,
    messages: input.messages,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
    revoked: false,
    allowedReaderNote: input.allowedReaderNote,
  };
  db.grants.unshift(grant);
  writeDb(db);
  return grant;
}

export function revokeGrant(id: string): ShareGrant | undefined {
  const db = readDb();
  const grant = db.grants.find((g) => g.id === id);
  if (!grant) return undefined;
  grant.revoked = true;
  writeDb(db);
  return grant;
}

export function isGrantActive(grant: ShareGrant): boolean {
  if (grant.revoked) return false;
  if (grant.expiresAt && new Date(grant.expiresAt).getTime() < Date.now()) {
    return false;
  }
  return true;
}

export function listApiKeys(): ApiKey[] {
  return readDb().apiKeys;
}

export function getApiKeyByValue(key: string): ApiKey | undefined {
  return readDb().apiKeys.find((k) => k.key === key);
}

export function createApiKey(input: {
  label: string;
  expiresAt?: string | null;
}): ApiKey {
  const db = readDb();
  const apiKey: ApiKey = {
    id: nanoid(12),
    key: `mk_${nanoid(48)}`,
    label: input.label,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
    revoked: false,
    lastUsedAt: null,
  };
  db.apiKeys.unshift(apiKey);
  writeDb(db);
  return apiKey;
}

export function revokeApiKey(id: string): ApiKey | undefined {
  const db = readDb();
  const apiKey = db.apiKeys.find((k) => k.id === id);
  if (!apiKey) return undefined;
  apiKey.revoked = true;
  writeDb(db);
  return apiKey;
}

export function touchApiKey(id: string) {
  const db = readDb();
  const apiKey = db.apiKeys.find((k) => k.id === id);
  if (!apiKey) return;
  apiKey.lastUsedAt = new Date().toISOString();
  writeDb(db);
}

export function isApiKeyActive(apiKey: ApiKey): boolean {
  if (apiKey.revoked) return false;
  if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() < Date.now()) {
    return false;
  }
  return true;
}
