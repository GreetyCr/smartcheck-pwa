"use client";

import { useParams } from "next/navigation";
import { InspectionCabeceraScreen } from "@/components/inspection/InspectionCabeceraScreen";
import { InspectionRouteResolver } from "@/components/inspection/InspectionRouteResolver";

export default function InspeccionCabeceraPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) return null;

  return (
    <InspectionRouteResolver routeRef={id}>
      <InspectionCabeceraScreen />
    </InspectionRouteResolver>
  );
}
