"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InspectionRouteResolver } from "@/components/inspection/InspectionRouteResolver";
import { SectionForm } from "@/components/inspection/SectionForm";
import { getSectionConfig } from "@/lib/constants/sectionItems";

/**
 * Una sola ruta cliente para todas las secciones (`?sec=`).
 * Evita RSC por segmento dinámico al navegar offline entre secciones.
 */
export default function InspeccionSeccionQueryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const rawSeccion = searchParams.get("sec") ?? "";

  useEffect(() => {
    if (id && rawSeccion === "interior") {
      router.replace(`/inspecciones/${id}/seccion?sec=accesorios`);
    }
  }, [id, rawSeccion, router]);

  if (!id || !rawSeccion) {
    return (
      <div className="p-6">
        <p className="text-destructive">Sección no especificada.</p>
        <Link href={`/inspecciones/${id}`} className="mt-2 inline-block text-primary underline">
          Volver a la inspección
        </Link>
      </div>
    );
  }

  if (rawSeccion === "interior") {
    return null;
  }

  const config = getSectionConfig(rawSeccion);
  if (!config) {
    return (
      <div className="p-6">
        <p className="text-destructive">Sección no encontrada.</p>
        <Link href={`/inspecciones/${id}`} className="mt-2 inline-block text-primary underline">
          Volver a la inspección
        </Link>
      </div>
    );
  }

  return (
    <InspectionRouteResolver routeRef={id}>
      <SectionForm key={`${id}-${config.id}`} sectionConfig={config} />
    </InspectionRouteResolver>
  );
}
