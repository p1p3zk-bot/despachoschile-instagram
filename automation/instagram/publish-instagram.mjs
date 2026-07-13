import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadInstagramToken,
  refreshInstagramTokenIfDue,
} from "./token-store.mjs";

const requiredEnvironment = [
  "IG_ACCESS_TOKEN",
  "IG_USER_ID",
  "TOKEN_ENCRYPTION_KEY",
  "MEDIA_URL",
  "POST_DATE",
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`Falta el secreto o variable ${name}.`);
  }
}

const graphVersion = process.env.META_GRAPH_VERSION || "v25.0";
const graphBase = `https://graph.instagram.com/${graphVersion}`;
const accessToken = await loadInstagramToken();
const igUserId = process.env.IG_USER_ID;
const mediaUrl = process.env.MEDIA_URL;
const postDate = process.env.POST_DATE;
const captionPath = path.resolve("posts", `${postDate}.caption.txt`);
const receiptPath = path.resolve("posts", `${postDate}.published.json`);
const caption = (await readFile(captionPath, "utf8")).trim();

async function graphPost(endpoint, values) {
  const response = await fetch(`${graphBase}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...values, access_token: accessToken }),
  });
  const payload = await response.json();

  if (!response.ok || payload.error) {
    const message = payload?.error?.message || JSON.stringify(payload);
    throw new Error(`Instagram rechazó la solicitud (${response.status}): ${message}`);
  }

  return payload;
}

async function getContainerStatus(containerId) {
  const query = new URLSearchParams({
    fields: "status_code,status",
    access_token: accessToken,
  });
  const response = await fetch(`${graphBase}/${containerId}?${query}`);
  const payload = await response.json();

  if (!response.ok || payload.error) {
    const message = payload?.error?.message || JSON.stringify(payload);
    throw new Error(`No se pudo comprobar la imagen (${response.status}): ${message}`);
  }

  return payload;
}

const container = await graphPost(`/${igUserId}/media`, {
  image_url: mediaUrl,
  caption,
});

let finished = false;

for (let attempt = 0; attempt < 12; attempt += 1) {
  const status = await getContainerStatus(container.id);

  if (status.status_code === "FINISHED") {
    finished = true;
    break;
  }

  if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
    throw new Error(`Instagram no pudo preparar la imagen: ${status.status || status.status_code}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));
}

if (!finished) {
  throw new Error("Instagram no terminó de preparar la imagen dentro del tiempo esperado.");
}

const publication = await graphPost(`/${igUserId}/media_publish`, {
  creation_id: container.id,
});

const receipt = {
  instagram_media_id: publication.id,
  container_id: container.id,
  media_url: mediaUrl,
  published_at: new Date().toISOString(),
  account: "@despachoschile2025",
};

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
await refreshInstagramTokenIfDue(accessToken);
console.log(`Publicación completada: ${publication.id}`);
