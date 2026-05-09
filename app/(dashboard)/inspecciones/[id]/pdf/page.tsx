"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Compatibilidad: enlaces antiguos a `/inspecciones/:id/pdf`.
 * Redirige en cliente al detalle con ancla al bloque «Informe PDF» (el redirect
 * HTTP no puede llevar hash y forzaba una recarga innecesaria).
 */
export default function InspeccionPdfAnchorRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    if (!id) return;
    router.replace(`/inspecciones/${id}#informe-pdf`);
  }, [router, id]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Abriendo informe…</p>
    </div>
  );
}
