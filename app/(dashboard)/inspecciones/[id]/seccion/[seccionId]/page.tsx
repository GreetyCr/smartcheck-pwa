import { notFound, redirect } from "next/navigation";
import { InspectionRouteResolver } from "@/components/inspection/InspectionRouteResolver";
import { SectionForm } from "@/components/inspection/SectionForm";
import { getSectionConfig } from "@/lib/constants/sectionItems";

type Props = { params: Promise<{ id: string; seccionId: string }> };

export default async function InspeccionSeccionPage({ params }: Props) {
  const { id, seccionId: rawSeccion } = await params;
  if (rawSeccion === "interior") {
    redirect(`/inspecciones/${id}/seccion/accesorios`);
  }
  const config = getSectionConfig(rawSeccion);
  if (!config) notFound();

  return (
    <InspectionRouteResolver routeRef={id}>
      {(ctx) => (
        <SectionForm
          key={`${id}-${config.id}`}
          sectionConfig={config}
          routeCtx={ctx}
        />
      )}
    </InspectionRouteResolver>
  );
}
