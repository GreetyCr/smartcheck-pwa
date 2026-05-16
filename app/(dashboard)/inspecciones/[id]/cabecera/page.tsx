import { InspectionCabeceraScreen } from "@/components/inspection/InspectionCabeceraScreen";
import { InspectionRouteResolver } from "@/components/inspection/InspectionRouteResolver";

type Props = { params: Promise<{ id: string }> };

export default async function InspeccionCabeceraPage({ params }: Props) {
  const { id } = await params;
  return (
    <InspectionRouteResolver routeRef={id}>
      {(ctx) => <InspectionCabeceraScreen routeCtx={ctx} />}
    </InspectionRouteResolver>
  );
}
