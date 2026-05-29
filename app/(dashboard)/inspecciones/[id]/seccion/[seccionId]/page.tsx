"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Compat: redirige URLs legacy `/seccion/[seccionId]` → `?sec=`. */
export default function InspeccionSeccionLegacyRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const rawSeccion =
    typeof params.seccionId === "string" ? params.seccionId : "";

  useEffect(() => {
    if (!id || !rawSeccion) return;
    const sec = rawSeccion === "interior" ? "accesorios" : rawSeccion;
    router.replace(`/inspecciones/${id}/seccion?sec=${encodeURIComponent(sec)}`);
  }, [id, rawSeccion, router]);

  return null;
}
