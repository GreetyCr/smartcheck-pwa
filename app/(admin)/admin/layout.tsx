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
  // Convex (sincronizada por webhook de Clerk). Los datos ya están protegidos
  // por `requireAdmin` en cada función; este chequeo server-side evita además
  // que la UI del panel sea navegable por un técnico. Fail-closed: si no se
  // resuelve el rol como admin, se redirige al área de técnico.
  const token = audIncludesConvex(sessionClaims?.aud)
    ? await getToken()
    : await getToken({ template: "convex" });
  const me = token ? await fetchQuery(api.users.getMe, {}, { token }) : null;

  if (me?.role !== "admin") {
    redirect("/inspecciones");
  }

  return <AdminAppShell>{children}</AdminAppShell>;
}
