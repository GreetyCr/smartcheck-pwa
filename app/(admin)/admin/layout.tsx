import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminAppShell } from "@/components/admin/AdminAppShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return <AdminAppShell>{children}</AdminAppShell>;
}
