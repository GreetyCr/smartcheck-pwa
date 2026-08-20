/**
 * Router HTTP de Convex.
 *
 * Dos superficies distintas, con auth distinta:
 *  - `/clerk-webhook` — altas/bajas de usuarios. Firma svix.
 *  - `/leads/*` y `/bot/*` — la API para n8n / ManyChat (A37). Token compartido,
 *    ver `lib/apiAuth.ts`.
 *
 * ⚠️ Estos endpoints viven en **`https://<deployment>.convex.site`**, NO en
 * `.convex.cloud`. Es otro dominio, mismo deployment, y pegarle al equivocado
 * da un error que se lee como problema de credenciales cuando no lo es.
 */
import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import {
  errorResponse,
  jsonResponse,
  parseJsonBody,
  requireBotToken,
} from "./lib/apiAuth";

function parseClerkUser(data: Record<string, unknown>) {
  const id = data.id as string;
  const emails = data.email_addresses as
    | Array<{ email_address: string; id: string }>
    | undefined;
  const primaryId = data.primary_email_address_id as string | null | undefined;
  let email = "";
  if (emails?.length) {
    const primary = emails.find((e) => e.id === primaryId);
    email = primary?.email_address ?? emails[0].email_address;
  }
  const first = (data.first_name as string) ?? "";
  const last = (data.last_name as string) ?? "";
  const nameJoined = [first, last].filter(Boolean).join(" ").trim();
  const name = nameJoined.length > 0 ? nameJoined : undefined;
  const imageUrl =
    (data.image_url as string | undefined) ??
    (data.profile_image_url as string | undefined) ??
    undefined;
  return { clerkId: id, email, name, imageUrl };
}

const clerkWebhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("CLERK_WEBHOOK_SECRET no configurado", {
      status: 500,
    });
  }

  const payload = await request.text();
  const svix_id = request.headers.get("svix-id");
  const svix_timestamp = request.headers.get("svix-timestamp");
  const svix_signature = request.headers.get("svix-signature");
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  let body: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    body = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as { type: string; data: Record<string, unknown> };
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const { type, data } = body;

  if (type === "user.deleted") {
    const clerkId = data.id as string;
    await ctx.runMutation(internal.users.deleteByClerkId, { clerkId });
    return new Response(null, { status: 200 });
  }

  if (type === "user.created" || type === "user.updated") {
    const parsed = parseClerkUser(data);
    if (!parsed.email) {
      return new Response("User email required", { status: 400 });
    }
    await ctx.runMutation(internal.users.upsertFromClerk, {
      clerkId: parsed.clerkId,
      email: parsed.email,
      name: parsed.name,
      imageUrl: parsed.imageUrl,
    });
    return new Response(null, { status: 200 });
  }

  return new Response(null, { status: 200 });
});

/* -------------------------------------------------------------------------- */
/* API para n8n / ManyChat (A37)                                              */
/* -------------------------------------------------------------------------- */

/**
 * `GET /bot/ping` — verifica la credencial y nada más.
 *
 * Existe para que Hans confirme que su credencial funciona **antes** de armar
 * ningún flujo. Sin esto, el primer intento mezcla auth, URL, forma del cuerpo
 * y lógica en un solo error difícil de leer.
 */
const botPing = httpAction(async (_ctx, request) => {
  const denied = requireBotToken(request);
  if (denied) return denied;
  return jsonResponse(200, { ok: true, service: "smartcheck-convex" });
});

/**
 * `GET /bot/onoff` — estado del kill-switch global.
 *
 * El bot debería consultarlo antes de escribirle a alguien. De todos modos,
 * `/leads/due-followups` ya lo aplica por su cuenta: con el bot apagado devuelve
 * la lista vacía, así que aunque nadie lea este endpoint el switch surte efecto.
 *
 * `POST /bot/onoff` escribe el estado desde n8n. La regla de **precedencia**
 * sigue sin definir (H2), así que por ahora gana el último cambio y el choque
 * con el tablero queda registrado — ver `settings.ts`.
 */
const botOnOff = httpAction(async (ctx, request) => {
  const denied = requireBotToken(request);
  if (denied) return denied;
  const state = await ctx.runQuery(internal.bots.settings.getGlobal, {});
  return jsonResponse(200, state);
});

