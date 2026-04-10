import type { Id } from "@/convex/_generated/dataModel";
import { InspectionSectionsScreen } from "@/components/inspection/InspectionSectionsScreen";

type Props = { params: Promise<{ id: string }> };

export default async function InspeccionDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <InspectionSectionsScreen inspectionId={id as Id<"inspections">} />
  );
}
