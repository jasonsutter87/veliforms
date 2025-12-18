/**
 * VeilForms - Private Key Download Token Operations
 * One-time tokens for securely downloading form private keys
 */

import { getStore } from "@netlify/blobs";

const STORE_NAME = "vf-private-key-download-tokens";

interface PrivateKeyTokenData {
  formId: string;
  userId: string;
  privateKey: string;
  createdAt: string;
  expiresAt: string;
}

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

/**
 * Create a one-time download token for a private key
 * Token expires in 15 minutes
 */
export async function createPrivateKeyDownloadToken(
  formId: string,
  userId: string,
  privateKey: string
): Promise<string> {
  const tokens = store();
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  const tokenData: PrivateKeyTokenData = {
    formId,
    userId,
    privateKey,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await tokens.setJSON(token, tokenData);
  return token;
}

/**
 * Get and consume a private key download token
 * Token is deleted after retrieval (one-time use)
 */
export async function consumePrivateKeyDownloadToken(
  token: string
): Promise<PrivateKeyTokenData | null> {
  const tokens = store();

  try {
    const tokenData = (await tokens.get(token, { type: "json" })) as PrivateKeyTokenData | null;
    if (!tokenData) {
      return null;
    }

    // Check expiration
    if (new Date(tokenData.expiresAt) < new Date()) {
      await tokens.delete(token);
      return null;
    }

    // Delete token (one-time use)
    await tokens.delete(token);

    return tokenData;
  } catch {
    return null;
  }
}
