import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** El PDF se genera desde el detalle de la inspección (bloque «Informe PDF»). */
export default async function InspeccionPdfRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/inspecciones/${id}`);
}
