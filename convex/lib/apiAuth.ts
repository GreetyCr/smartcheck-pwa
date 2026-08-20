/**
 * Auth de los endpoints HTTP para n8n / ManyChat (A37).
 *
 * Convex no trae autenticación de terceros en los `httpAction`: `ctx.auth` sirve
 * para el JWT de Clerk (usuarios del panel), no para un bot. Así que la validamos
 * acá, con un token compartido en `N8N_INGEST_TOKEN`.
 *
 * Es a propósito lo más simple que funciona:
 *  - **Un token, no por-cliente.** Hoy el consumidor es uno (el n8n de Hans). El
 *    día que sean varios y haga falta revocar a uno solo, esto se cambia por
 *    tokens en tabla; hasta entonces sería complejidad sin beneficio.
 *  - **Sin CORS.** n8n pega server-side; nadie llama esto desde un navegador.
 *    Si algún día hace falta, se agrega el preflight explícito.
 *
 * Ojo con dos cosas que se hacen mal seguido y acá están cubiertas:
 *  1. Comparar con `===` filtra el token por tiempo de respuesta. Se compara en
 *     tiempo constante.
 *  2. Loguear el header en el error deja el token en los logs de Convex para
 *     siempre. Acá NUNCA se registra el token, ni entero ni en pedazos.
 */

/** Códigos de error estables — n8n puede ramificar sobre esto sin parsear prosa. */
export type ApiErrorCode =
  | "unauthorized"
  | "not_configured"
  | "method_not_allowed"
  | "bad_request"
  | "not_found";

/** Respuesta JSON con el `Content-Type` correcto. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Error con forma estable: `{ error: <código>, message: <humano> }`.
 * El código es para la máquina; el mensaje, para quien lee el log de n8n.
 */
export function errorResponse(
  status: number,
  error: ApiErrorCode,
  message: string,
): Response {
  return jsonResponse(status, { error, message });
}

/**
 * Comparación en tiempo constante.
 *
 * Un `a === b` corta en el primer carácter distinto, así que el tiempo de
 * respuesta filtra cuánto prefijo acertó quien está probando — suficiente para
 * adivinar el token carácter por carácter. Acá se recorre siempre el largo
 * completo y se acumula la diferencia con OR.
 *
 * La diferencia de longitud entra en el acumulador (no hay corte temprano por
 * largo), aunque el largo del token no es un secreto que valga la pena proteger.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    // `charCodeAt` fuera de rango da NaN; `|| 0` lo normaliza sin cortar el ciclo.
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Valida `Authorization: Bearer <token>`.
 *
 * Devuelve `null` si pasa, o la `Response` de error si no. El patrón de uso es:
 *
 * ```ts
 * const denied = requireBotToken(request);
 * if (denied) return denied;
 * ```
 *
 * Si `N8N_INGEST_TOKEN` no está en el env devuelve **500, no 401**: que el
 * servidor esté a medio configurar no es culpa de quien llama, y confundirlos
 * manda a Hans a revisar su credencial cuando el problema es nuestro.
 */
export function requireBotToken(request: Request): Response | null {
  const expected = process.env.N8N_INGEST_TOKEN?.trim();
  if (!expected) {
    console.error("[api] N8N_INGEST_TOKEN no está configurado en este deployment");
    return errorResponse(
      500,
      "not_configured",
      "El endpoint no está configurado en este deployment.",
    );
  }

  const header = request.headers.get("Authorization") ?? "";
  const prefix = "Bearer ";
  // El token vacío nunca pasa, aunque `expected` también lo estuviera.
  const provided = header.startsWith(prefix)
    ? header.slice(prefix.length).trim()
    : "";

  if (provided.length === 0 || !timingSafeEqual(provided, expected)) {
    // A propósito sin detalle: si el error distingue "falta header" de "token
    // incorrecto", ya es información para quien está probando. Y NUNCA se
    // registra el valor recibido.
    return errorResponse(
      401,
      "unauthorized",
      "Credencial inválida o ausente. Usá el header Authorization: Bearer <token>.",
    );
  }

  return null;
}

/** Cuerpo JSON, o `null` si viene vacío o mal formado (el handler decide qué hacer). */
export async function parseJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await request.text();
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
