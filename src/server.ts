import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { sharedRouter } from "./routes/shared.js";
import { mailboxRouter } from "./routes/mailbox.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  session({
    name: "mailapi.sid",
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "mailapi" });
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/shared", sharedRouter);
app.use("/api/mailbox", mailboxRouter);

const webDist = path.resolve(__dirname, "../web-dist");
const webPublic = path.resolve(__dirname, "../web");

if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
} else if (fs.existsSync(webPublic)) {
  app.use(express.static(webPublic));
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(config.PORT, () => {
  console.log(`MailAPI listening on ${config.BASE_URL} (port ${config.PORT})`);
});
