import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

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

const http = httpRouter();
http.route({ path: "/clerk-webhook", method: "POST", handler: clerkWebhook });
export default http;
