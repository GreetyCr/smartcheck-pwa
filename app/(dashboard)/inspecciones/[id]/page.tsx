import { InspectionRouteResolver } from "@/components/inspection/InspectionRouteResolver";
import { InspectionSectionsScreen } from "@/components/inspection/InspectionSectionsScreen";

type Props = { params: Promise<{ id: string }> };

export default async function InspeccionDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <InspectionRouteResolver routeRef={id}>
      {(ctx) => <InspectionSectionsScreen routeCtx={ctx} />}
    </InspectionRouteResolver>
  );
}
