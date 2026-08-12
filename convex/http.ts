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
 * `POST /bot/onoff` queda pendiente: escribir el estado desde n8n necesita la
 * regla de precedencia que Hans todavía no definió (§5 y §10 del handoff).
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

  // Se pasan solo los campos conocidos: el validador de la mutation rechaza
  // cualquier otra cosa, y así un typo en el flujo de n8n falla de una vez en
  // lugar de guardarse a medias.
  const campos = [
    "manychatId", "phone", "name", "locality", "needsInvoice",
    "vehicleBrand", "vehicleModel", "vehicleYear", "transmissionType",
    "engineType", "tractionType", "leadStage", "paymentStatus",
    "chatbotActive", "lastContactAt", "appointmentAt",
    "followup2hDone", "followup23hDone", "followup48hDone", "runId",
  ] as const;
  const args: Record<string, unknown> = {};
  for (const c of campos) if (body[c] !== undefined && body[c] !== null) args[c] = body[c];

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

const http = httpRouter();
http.route({ path: "/clerk-webhook", method: "POST", handler: clerkWebhook });
http.route({ path: "/leads/upsert", method: "POST", handler: leadsUpsert });
http.route({ path: "/bot/ping", method: "GET", handler: botPing });
http.route({ path: "/bot/onoff", method: "GET", handler: botOnOff });
http.route({
  path: "/leads/due-followups",
  method: "GET",
  handler: dueFollowups,
});
export default http;
