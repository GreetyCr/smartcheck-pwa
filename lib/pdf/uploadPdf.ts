"use client";

import type { Id } from "@/convex/_generated/dataModel";

function parseStorageIdFromResponse(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const j = JSON.parse(trimmed) as { storageId?: string };
    if (typeof j.storageId === "string" && j.storageId.length > 0) {
      return j.storageId;
    }
  } catch {
    /* no es JSON */
  }
  return undefined;
}

/** Safari a veces maneja mejor XHR que fetch para POST binario a orígenes externos (p. ej. Convex Storage). */
function uploadPdfViaXhr(postUrl: string, blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", postUrl);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.responseType = "text";
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(
            `Subida PDF (XHR) falló: HTTP ${xhr.status} — ${String(xhr.responseText).slice(0, 200)}`,
          ),
        );
        return;
      }
      const id = parseStorageIdFromResponse(String(xhr.responseText ?? ""));
      if (!id) {
        reject(
          new Error(
            "Subida PDF (XHR): respuesta sin storageId (cuerpo inesperado).",
          ),
        );
        return;
      }
      resolve(id);
    };
    xhr.onerror = () => {
      reject(new Error("Subida PDF (XHR): error de red (onerror)."));
    };
    xhr.ontimeout = () => {
      reject(new Error("Subida PDF (XHR): tiempo de espera agotado."));
    };
    xhr.timeout = 120_000;
    xhr.send(blob);
  });
}

async function uploadPdfViaFetchOnce(
  postUrl: string,
  blob: Blob,
): Promise<string> {
  const res = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: blob,
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(
      `Subida PDF (fetch): HTTP ${res.status} — ${text.slice(0, 240) || "(sin cuerpo)"}`,
    );
  }
  const id = parseStorageIdFromResponse(text);
  if (!id) {
    throw new Error(
      `Subida PDF (fetch): HTTP ${res.status} pero sin storageId en JSON — ${text.slice(0, 200)}`,
    );
  }
  return id;
}

/**
 * Sube un PDF a Convex Storage (POST a la URL de `generatePdfUploadUrl`).
 * Reintentos + fallback XHR por problemas conocidos en Safari iOS / PWA.
 */
export async function uploadPdfBlobToConvex(
  postUrl: string,
  blob: Blob,
): Promise<Id<"_storage">> {
  const attempts = 2;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise((r) => globalThis.setTimeout(r, 600 * i));
    }
    try {
      const id = await uploadPdfViaFetchOnce(postUrl, blob);
      return id as Id<"_storage">;
    } catch (e) {
      lastErr = e;
    }
  }
  try {
    const id = await uploadPdfViaXhr(postUrl, blob);
    return id as Id<"_storage">;
  } catch (xhrErr) {
    const a = lastErr instanceof Error ? lastErr.message : String(lastErr);
    const b = xhrErr instanceof Error ? xhrErr.message : String(xhrErr);
    throw new Error(`fetch: ${a} | xhr: ${b}`);
  }
}
