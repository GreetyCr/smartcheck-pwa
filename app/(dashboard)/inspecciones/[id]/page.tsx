"use client";

import { useParams } from "next/navigation";
import { InspectionRouteResolver } from "@/components/inspection/InspectionRouteResolver";
import { InspectionSectionsScreen } from "@/components/inspection/InspectionSectionsScreen";

/** Client page: navegación offline (PWA) sin depender de RSC en el servidor. */
export default function InspeccionDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) return null;

  return (
    <InspectionRouteResolver routeRef={id}>
      <InspectionSectionsScreen />
    </InspectionRouteResolver>
  );
}
