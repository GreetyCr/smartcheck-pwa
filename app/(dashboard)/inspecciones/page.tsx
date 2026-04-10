import { redirect } from "next/navigation";

/** La lista vive en `/historial` (tab Historial). */
export default function InspeccionesIndexRedirect() {
  redirect("/historial");
}
