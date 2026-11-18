import { ConfidentialClientApplication } from "@azure/msal-node";
import { config, GRAPH_APP_SCOPE } from "../config.js";

const msal = new ConfidentialClientApplication({
  auth: {
    clientId: config.MS_GRAPH_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${config.MS_GRAPH_TENANT_ID}`,
    clientSecret: config.MS_GRAPH_CLIENT_SECRET,
  },
});

let cached: { accessToken: string; expiresAt: number } | null = null;

export async function getValidAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const result = await msal.acquireTokenByClientCredential({
    scopes: GRAPH_APP_SCOPE,
  });

  if (!result?.accessToken) {
    throw new Error("Failed to acquire Microsoft Graph app token");
  }

  cached = {
    accessToken: result.accessToken,
    expiresAt: result.expiresOn?.getTime() ?? Date.now() + 3600_000,
  };

  return cached.accessToken;
}
