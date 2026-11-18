import "dotenv/config";
import { ConfidentialClientApplication } from "@azure/msal-node";

const msal = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MS_GRAPH_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID}`,
    clientSecret: process.env.MS_GRAPH_CLIENT_SECRET,
  },
});

const tok = await msal.acquireTokenByClientCredential({
  scopes: ["https://graph.microsoft.com/.default"],
});
const token = tok.accessToken;
console.log("token ok", Boolean(token));

async function g(path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const t = await r.text();
  console.log("---", path, r.status);
  console.log(t.slice(0, 900));
}

const oid = process.env.MS_GRAPH_OBJECT_ID;
await g(`/users/${oid}/messages?$top=1&$select=id,subject`);
await g(`/users/${oid}/mailFolders/inbox/messages?$top=1&$select=id,subject`);
