"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { InspectionRouteResolver } from "@/components/inspection/InspectionRouteResolver";
import { SectionForm } from "@/components/inspection/SectionForm";
import { getSectionConfig } from "@/lib/constants/sectionItems";

export default function InspeccionSeccionPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const rawSeccion =
    typeof params.seccionId === "string" ? params.seccionId : "";

  useEffect(() => {
    if (id && rawSeccion === "interior") {
      router.replace(`/inspecciones/${id}/seccion/accesorios`);
    }
  }, [id, rawSeccion, router]);

  if (!id || !rawSeccion) return null;

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
