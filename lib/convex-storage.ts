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

function normalizeUploadNetworkError(message: string): string {
  if (/load failed/i.test(message)) {
    return "Error de red al subir (Load failed). Revisá la conexión e intentá de nuevo.";
  }
  if (/failed to fetch/i.test(message)) {
    return "No se pudo conectar al servidor de archivos. Revisá la red.";
  }
  return message;
}

function uploadViaXhr(
  postUrl: string,
  body: Blob,
  contentType: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", postUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.responseType = "text";
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(
            `Subida (XHR) HTTP ${xhr.status}: ${String(xhr.responseText).slice(0, 200)}`,
          ),
        );
        return;
      }
      const id = parseStorageIdFromResponse(String(xhr.responseText ?? ""));
      if (!id) {
        reject(new Error("Subida (XHR): respuesta sin storageId."));
        return;
      }
      resolve(id);
    };
    xhr.onerror = () => {
      reject(new Error("Subida (XHR): error de red."));
    };
    xhr.ontimeout = () => {
      reject(new Error("Subida (XHR): tiempo de espera agotado."));
    };
    xhr.timeout = 120_000;
    xhr.send(body);
  });
}

async function uploadViaFetchOnce(
  postUrl: string,
  body: Blob,
  contentType: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(normalizeUploadNetworkError(msg));
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(
      `Subida HTTP ${res.status}: ${text.slice(0, 240) || "(sin detalle)"}`,
    );
  }
  const id = parseStorageIdFromResponse(text);
  if (!id) {
    throw new Error("Respuesta del servidor sin storageId.");
  }
  return id;
}

/**
 * Sube un archivo a Convex Storage (POST a `generateUploadUrl`).
 * Reintentos + fallback XHR para Safari iOS / PWA (evita "Load failed" en fetch).
 */
export async function uploadFileToConvexStorage(
  postUrl: string,
  file: Blob | File,
): Promise<Id<"_storage">> {
  const contentType =
    file.type && file.type !== "application/octet-stream"
      ? file.type
      : "image/jpeg";

  const attempts = 2;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise((r) => globalThis.setTimeout(r, 600 * i));
    }
    try {
      const id = await uploadViaFetchOnce(postUrl, file, contentType);
      return id as Id<"_storage">;
    } catch (e) {
      lastErr = e;
    }
  }

  try {
    const id = await uploadViaXhr(postUrl, file, contentType);
    return id as Id<"_storage">;
  } catch (xhrErr) {
    const a =
      lastErr instanceof Error
        ? normalizeUploadNetworkError(lastErr.message)
        : String(lastErr);
    const b =
      xhrErr instanceof Error
        ? normalizeUploadNetworkError(xhrErr.message)
        : String(xhrErr);
    throw new Error(`${a} | Respaldo XHR: ${b}`);
  }
}