/**
 * `GET /leads/due-followups?window=2h|23h|48h[&limit=n]`
 *
 * Reemplaza la fórmula `Horas sin responder` + la vista de Airtable.
 * Devuelve nombre y teléfono porque el bot necesita eso para escribir; es la
 * única superficie de la API que expone datos personales.
 */
const dueFollowups = httpAction(async (ctx, request) => {
  const denied = requireBotToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const window = url.searchParams.get("window");
  if (window !== "2h" && window !== "23h" && window !== "48h") {
    return errorResponse(
      400,
      "bad_request",
      "Parámetro `window` requerido: 2h, 23h o 48h.",
    );
  }

  const rawLimit = url.searchParams.get("limit");
  let limit: number | undefined;
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return errorResponse(
        400,
        "bad_request",
        "`limit` debe ser un entero mayor que cero.",
      );
    }
    limit = Math.floor(parsed);
  }

  const result = await ctx.runQuery(internal.bots.followups.dueFollowups, {
    window,
    limit,
  });
  return jsonResponse(200, result);
});

/**
 * `POST /leads/upsert` — crear o actualizar un contacto.
 *
 * Reemplaza el "crear o actualizar" que el bot hace hoy sobre Airtable. Es
 * **idempotente por identidad**: repetir la misma llamada actualiza la misma
 * fila, nunca crea otra. Eso es lo que hace seguro el *Retry on Fail* de n8n.
 *
 * Es un upsert **parcial**: solo se escribe lo que venga en el cuerpo. Mandar
 * `{manychatId, lastContactAt}` no borra el nombre ni el vehículo.
 */
