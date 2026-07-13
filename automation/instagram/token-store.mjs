import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const stateDirectory = path.resolve("state");
const tokenPath = path.join(stateDirectory, "instagram-token.enc");
const refreshIntervalMs = 30 * 24 * 60 * 60 * 1000;

function encryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error("Falta el secreto TOKEN_ENCRYPTION_KEY.");
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY debe contener exactamente 32 bytes codificados en base64.");
  }

  return key;
}

async function encryptState(state) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(state), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  const envelope = Buffer.concat([iv, authenticationTag, encrypted]).toString("base64");

  await mkdir(stateDirectory, { recursive: true });
  await writeFile(tokenPath, `${envelope}\n`, "utf8");
}

async function decryptState() {
  const envelope = Buffer.from((await readFile(tokenPath, "utf8")).trim(), "base64");

  if (envelope.length < 29) {
    throw new Error("El estado cifrado de Instagram está dañado.");
  }

  const iv = envelope.subarray(0, 12);
  const authenticationTag = envelope.subarray(12, 28);
  const encrypted = envelope.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authenticationTag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

export async function loadInstagramToken() {
  if (existsSync(tokenPath)) {
    const state = await decryptState();

    if (!state.access_token) {
      throw new Error("El estado cifrado no contiene un token de Instagram.");
    }

    return state.access_token;
  }

  if (!process.env.IG_ACCESS_TOKEN) {
    throw new Error("Falta el secreto inicial IG_ACCESS_TOKEN.");
  }

  await encryptState({
    access_token: process.env.IG_ACCESS_TOKEN,
    refreshed_at: new Date().toISOString(),
  });

  return process.env.IG_ACCESS_TOKEN;
}

export async function refreshInstagramTokenIfDue(currentToken) {
  const state = await decryptState();
  const refreshedAt = new Date(state.refreshed_at || 0).getTime();

  if (Date.now() - refreshedAt < refreshIntervalMs) {
    return currentToken;
  }

  const query = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: currentToken,
  });
  const response = await fetch(`https://graph.instagram.com/refresh_access_token?${query}`);
  const payload = await response.json();

  if (!response.ok || payload.error || !payload.access_token) {
    const message = payload?.error?.message || JSON.stringify(payload);
    throw new Error(`No se pudo renovar el acceso de Instagram (${response.status}): ${message}`);
  }

  await encryptState({
    access_token: payload.access_token,
    refreshed_at: new Date().toISOString(),
    expires_in: payload.expires_in,
  });

  return payload.access_token;
}
