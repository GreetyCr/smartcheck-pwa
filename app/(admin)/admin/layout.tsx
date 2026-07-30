import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { audIncludesConvex } from "@/lib/clerk-convex-token";
import { AdminAppShell } from "@/components/admin/AdminAppShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, getToken, sessionClaims } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Gate por ROL admin, no solo por sesión. El rol vive en la tabla `users` de
  // Convex (sincronizada por webhook de Clerk).
  //
  // Solo redirige ante un **no-admin confirmado**. Si el rol no se puede
  // resolver (token que no se emite, Convex inalcanzable, fila de `users` aún
  // no sincronizada por el webhook), deja pasar a propósito: los gates reales
  // son `requireAdmin` en cada función de Convex — sin él no sale ni un dato —
  // y el chequeo de rol de `AdminAppShell`, ya probado en producción. Este
  // chequeo es de UX (que un técnico no navegue el panel), así que no debe
  // poder dejar a los admins afuera por un problema de infraestructura.
  let me: { role?: string } | null = null;
  try {
    const token = audIncludesConvex(sessionClaims?.aud)
      ? await getToken()
      : await getToken({ template: "convex" });
    me = token ? await fetchQuery(api.users.getMe, {}, { token }) : null;
  } catch {
    me = null; // no se pudo resolver → decide el shell/backend
  }

  if (me && me.role !== "admin") {
    redirect("/inspecciones");
  }

  return <AdminAppShell>{children}</AdminAppShell>;
}