const leadsUpsert = httpAction(async (ctx, request) => {
  const denied = requireBotToken(request);
  if (denied) return denied;

  const body = await parseJsonBody(request);
  if (!body) {
    return errorResponse(
      400,
      "bad_request",
      "Se esperaba un cuerpo JSON con un objeto.",
    );
  }

  const campos = [
    "manychatId", "phone", "name", "locality", "needsInvoice",
    "vehicleBrand", "vehicleModel", "vehicleYear", "transmissionType",
    "engineType", "tractionType", "leadStage", "paymentStatus",
    "chatbotActive", "lastContactAt", "appointmentAt",
    "followup2hDone", "followup23hDone", "followup48hDone", "runId",
  ] as const;
  const { args, desconocidos } = tomar(body, campos);
  if (desconocidos.length > 0) return errorDeCamposDesconocidos(desconocidos, campos);

  try {
    const res = await ctx.runMutation(
      internal.bots.leadsIngest.upsertLead,
      args as never,
    );
    // 201 cuando se creó, 200 cuando se actualizó: n8n puede ramificar por
    // código sin leer el cuerpo.
    return jsonResponse(res.action === "created" ? 201 : 200, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Falta de llave o campo fuera del contrato = problema del que llama.
    return errorResponse(400, "bad_request", msg.slice(0, 300));
  }
});

/**
 * Separa los campos del contrato de los que no lo son.
 *
 * Devuelve también los **desconocidos**, y eso no es un detalle: la primera
 * versión los descartaba en silencio, así que `{"manychatId":"…","nombre":"Ana"}`
 * —un typo de `name`— respondía 201 con la fila creada **sin nombre**, y quien
 * armó el flujo no se enteraba. Un campo que no existe es un error del que
 * llama, y tiene que romper de una vez.
 */
function tomar(body: Record<string, unknown>, campos: readonly string[]) {
  const permitidos = new Set(campos);
  const args: Record<string, unknown> = {};
  const desconocidos: string[] = [];
  for (const clave of Object.keys(body)) {
    if (!permitidos.has(clave)) {
      desconocidos.push(clave);
      continue;
    }
    // `null` se trata como ausente: la API no borra campos, y aceptarlo en
    // silencio como "poner en nulo" sería otra forma del mismo malentendido.
    if (body[clave] !== undefined && body[clave] !== null) {
      args[clave] = body[clave];
    }
  }
  return { args, desconocidos };
}

/** Error 400 con los nombres exactos que sobraron — para no mandar a adivinar. */
function errorDeCamposDesconocidos(desconocidos: string[], campos: readonly string[]) {
  return errorResponse(
    400,
    "bad_request",
    `Campos que no existen en el contrato: ${desconocidos.join(", ")}. ` +
      `Los aceptados son: ${campos.join(", ")}.`,
  );
}

/**
 * Handler común de los dos endpoints que **patchean un lead existente**.
 *
 * Comparten toda la forma: token, cuerpo JSON, campos del contrato, y el 404
 * cuando la identidad no resuelve. Lo único propio de cada uno es qué mutation
 * llama y qué campos acepta.
 */
function patchDeLead(
  campos: readonly string[],
  correr: (
    ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
    args: Record<string, unknown>,
  ) => Promise<{ found: boolean }>,
) {
  return httpAction(async (ctx, request) => {
    const denied = requireBotToken(request);
    if (denied) return denied;

    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse(400, "bad_request", "Se esperaba un cuerpo JSON con un objeto.");
    }

    const { args, desconocidos } = tomar(body, campos);
    if (desconocidos.length > 0) return errorDeCamposDesconocidos(desconocidos, campos);

    try {
      const res = await correr(ctx, args);
      if (!res.found) {
        // 404 y no 201: estos endpoints NO crean. Un estado de pago sobre un
        // contacto inexistente es una señal de que algo viene mal más arriba.
        return jsonResponse(404, {
          error: "not_found",
          message:
            "No se encontró un lead con esa identidad. Usá /leads/upsert para crearlo.",
          ...res,
        });
      }
      return jsonResponse(200, res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(400, "bad_request", msg.slice(0, 300));
    }
  });
}

/** `POST /leads/payment-status` — reemplaza el campo `Estado Pago` de Airtable. */
const leadsPaymentStatus = patchDeLead(
  ["manychatId", "phone", "status", "runId"],
  (ctx, args) =>
    ctx.runMutation(internal.bots.leadsWrite.setPaymentStatus, args as never),
);

/**
 * `POST /leads/mark-followup` — reemplaza los checkboxes `Seguimiento 2h/23h/48h`.
 *
 * Contrato de **reclamo**: `claimed` dice si esta llamada fue la que puso la
 * bandera. Conviene llamarlo ANTES de enviar y mandar solo si `claimed` es
 * `true` — marcar después deja una ventana donde un reintento le vuelve a
 * escribir al cliente.
 */
const leadsMarkFollowup = patchDeLead(
  ["manychatId", "phone", "window", "done", "runId"],
  (ctx, args) =>
    ctx.runMutation(internal.bots.leadsWrite.markFollowup, args as never),
);

/**
 * `POST /bot/onoff` — kill-switch global desde n8n.
 *
 * Aplica el cambio y, si con eso revierte algo fijado desde el tablero, deja
 * el aviso: la precedencia todavía no está definida (H2) y no queremos que un
 * bot que se vuelve a prender solo pase inadvertido.
 */
const botSetOnOff = httpAction(async (ctx, request) => {
  const denied = requireBotToken(request);
  if (denied) return denied;

  const body = await parseJsonBody(request);
  if (!body || typeof body.enabled !== "boolean") {
    return errorResponse(
      400,
      "bad_request",
      "Se requiere un cuerpo JSON con `enabled` booleano.",
    );
  }

  const state = await ctx.runMutation(internal.bots.settings.setGlobal, {
    enabled: body.enabled,
    updatedBy: "api",
    updatedVia: "api",
    note: typeof body.note === "string" ? body.note : undefined,
  });
  return jsonResponse(200, state);
});

const http = httpRouter();
http.route({ path: "/clerk-webhook", method: "POST", handler: clerkWebhook });
http.route({ path: "/leads/upsert", method: "POST", handler: leadsUpsert });
http.route({
  path: "/leads/payment-status",
  method: "POST",
  handler: leadsPaymentStatus,
});
http.route({
  path: "/leads/mark-followup",
  method: "POST",
  handler: leadsMarkFollowup,
});
http.route({ path: "/bot/onoff", method: "POST", handler: botSetOnOff });
http.route({ path: "/bot/ping", method: "GET", handler: botPing });
http.route({ path: "/bot/onoff", method: "GET", handler: botOnOff });
http.route({
  path: "/leads/due-followups",
  method: "GET",
  handler: dueFollowups,
});
export default http;
