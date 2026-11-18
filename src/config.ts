import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3010),
  BASE_URL: z.string().url().default("http://localhost:3010"),
  SESSION_SECRET: z.string().min(16),
  ADMIN_PASSWORD: z.string().min(8),
  MS_GRAPH_TENANT_ID: z.string().uuid(),
  MS_GRAPH_CLIENT_ID: z.string().uuid(),
  MS_GRAPH_CLIENT_SECRET: z.string().min(1),
  MS_GRAPH_OBJECT_ID: z.string().uuid().optional(),
  MS_GRAPH_SECRET_ID: z.string().uuid().optional(),
  /** Mailbox UPN or email — required for app-only Graph mail access */
  MS_GRAPH_MAILBOX: z.string().min(3).optional(),
  DATA_DIR: z.string().default("./data"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const mailboxUserId = parsed.data.MS_GRAPH_MAILBOX || parsed.data.MS_GRAPH_OBJECT_ID;
if (!mailboxUserId) {
  console.error("Set MS_GRAPH_MAILBOX (user email/UPN) or MS_GRAPH_OBJECT_ID (user object id).");
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  mailboxUserId,
};

/** App-only Graph scope */
export const GRAPH_APP_SCOPE = ["https://graph.microsoft.com/.default"];
