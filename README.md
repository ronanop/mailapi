# MailAPI — selective Microsoft 365 mail sharing

Own your Graph API connection, pick exact emails, then issue share tokens so others can read **only** those messages.

## How it works

1. **You (admin)** sign into this app with `ADMIN_PASSWORD`.
2. Server uses **app-only** Graph credentials (`MS_GRAPH_*`) to read the mailbox (`MS_GRAPH_OBJECT_ID`).
3. Browse/search inbox and select specific messages.
4. Create a **share grant** → secret token + reader link.
5. Recipients open `/reader.html?token=...` or call the shared API with `Authorization: Bearer <token>`.
6. The server proxies Graph for those message IDs only. Anything else returns `403`.

Readers never receive your Microsoft credentials.

## Azure app registration

1. Use your existing app registration (client id + secret).
2. API permissions → Microsoft Graph **Application**:
   - `Mail.Read` (and optionally `User.Read.All` to resolve mailbox profile)
3. Click **Grant admin consent** for the tenant.
4. Set `MS_GRAPH_MAILBOX` to the mailbox **email/UPN** (preferred).  
   `MS_GRAPH_OBJECT_ID` only works if it is that **user's** directory object id — not the app's object id.
5. Put values in `.env` (see `.env.example`).

## Setup

```bash
cp .env.example .env
# edit .env with Azure + admin password values

npm install
npm run dev
```

Open [http://localhost:3010](http://localhost:3010).

### Production

```bash
npm run build
npm start
```

Or Docker:

```bash
docker compose up --build -d
```

Persist `DATA_DIR` (grants + encrypted-ish token cache live in `store.json`).

## API (readers)

All shared endpoints require:

```http
Authorization: Bearer <share-token>
```

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/shared/me` | Grant metadata |
| GET | `/api/shared/messages` | Allowed message summaries |
| GET | `/api/shared/messages/:id` | Full message (only if granted) |

## API (admin)

Session cookie after `POST /api/auth/admin/login` with `{ "password": "..." }`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/status` | Admin + mailbox status |
| GET | `/api/auth/microsoft/start` | Returns Microsoft login URL |
| GET | `/api/admin/messages` | List/search mailbox |
| POST | `/api/admin/grants` | Create grant `{ label, messageIds, expiresAt? }` |
| POST | `/api/admin/grants/:id/revoke` | Revoke grant |

## Security notes

- Share tokens are high-entropy secrets — treat like passwords.
- Revoke grants when access should end; set `expiresAt` when creating.
- Deploy behind HTTPS; set `BASE_URL` to your public HTTPS origin.
- `ADMIN_PASSWORD` protects the admin UI; do not expose the admin panel publicly without extra protection (VPN / IP allowlist / reverse-proxy auth).
- This app stores Microsoft token cache under `DATA_DIR` — protect that volume.

## Project layout

```
src/           Express API + Graph proxy
web/           Admin UI + reader UI
data/          Runtime store (gitignored)
```
